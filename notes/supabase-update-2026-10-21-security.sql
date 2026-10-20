-- Bookly update, 21 Oct 2026: security fixes from the audit + separate customer and business accounts.
-- Safe to run more than once.

-- Security fixes from the audit (C1, H1, H2, L2, L5, L6).
--
-- C1: most RLS policies trusted profiles.business_id, which users could write themselves.
--     Membership now comes from rows users can't forge: businesses.owner_id, or an active
--     team_members row (created by the owner, claimed through the invite server function).
-- H1: pay, timesheets, deals and tax settings are limited to the owner and admins.
-- H2: the token-less "claim any pending invite" policy is removed; invites get an expiry.

-- ── 1. Trusted membership checks ──
alter table public.team_members add column if not exists access_level text not null default 'staff';
alter table public.team_members drop constraint if exists team_members_access_level_check;
alter table public.team_members add constraint team_members_access_level_check
  check (access_level in ('staff', 'admin'));
alter table public.team_members add column if not exists invite_expires_at timestamptz;

create or replace function public.is_business_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_business is not null and auth.uid() is not null and (
    exists (select 1 from public.businesses b where b.id = p_business and b.owner_id = auth.uid())
    or exists (select 1 from public.team_members t
               where t.business_id = p_business and t.user_id = auth.uid() and t.invite_status = 'active')
  );
$$;

create or replace function public.is_business_admin(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_business is not null and auth.uid() is not null and (
    exists (select 1 from public.businesses b where b.id = p_business and b.owner_id = auth.uid())
    or exists (select 1 from public.team_members t
               where t.business_id = p_business and t.user_id = auth.uid()
                 and t.invite_status = 'active' and t.access_level = 'admin')
  );
$$;

revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.is_business_admin(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_admin(uuid) to authenticated;

-- ── 2. Profiles: people edit their personal fields only, never business_id or user_type ──
revoke insert, update on public.profiles from authenticated;
grant insert (id, full_name, phone, avatar_url, country, timezone, onboarded_at) on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, country, timezone, onboarded_at,
              birthday, gender, email_reminders, marketing_emails) on public.profiles to authenticated;

-- Even privileged paths may only point a profile at a business its user owns or is an active
-- member of. Replaces the narrower 20 Oct guard (same function, one trigger).
create or replace function public.guard_profile_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
     and not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.id)
     and not exists (select 1 from public.team_members t
                     where t.business_id = new.business_id and t.user_id = new.id and t.invite_status = 'active')
  then
    raise exception 'not_a_member_of_business' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_business() from public, anon, authenticated;
drop trigger if exists profiles_business_guard on public.profiles;
drop trigger if exists profiles_guard_business on public.profiles;
create trigger profiles_guard_business before insert or update of business_id on public.profiles
  for each row execute function public.guard_profile_business();

-- The only way the app sets business_id: link the caller to a business they own.
create or replace function public.link_my_business(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.profiles set business_id = p_business where id = auth.uid();
end;
$$;
revoke all on function public.link_my_business(uuid) from public, anon;
grant execute on function public.link_my_business(uuid) to authenticated;

-- L5: don't take user_type from sign-up data, except "customer" (which grants nothing; customer
-- sign-up uses it so the account isn't mistaken for a business).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, user_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    case when new.raw_user_meta_data ->> 'user_type' = 'customer' then 'customer' else 'business_owner' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── 3. Rewrite every policy that trusted profiles.business_id ──
-- Found dynamically so tables from any earlier migration are covered.
do $$
declare
  p record;
  v_has_col boolean;
begin
  for p in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'profiles'
      and (coalesce(qual, '') ~* 'from\s+(public\.)?profiles' or coalesce(with_check, '') ~* 'from\s+(public\.)?profiles')
  loop
    select exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = p.tablename and column_name = 'business_id')
      into v_has_col;
    if not v_has_col then
      raise exception 'policy %.% trusts profiles but the table has no business_id; fix by hand', p.tablename, p.policyname;
    end if;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    if p.cmd in ('SELECT', 'DELETE') then
      execute format('create policy %I on public.%I for %s to authenticated using (public.is_business_member(business_id))',
                     p.policyname, p.tablename, p.cmd);
    elsif p.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.is_business_member(business_id))',
                     p.policyname, p.tablename);
    else -- ALL / UPDATE
      execute format('create policy %I on public.%I for %s to authenticated
                        using (public.is_business_member(business_id))
                        with check (public.is_business_member(business_id))',
                     p.policyname, p.tablename, p.cmd);
    end if;
  end loop;
end $$;

-- ── 4. H1: owner/admin-only data ──
-- Pay runs, pay lines and timesheets: owner and admins only.
-- Deals and tax rates: every member can read them (checkout needs them); only admins change them.
do $$
declare t text;
begin
  foreach t in array array['pay_runs', 'pay_run_lines', 'timesheets'] loop
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format('drop policy if exists "Business admins manage %s" on public.%I', t, t);
    execute format('create policy "Business admins manage %s" on public.%I for all to authenticated
                      using (public.is_business_admin(business_id))
                      with check (public.is_business_admin(business_id))', t, t);
  end loop;

  foreach t in array array['deals', 'tax_rates'] loop
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format('drop policy if exists "Business members read %s" on public.%I', t, t);
    execute format('drop policy if exists "Business admins manage %s" on public.%I', t, t);
    execute format('create policy "Business members read %s" on public.%I for select to authenticated
                      using (public.is_business_member(business_id))', t, t);
    execute format('create policy "Business admins manage %s" on public.%I for all to authenticated
                      using (public.is_business_admin(business_id))
                      with check (public.is_business_admin(business_id))', t, t);
  end loop;
end $$;

-- ── 5. H2: invites are claimed only through the server function ──
drop policy if exists "invited_user_can_claim_own_team_member_row" on public.team_members;

-- ── 6. Functions that trusted profiles.business_id ──
create or replace function public.check_deal(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null or not public.is_business_member(v_business) then raise exception 'not_allowed'; end if;
  v_deal := public.usable_deal(v_business, p_code, false);
  return jsonb_build_object('id', v_deal.id, 'name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type,
                            'value', v_deal.value, 'applies_to', v_deal.applies_to);
end;
$$;
revoke all on function public.check_deal(text) from public, anon;
grant execute on function public.check_deal(text) to authenticated;

-- L6: the recorded amount can't be more than the sale's items are worth.
create or replace function public.redeem_deal(p_code text, p_sale uuid, p_amount numeric)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype; v_items numeric;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null or not public.is_business_member(v_business) then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.sales where id = p_sale and business_id = v_business) then
    raise exception 'not_allowed';
  end if;
  select coalesce(sum(price * quantity), 0) into v_items from public.sale_items where sale_id = p_sale;
  v_deal := public.usable_deal(v_business, p_code, false);
  insert into public.deal_redemptions (business_id, deal_id, sale_id, amount)
  values (v_business, v_deal.id, p_sale, least(greatest(0, coalesce(p_amount, 0)), greatest(v_items, 0)));
end;
$$;
revoke all on function public.redeem_deal(text, uuid, numeric) from public, anon;
grant execute on function public.redeem_deal(text, uuid, numeric) to authenticated;

-- L2: gift-card codes from a secure random source (gen_random_uuid uses the OS CSPRNG).
-- 256 is a multiple of 32, so "byte % 32" picks characters without bias.
create or replace function public.new_gift_card_code(p_business uuid)
returns text language plpgsql volatile security invoker set search_path = public as $$
declare
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  if not public.is_business_member(p_business) then raise exception 'not_allowed'; end if;
  loop
    v_bytes := uuid_send(gen_random_uuid());
    select string_agg(substr(v_chars, 1 + (get_byte(v_bytes, i) % 32), 1), '' order by i)
      into v_code from generate_series(0, 7) i;
    exit when not exists (select 1 from public.gift_cards where business_id = p_business and code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.new_gift_card_code(uuid) from public, anon;
grant execute on function public.new_gift_card_code(uuid) to authenticated;

-- ── 7. Repair: detach profiles pointing at a business they don't belong to ──
-- (Your check on 20 Oct found none; kept so the file is safe on any database.)
create table if not exists public.security_audit_detached_profiles (
  profile_id uuid not null,
  business_id uuid not null,
  detached_at timestamptz not null default now()
);
alter table public.security_audit_detached_profiles enable row level security; -- no policies: service role only
revoke all on public.security_audit_detached_profiles from anon, authenticated;

with bad as (
  select p.id, p.business_id from public.profiles p
  where p.business_id is not null
    and not exists (select 1 from public.businesses b where b.id = p.business_id and b.owner_id = p.id)
    and not exists (select 1 from public.team_members t
                    where t.business_id = p.business_id and t.user_id = p.id and t.invite_status = 'active')
), logged as (
  insert into public.security_audit_detached_profiles (profile_id, business_id)
  select id, business_id from bad returning profile_id
)
update public.profiles set business_id = null where id in (select profile_id from logged);

-- Two classes of user, like Fresha/Booksy: customer accounts (sign up at /sign-in) and business
-- accounts (owners and staff, sign up at /auth). One login belongs to one class:
-- customers can't create, join or link a business; business logins can't act as customers.
-- profiles.user_type is set once at sign-up (handle_new_user) and users can't change it.

create or replace function public.is_customer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select user_type = 'customer' from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_customer() from public, anon;
grant execute on function public.is_customer() to authenticated;

-- ── Customers never get a business ──
create or replace function public.guard_profile_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
  then
    -- Check the old type too: claiming a staff invite switches user_type to 'staff' in the same update.
    if new.user_type = 'customer' or (tg_op = 'UPDATE' and old.user_type = 'customer') then
      raise exception 'customer_account' using errcode = '42501';
    end if;
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.id)
       and not exists (select 1 from public.team_members t
                       where t.business_id = new.business_id and t.user_id = new.id and t.invite_status = 'active')
    then
      raise exception 'not_a_member_of_business' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_business() from public, anon, authenticated;

drop policy if exists "Owners can insert businesses" on public.businesses;
create policy "Owners can insert businesses" on public.businesses for insert to authenticated
  with check (auth.uid() = owner_id and not public.is_customer());

create or replace function public.link_my_business(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_customer() then raise exception 'customer_account' using errcode = '42501'; end if;
  if not exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.profiles set business_id = p_business where id = auth.uid();
end;
$$;
revoke all on function public.link_my_business(uuid) from public, anon;
grant execute on function public.link_my_business(uuid) to authenticated;

-- ── Customer features are for customer accounts only ──
create or replace function public.link_my_clients()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_count integer;
begin
  if not public.is_customer() then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email = '' then return 0; end if;
  update public.clients set user_id = auth.uid() where user_id is null and lower(email) = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop policy if exists "Customers manage their favourites" on public.favorite_businesses;
create policy "Customers manage their favourites" on public.favorite_businesses for all to authenticated
  using (user_id = auth.uid() and public.is_customer())
  with check (user_id = auth.uid() and public.is_customer());

-- my_appointments / my_wallet / submit_review only see client records linked to the caller,
-- and only customers can link, so unlinking non-customers below closes them too. The review
-- function also checks directly.
create or replace function public.submit_review(p_appointment uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_appt record;
  v_author text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not public.is_customer() then raise exception 'customer_account_required'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'invalid_rating'; end if;

  select a.id, a.business_id, a.status, c.first_name, c.last_name
    into v_appt
    from public.appointments a
    join public.clients c on c.id = a.client_id
   where a.id = p_appointment and c.user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if v_appt.status <> 'completed' then raise exception 'not_completed'; end if;
  if exists (select 1 from public.reviews where appointment_id = p_appointment) then raise exception 'already_reviewed'; end if;

  select nullif(trim(full_name), '') into v_author from public.profiles where id = auth.uid();
  v_author := coalesce(v_author, concat_ws(' ', v_appt.first_name, v_appt.last_name));
  v_author := split_part(v_author, ' ', 1)
    || case when split_part(v_author, ' ', 2) <> '' then ' ' || left(split_part(v_author, ' ', 2), 1) || '.' else '' end;

  insert into public.reviews (business_id, appointment_id, user_id, author_name, rating, comment, services, team_member_name)
  select v_appt.business_id, p_appointment, auth.uid(), v_author, p_rating,
         nullif(trim(coalesce(p_comment, '')), ''),
         string_agg(coalesce(s.name, 'Service'), ', ' order by i.sort_order),
         (array_agg(t.first_name order by i.sort_order))[1]
    from public.appointment_items i
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
   where i.appointment_id = p_appointment
  returning id into v_id;

  perform public.notify(v_appt.business_id, 'review', 'New ' || p_rating || '-star review',
    v_author || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 120), ''), '/calendar?appointment=' || p_appointment);
  return v_id;
end;
$$;
revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- ── Clean up links made before the classes were separate (e.g. testing with a business login) ──
update public.clients c set user_id = null
  where c.user_id is not null
    and not exists (select 1 from public.profiles p where p.id = c.user_id and p.user_type = 'customer');
delete from public.favorite_businesses f
  where not exists (select 1 from public.profiles p where p.id = f.user_id and p.user_type = 'customer');
