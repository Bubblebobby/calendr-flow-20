-- Second security review (22 Oct 2026).
-- #1 Owners could set a team row's user_id to anyone and "revoke" them, banning that account
--    platform-wide. Protected team_members columns can now only change through the server.
-- #2/#3 Rate limits on the public booking and promo-code functions; promo previews no longer
--    lock the deal row; online bookings only reuse a client record the booker has proved is theirs.
-- #5 Admin-only: deleting sales, changing lines of finished sales, voiding gift cards, deleting products.

-- ── #1 team_members: user_id, invite fields and access_level are server-only ──
revoke update on public.team_members from authenticated;
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'team_members'
    and column_name not in ('id', 'business_id', 'user_id', 'invite_status', 'invite_token',
                            'invite_expires_at', 'access_level', 'initials', 'created_at')
    and is_generated = 'NEVER';
  execute format('grant update (%s) on public.team_members to authenticated', v_cols);
end $$;

-- New rows from the browser start unlinked, uninvited and staff-level. The one exception is the
-- owner adding themselves to their own team (the app does this so they can take bookings).
-- Not security definer on purpose: current_user must be the caller's role.
create or replace function public.guard_team_member_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.user_id is not null and not (
       new.user_id = auth.uid()
       and exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid())
     ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  new.invite_status := case when new.user_id is null then 'not_invited' else new.invite_status end;
  new.invite_token := null;
  new.invite_expires_at := null;
  new.access_level := 'staff';
  return new;
end;
$$;
revoke all on function public.guard_team_member_insert() from public, anon, authenticated;
drop trigger if exists team_members_guard_insert on public.team_members;
create trigger team_members_guard_insert before insert on public.team_members
  for each row execute function public.guard_team_member_insert();

-- ── #2/#3 Rate limiting ──
-- Counts hits per key in a fixed window. Keys combine the action with the caller's IP (from the
-- request headers Supabase passes through), the signed-in account, or the salon.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security; -- no policies: functions only
revoke all on public.rate_limits from anon, authenticated;

-- The caller's IP as Supabase's edge reports it ("unknown" if it isn't passed through).
create or replace function public.request_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(trim(h ->> 'cf-connecting-ip'), ''),
    nullif(trim(h ->> 'x-real-ip'), ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x;
$$;
grant execute on function public.request_ip() to anon, authenticated;

create or replace function public.limit_requests(p_key text, p_limit integer, p_window interval)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  -- Occasionally clear out old windows so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  if v_hits > p_limit then raise exception 'too_many_requests'; end if;
end;
$$;
revoke all on function public.limit_requests(text, integer, interval) from public, anon, authenticated;

-- Promo codes: previews don't lock the deal row; only redemption does.
drop function if exists public.usable_deal(uuid, text, boolean);
create or replace function public.usable_deal(p_business uuid, p_code text, p_online boolean, p_lock boolean default true)
returns public.deals language plpgsql volatile security definer set search_path = public as $$
declare v_deal public.deals%rowtype; v_used int;
begin
  if p_lock then
    select * into v_deal from public.deals
      where business_id = p_business and code = upper(trim(p_code)) and is_active
      for update;
  else
    select * into v_deal from public.deals
      where business_id = p_business and code = upper(trim(p_code)) and is_active;
  end if;
  if not found then raise exception 'deal_not_found'; end if;
  if p_online and not v_deal.online then raise exception 'deal_not_online'; end if;
  if v_deal.starts_on is not null and v_deal.starts_on > current_date then raise exception 'deal_not_started'; end if;
  if v_deal.ends_on is not null and v_deal.ends_on < current_date then raise exception 'deal_expired'; end if;
  if v_deal.max_uses is not null then
    select count(*) into v_used from public.deal_redemptions where deal_id = v_deal.id;
    if v_used >= v_deal.max_uses then raise exception 'deal_used_up'; end if;
  end if;
  return v_deal;
end;
$$;
revoke all on function public.usable_deal(uuid, text, boolean, boolean) from public, anon, authenticated;

-- Public promo check: limited per visitor and per salon, and no row lock.
create or replace function public.check_booking_deal(p_slug text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('promo:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '10 minutes');
  end if;
  perform public.limit_requests('promo-salon:' || lower(p_slug), 100, interval '10 minutes');
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then raise exception 'booking_unavailable'; end if;
  -- A bad code is returned as {"error": ...} rather than raised, so the attempt still counts
  -- towards the limit above (raising would roll the count back).
  begin
    v_deal := public.usable_deal(v_business, p_code, true, false);
  exception when raise_exception then
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object('name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type, 'value', v_deal.value);
end;
$$;
revoke all on function public.check_booking_deal(text, text) from public;
grant execute on function public.check_booking_deal(text, text) to anon, authenticated;

-- Checkout preview (staff): no lock either.
create or replace function public.check_deal(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null or not public.is_business_member(v_business) then raise exception 'not_allowed'; end if;
  v_deal := public.usable_deal(v_business, p_code, false, false);
  return jsonb_build_object('id', v_deal.id, 'name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type,
                            'value', v_deal.value, 'applies_to', v_deal.applies_to);
end;
$$;
revoke all on function public.check_deal(text) from public, anon;
grant execute on function public.check_deal(text) to authenticated;

-- ── #3 Online bookings: safer client matching (core) and rate limits (wrapper) ──
create or replace function public.create_booking_core(
  p_slug text,
  p_items jsonb,
  p_start timestamptz,
  p_client jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_tz text;
  v_client_id uuid;
  v_appointment_id uuid;
  v_cursor timestamptz := p_start;
  v_item jsonb;
  v_service public.services%rowtype;
  v_member uuid;
  v_end timestamptz;
  v_first text := nullif(trim(p_client->>'first_name'), '');
  v_last text := nullif(trim(p_client->>'last_name'), '');
  v_email text := lower(nullif(trim(p_client->>'email'), ''));
  v_phone text := nullif(regexp_replace(coalesce(p_client->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_sort int := 0;
begin
  select * into v_business from public.businesses
    where booking_slug = lower(p_slug) and online_booking_enabled;
  if not found then raise exception 'booking_unavailable'; end if;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');

  if v_first is null or length(v_first) > 100 or coalesce(length(v_last), 0) > 100 then
    raise exception 'invalid_client';
  end if;
  if v_email is null and v_phone is null then raise exception 'contact_required'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 6 then
    raise exception 'invalid_services';
  end if;

  -- Reuse an existing client record only when the caller has shown it's theirs: a signed-in
  -- customer booking with their own confirmed email, or both email and phone matching.
  -- Otherwise a new record is made, so nobody can add bookings to someone else's history
  -- just by knowing their email or phone number.
  if v_email is not null and public.is_customer()
     and v_email = (select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null)
  then
    select id into v_client_id from public.clients
      where business_id = v_business.id and lower(email) = v_email
      order by (user_id = auth.uid()) desc nulls last, created_at
      limit 1;
  elsif v_email is not null and v_phone is not null then
    select id into v_client_id from public.clients
      where business_id = v_business.id and lower(email) = v_email and phone = v_phone
      order by created_at
      limit 1;
  end if;
  if v_client_id is null then
    insert into public.clients (business_id, first_name, last_name, email, phone, client_source)
    values (v_business.id, v_first, v_last, v_email, v_phone, 'online_booking')
    returning id into v_client_id;
  end if;

  insert into public.appointments (business_id, client_id, is_walk_in, status, notes)
  values (v_business.id, v_client_id, false, 'booked', left(nullif(trim(p_notes), ''), 1000))
  returning id into v_appointment_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service from public.services
      where id = (v_item->>'service_id')::uuid and business_id = v_business.id
        and not is_archived and online_booking_enabled;
    if not found then raise exception 'invalid_services'; end if;
    v_end := v_cursor + make_interval(mins => v_service.duration_minutes);

    v_member := nullif(v_item->>'team_member_id', '')::uuid;
    if v_member is null then
      select t.id into v_member
      from public.team_members t
      where t.business_id = v_business.id and t.is_active
        and (not exists (select 1 from public.service_team_members x where x.service_id = v_service.id)
             or exists (select 1 from public.service_team_members x
                        where x.service_id = v_service.id and x.team_member_id = t.id))
        and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)
        and not exists (select 1 from public.appointment_items i
                        where i.team_member_id = t.id and i.is_blocking
                          and tstzrange(i.start_time, i.end_time) && tstzrange(v_cursor, v_end))
        and not exists (select 1 from public.blocked_times bt
                        where bt.team_member_id = t.id and not bt.online_booking_allowed
                          and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end))
      order by t.created_at
      limit 1;
      if v_member is null then
        -- Nobody free: say whether it's because nobody works then, or everyone is booked.
        if exists (select 1 from public.team_members t
                   where t.business_id = v_business.id and t.is_active
                     and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)) then
          raise exception 'slot_taken';
        end if;
        raise exception 'outside_hours';
      end if;
    else
      if not exists (select 1 from public.team_members t
                     where t.id = v_member and t.business_id = v_business.id and t.is_active) then
        raise exception 'invalid_team_member';
      end if;
      if not public.member_is_working(v_business.id, v_member, v_cursor, v_end, v_tz) then
        raise exception 'outside_hours';
      end if;
      if exists (select 1 from public.blocked_times bt
                 where bt.team_member_id = v_member and not bt.online_booking_allowed
                   and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
        raise exception 'slot_taken';
      end if;
    end if;

    begin
      insert into public.appointment_items
        (appointment_id, business_id, service_id, team_member_id, start_time, end_time, price, sort_order)
      values
        (v_appointment_id, v_business.id, v_service.id, v_member, v_cursor, v_end,
         case when v_service.pricing_type = 'free' then 0 else v_service.price end, v_sort);
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;

    v_cursor := v_end;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('appointment_id', v_appointment_id, 'start', p_start, 'end', v_cursor);
end;
$$;
revoke all on function public.create_booking_core(text, jsonb, timestamptz, jsonb, text) from public, anon, authenticated;

create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_appointment uuid;
  v_business uuid;
  v_deal public.deals%rowtype;
  v_total numeric;
  v_discount numeric := 0;
begin
  -- Spam protection: per visitor (or signed-in account) and per salon.
  -- (Skipped when the visitor can't be identified, so unknown visitors don't share one bucket.)
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('book:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '1 hour');
  end if;
  perform public.limit_requests('book-salon:' || lower(p_slug), 60, interval '1 hour');

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;
  select business_id into v_business from public.appointments where id = v_appointment;

  if v_deal.id is not null then
    select coalesce(sum(price), 0) into v_total from public.appointment_items where appointment_id = v_appointment;
    v_discount := least(v_total, case when v_deal.discount_type = 'percent' then round(v_total * v_deal.value / 100, 2) else v_deal.value end);
    if v_total > 0 and v_discount > 0 then
      update public.appointment_items
        set price = round(price - price / v_total * v_discount, 2)
        where appointment_id = v_appointment;
    end if;
    insert into public.deal_redemptions (business_id, deal_id, appointment_id, amount)
    values (v_deal.business_id, v_deal.id, v_appointment, v_discount);
    update public.appointments
      set notes = concat_ws(E'\n', notes, 'Promo code ' || v_deal.code || ' applied')
      where id = v_appointment;
  end if;

  perform public.notify(v_business, 'online_booking', 'New online booking',
    public.appointment_summary(v_appointment), '/calendar?appointment=' || v_appointment);

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;

-- ── #5 Admin-only for destructive or money-changing actions ──
-- Sales: members can create and update; only admins delete.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sales' loop
    execute format('drop policy %I on public.sales', p.policyname);
  end loop;
end $$;
create policy "Business members use sales" on public.sales for select to authenticated
  using (public.is_business_member(business_id));
create policy "Business members add sales" on public.sales for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "Business members update sales" on public.sales for update to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Business admins delete sales" on public.sales for delete to authenticated
  using (public.is_business_admin(business_id));

-- Sale lines: members can add lines, but removing or editing them needs a draft sale (checkout
-- re-saves drafts) or an admin. Server and SQL-editor changes (no signed-in user) are allowed.
create or replace function public.guard_sale_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_business uuid; v_status text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select business_id, status into v_business, v_status from public.sales where id = old.sale_id;
  -- Deleting a whole sale (or business) cascades here; let that through.
  if v_business is null then return coalesce(new, old); end if;
  if v_status <> 'draft' and not public.is_business_admin(v_business) then
    raise exception 'sale_locked' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.guard_sale_items() from public, anon, authenticated;
drop trigger if exists sale_items_guard on public.sale_items;
create trigger sale_items_guard before update or delete on public.sale_items
  for each row execute function public.guard_sale_items();

-- Gift cards: voiding (or un-voiding) a card is admin-only. Balances already change only
-- through redemptions.
create or replace function public.guard_gift_card_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.status is distinct from old.status
     and not public.is_business_admin(new.business_id) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_gift_card_status() from public, anon, authenticated;
drop trigger if exists gift_cards_guard_status on public.gift_cards;
create trigger gift_cards_guard_status before update on public.gift_cards
  for each row execute function public.guard_gift_card_status();

-- Products: only admins delete them (stock history stays meaningful).
do $$
declare p record;
begin
  for p in select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'products' loop
    execute format('drop policy %I on public.products', p.policyname);
  end loop;
end $$;
create policy "Business members read products" on public.products for select to authenticated
  using (public.is_business_member(business_id));
create policy "Business members add products" on public.products for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "Business members update products" on public.products for update to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Business admins delete products" on public.products for delete to authenticated
  using (public.is_business_admin(business_id));
