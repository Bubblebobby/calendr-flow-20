-- Third security review (22 Oct 2026): lock finished sales properly, admin-only deletion of stored
-- value (gift cards, packages, memberships, redemptions), and rate-limit tuning.

-- ── Finished sales: staff can't reopen, re-price, refund or edit them ──
-- Who finished a sale and when, so checkout's own last step (adding the lines, which deducts
-- stock) still works for the person who just completed it.
alter table public.sales add column if not exists finalized_at timestamptz;
alter table public.sales add column if not exists finalized_by uuid;

create or replace function public.guard_sales_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Record the moment a sale stops being a draft.
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.finalized_at := now();
    new.finalized_by := auth.uid();
  elsif tg_op = 'UPDATE' and auth.uid() is not null then
    -- People can't move the finish time (it decides who may still add lines).
    new.finalized_at := old.finalized_at;
    new.finalized_by := old.finalized_by;
  end if;

  -- Once finished, only admins may change it (status, totals, payment, client, date...).
  -- Notes stay editable. The server and SQL editor (no signed-in user) are not restricted.
  if tg_op = 'UPDATE' and auth.uid() is not null and old.status <> 'draft'
     and not public.is_business_admin(old.business_id)
     and (to_jsonb(new) - 'notes' - 'updated_at') is distinct from (to_jsonb(old) - 'notes' - 'updated_at')
  then
    raise exception 'sale_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_sales_write() from public, anon, authenticated;
drop trigger if exists sales_guard_write on public.sales;
create trigger sales_guard_write before insert or update on public.sales
  for each row execute function public.guard_sales_write();

-- Sale lines: drafts are open; finished sales are admin-only, except that the person who just
-- finished a sale has 2 minutes to add its lines (checkout does this right after completing).
create or replace function public.guard_sale_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales%rowtype;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select * into v_sale from public.sales where id = coalesce(new.sale_id, old.sale_id);
  -- Deleting a whole sale (or business) cascades here; let that through.
  if not found then return coalesce(new, old); end if;
  if v_sale.status = 'draft' or public.is_business_admin(v_sale.business_id) then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and v_sale.finalized_by = auth.uid() and v_sale.finalized_at > now() - interval '2 minutes' then
    return new;
  end if;
  raise exception 'sale_locked' using errcode = '42501';
end;
$$;
revoke all on function public.guard_sale_items() from public, anon, authenticated;
drop trigger if exists sale_items_guard on public.sale_items;
create trigger sale_items_guard before insert or update or delete on public.sale_items
  for each row execute function public.guard_sale_items();

-- Redemption checks: membership comes from is_business_member, not the profile's business link.
create or replace function public.apply_gift_card_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_card public.gift_cards%rowtype;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not public.is_business_member(new.business_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_card from public.gift_cards where id = new.gift_card_id and business_id = new.business_id for update;
  if not found then raise exception 'gift_card_not_found'; end if;
  if v_card.status <> 'active' then raise exception 'gift_card_void'; end if;
  if v_card.expires_on is not null and v_card.expires_on < current_date then raise exception 'gift_card_expired'; end if;
  if v_card.balance < new.amount then raise exception 'gift_card_insufficient'; end if;
  update public.gift_cards set balance = balance - new.amount where id = v_card.id;
  return new;
end;
$$;
revoke all on function public.apply_gift_card_redemption() from public, anon, authenticated;

create or replace function public.apply_package_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item public.client_package_items%rowtype; v_expires date;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not public.is_business_member(new.business_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_item from public.client_package_items where id = new.client_package_item_id and business_id = new.business_id for update;
  if not found then raise exception 'package_not_found'; end if;
  select expires_on into v_expires from public.client_packages where id = v_item.client_package_id;
  if v_expires is not null and v_expires < current_date then raise exception 'package_expired'; end if;
  if v_item.sessions_used + new.sessions > v_item.sessions_total then raise exception 'package_used_up'; end if;
  update public.client_package_items set sessions_used = sessions_used + new.sessions where id = v_item.id;
  return new;
end;
$$;
revoke all on function public.apply_package_redemption() from public, anon, authenticated;

-- ── Stored value: only admins delete it ──
-- Splits each "for all" member policy into select/insert/update for members and delete for admins.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['gift_cards', 'gift_card_redemptions', 'packages', 'client_packages',
                           'client_package_items', 'package_redemptions', 'memberships',
                           'client_memberships', 'deal_redemptions'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname, cmd from pg_policies where schemaname = 'public' and tablename = t loop
      if p.cmd = 'ALL' then
        execute format('drop policy %I on public.%I', p.policyname, t);
        execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(business_id))',
                       'Business members read ' || t, t);
        execute format('create policy %I on public.%I for insert to authenticated with check (public.is_business_member(business_id))',
                       'Business members add ' || t, t);
        execute format('create policy %I on public.%I for update to authenticated
                          using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))',
                       'Business members update ' || t, t);
        execute format('create policy %I on public.%I for delete to authenticated using (public.is_business_admin(business_id))',
                       'Business admins delete ' || t, t);
      elsif p.cmd = 'DELETE' and p.policyname <> 'Business admins delete ' || t then
        execute format('drop policy %I on public.%I', p.policyname, t);
        execute format('create policy %I on public.%I for delete to authenticated using (public.is_business_admin(business_id))',
                       'Business admins delete ' || t, t);
      end if;
    end loop;
  end loop;
end $$;

-- ── Rate limits ──
-- (request_ip trusts cf-connecting-ip / x-real-ip / x-forwarded-for. On Supabase's hosted
-- platform the edge overwrites these, so visitors can't fake them; tested 22 Oct 2026. If you
-- ever self-host, only trust the header your own proxy sets.)

-- Promo check: per-visitor limit first, then a high per-salon cap, counted only for real salons.
create or replace function public.check_booking_deal(p_slug text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('promo:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '10 minutes');
  end if;
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then raise exception 'booking_unavailable'; end if;
  perform public.limit_requests('promo-salon:' || v_business, 500, interval '10 minutes');
  -- A bad code is returned as {"error": ...} rather than raised, so the attempt still counts.
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

-- Online bookings: same pattern.
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
  -- Spam protection: per visitor (or signed-in account) first, then a high per-salon cap counted
  -- only for real salons. (The visitor limit is skipped when they can't be identified, so unknown
  -- visitors don't share one bucket.)
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('book:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '1 hour');
  end if;
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then return jsonb_build_object('error', 'booking_unavailable'); end if;
  perform public.limit_requests('book-salon:' || v_business, 300, interval '1 hour');

  -- Booking problems (slot taken, bad service, bad code...) come back as {"error": ...} instead of
  -- being raised, so failed attempts still count towards the limits above.
  begin
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
  exception when raise_exception then
    return jsonb_build_object('error', sqlerrm);
  end;
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;
