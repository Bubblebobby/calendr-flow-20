-- Speed (23 Oct 2026).
-- 1. Access checks: every policy called is_business_member(business_id) once per row. Working
--    out the caller's salons once per query is ~40x faster (8.5 ms vs 339 ms for 1,500 of 30,000
--    appointments in testing). Same rules, evaluated once.
-- 2. Staff can read their own business's row (they couldn't, so the app found no business).
-- 3. Indexes for the lookups the app does all the time.

create or replace function public.my_business_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.businesses where owner_id = auth.uid()
  union
  select business_id from public.team_members
   where user_id = auth.uid() and invite_status = 'active';
$$;

create or replace function public.my_admin_business_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.businesses where owner_id = auth.uid()
  union
  select business_id from public.team_members
   where user_id = auth.uid() and invite_status = 'active' and access_level = 'admin';
$$;

revoke all on function public.my_business_ids() from public, anon;
revoke all on function public.my_admin_business_ids() from public, anon;
grant execute on function public.my_business_ids() to authenticated;
grant execute on function public.my_admin_business_ids() to authenticated;

-- Rewrite every policy that checks membership row by row into the set-based form.
do $$
declare
  p record;
  v_using text;
  v_check text;
  v_roles text;
begin
  for p in
    select tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'is_business_(member|admin)\(business_id\)'
           or coalesce(with_check, '') ~ 'is_business_(member|admin)\(business_id\)')
  loop
    v_using := regexp_replace(regexp_replace(p.qual,
      '(public\.)?is_business_member\(business_id\)', 'business_id IN (SELECT public.my_business_ids())', 'g'),
      '(public\.)?is_business_admin\(business_id\)', 'business_id IN (SELECT public.my_admin_business_ids())', 'g');
    v_check := regexp_replace(regexp_replace(p.with_check,
      '(public\.)?is_business_member\(business_id\)', 'business_id IN (SELECT public.my_business_ids())', 'g'),
      '(public\.)?is_business_admin\(business_id\)', 'business_id IN (SELECT public.my_admin_business_ids())', 'g');
    select string_agg(quote_ident(r), ', ') into v_roles from unnest(p.roles) r;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, p.permissive, p.cmd, v_roles,
      case when v_using is not null then ' using (' || v_using || ')' else '' end,
      case when v_check is not null then ' with check (' || v_check || ')' else '' end);
  end loop;
end $$;

-- Staff (active team members) can read the business they work for.
drop policy if exists "Members can view their business" on public.businesses;
create policy "Members can view their business" on public.businesses for select to authenticated
  using (id in (select public.my_business_ids()));

-- Indexes.
create index if not exists appointment_items_appointment_idx on public.appointment_items (appointment_id);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id) where product_id is not null;
create index if not exists sale_items_team_member_idx on public.sale_items (team_member_id) where team_member_id is not null;
create index if not exists sales_team_member_idx on public.sales (team_member_id) where team_member_id is not null;
create index if not exists team_members_user_idx on public.team_members (user_id) where user_id is not null;
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists gift_cards_client_idx on public.gift_cards (client_id) where client_id is not null;
create index if not exists gift_card_redemptions_card_idx on public.gift_card_redemptions (gift_card_id);
create index if not exists client_packages_client_idx on public.client_packages (client_id);
create index if not exists client_package_items_package_idx on public.client_package_items (client_package_id);
create index if not exists client_memberships_client_idx on public.client_memberships (client_id);
create index if not exists pay_run_lines_run_idx on public.pay_run_lines (pay_run_id);
create index if not exists waitlist_entries_client_idx on public.waitlist_entries (client_id);
create index if not exists blocked_times_member_idx on public.blocked_times (team_member_id);
create index if not exists deal_redemptions_sale_idx on public.deal_redemptions (sale_id) where sale_id is not null;

-- business_id on the tables that didn't have it indexed yet.
do $$
declare t text;
begin
  foreach t in array array['bundles', 'business_closed_periods', 'client_memberships', 'client_package_items',
                           'client_packages', 'client_tag_assignments', 'deal_redemptions', 'gift_card_redemptions',
                           'memberships', 'package_items', 'package_redemptions', 'packages', 'pay_run_lines',
                           'pay_runs', 'stock_movements', 'stock_order_items', 'stock_orders', 'stocktake_items',
                           'stocktakes', 'suppliers', 'team_roles', 'team_schedules', 'team_shift_overrides',
                           'team_time_off', 'timesheets'] loop
    if to_regclass('public.' || t) is not null then
      execute format('create index if not exists %I on public.%I (business_id)', t || '_business_idx', t);
    end if;
  end loop;
end $$;
