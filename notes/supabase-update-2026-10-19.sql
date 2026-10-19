-- Run once in Supabase → SQL Editor. Today's (19 Oct) updates, in order.

-- Clients manage their own online bookings from a private link: view, cancel or reschedule,
-- within the business's booking policy. The token is the only key; it is unguessable (uuid v4).

alter table public.appointments add column if not exists manage_token uuid not null default gen_random_uuid();
create unique index if not exists appointments_manage_token_key on public.appointments (manage_token);

alter table public.businesses add column if not exists booking_notice_hours int not null default 24
  check (booking_notice_hours between 0 and 336);
alter table public.businesses add column if not exists allow_client_cancel boolean not null default true;
alter table public.businesses add column if not exists allow_client_reschedule boolean not null default true;
alter table public.businesses add column if not exists booking_policy text;

-- Include the token in create_booking's result so the confirmation screen can show the link.
create or replace function public.booking_manage_token(p_appointment uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select manage_token from public.appointments where id = p_appointment;
$$;
revoke all on function public.booking_manage_token(uuid) from public, anon, authenticated;

-- Wrap the existing create_booking: same checks, plus the manage token in the result.
alter function public.create_booking(text, jsonb, timestamptz, jsonb, text) rename to create_booking_core;
revoke all on function public.create_booking_core(text, jsonb, timestamptz, jsonb, text) from public, anon, authenticated;

create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  return v_result || jsonb_build_object(
    'manage_token', public.booking_manage_token((v_result->>'appointment_id')::uuid));
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text) to anon, authenticated;

-- Everything the manage page shows. Client sees only their own appointment.
create or replace function public.get_manage_booking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'notes', a.notes,
      'start', (select min(i.start_time) from public.appointment_items i where i.appointment_id = a.id),
      'end', (select max(i.end_time) from public.appointment_items i where i.appointment_id = a.id),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'service_id', i.service_id,
            'service', s.name,
            'duration', s.duration_minutes,
            'price', i.price,
            'team_member_id', i.team_member_id,
            'team_member', t.first_name,
            'start', i.start_time,
            'end', i.end_time
          ) order by i.sort_order), '[]'::jsonb)
        from public.appointment_items i
        left join public.services s on s.id = i.service_id
        left join public.team_members t on t.id = i.team_member_id
        where i.appointment_id = a.id
      ),
      'client_first_name', c.first_name
    ),
    'business', jsonb_build_object(
      'name', b.name,
      'slug', b.booking_slug,
      'currency', b.currency,
      'country', b.country,
      'timezone', coalesce(b.timezone, 'Africa/Lagos'),
      'location', b.location,
      'hours', (select coalesce(jsonb_agg(jsonb_build_object('day', h.day_of_week, 'open', h.is_open, 'from', h.open_time, 'to', h.close_time)), '[]'::jsonb)
                from public.business_hours h where h.business_id = b.id)
    ),
    'policy', jsonb_build_object(
      'notice_hours', b.booking_notice_hours,
      'allow_cancel', b.allow_client_cancel,
      'allow_reschedule', b.allow_client_reschedule,
      'text', b.booking_policy
    )
  )
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  left join public.clients c on c.id = a.client_id
  where a.manage_token = p_token;
$$;

-- Busy times for rescheduling, ignoring the client's own appointment.
create or replace function public.get_manage_busy(p_token uuid, p_from timestamptz, p_to timestamptz)
returns table (team_member_id uuid, start_time timestamptz, end_time timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with appt as (select id, business_id from public.appointments where manage_token = p_token)
  select i.team_member_id, i.start_time, i.end_time
  from public.appointment_items i, appt
  where i.business_id = appt.business_id and i.appointment_id <> appt.id and i.is_blocking
    and i.start_time < p_to and i.end_time > p_from and p_to - p_from <= interval '32 days'
  union all
  select bt.team_member_id, bt.start_time, bt.end_time
  from public.blocked_times bt, appt
  where bt.business_id = appt.business_id and not bt.online_booking_allowed
    and bt.start_time < p_to and bt.end_time > p_from and p_to - p_from <= interval '32 days';
$$;

-- Shifts per team member per day, for rescheduling (same as get_booking_availability, keyed by token).
create or replace function public.get_manage_availability(p_token uuid, p_from date, p_to date)
returns table (team_member_id uuid, day date, shifts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, d::date, public.member_day_shifts(a.business_id, t.id, d::date)
  from public.appointments a
  join public.team_members t on t.business_id = a.business_id and t.is_active
  cross join generate_series(p_from, least(p_to, p_from + 31), interval '1 day') d
  where a.manage_token = p_token and p_to >= p_from;
$$;

-- Raises unless the appointment can still be changed by the client.
create or replace function public.assert_manageable(p_token uuid, p_action text)
returns public.appointments
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_start timestamptz;
begin
  select * into v_appt from public.appointments where manage_token = p_token;
  if not found then raise exception 'not_found'; end if;
  select * into v_business from public.businesses where id = v_appt.business_id;
  if v_appt.status not in ('booked', 'confirmed') then raise exception 'not_changeable'; end if;
  if p_action = 'cancel' and not v_business.allow_client_cancel then raise exception 'not_allowed'; end if;
  if p_action = 'reschedule' and not v_business.allow_client_reschedule then raise exception 'not_allowed'; end if;
  select min(start_time) into v_start from public.appointment_items where appointment_id = v_appt.id;
  if v_start is null or v_start < now() + make_interval(hours => v_business.booking_notice_hours) then
    raise exception 'too_late';
  end if;
  return v_appt;
end;
$$;
revoke all on function public.assert_manageable(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_booking(p_token uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
begin
  v_appt := public.assert_manageable(p_token, 'cancel');
  update public.appointments
    set status = 'cancelled',
        cancellation_reason = left(coalesce(nullif(trim(p_reason), ''), 'Cancelled by client online'), 300)
    where id = v_appt.id;
  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- Moves every service to start at p_start (back to back), keeping the same team members.
create or replace function public.reschedule_booking(p_token uuid, p_start timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_tz text;
  v_cursor timestamptz := p_start;
  v_item record;
  v_end timestamptz;
begin
  v_appt := public.assert_manageable(p_token, 'reschedule');
  select * into v_business from public.businesses where id = v_appt.business_id;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');
  if p_start < now() + make_interval(hours => v_business.booking_notice_hours)
     or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;

  -- Free the old slots first so moving by a few minutes doesn't clash with itself.
  update public.appointment_items set is_blocking = false where appointment_id = v_appt.id;

  for v_item in
    select i.id, i.team_member_id, extract(epoch from (i.end_time - i.start_time)) / 60 as minutes
    from public.appointment_items i where i.appointment_id = v_appt.id order by i.sort_order
  loop
    v_end := v_cursor + make_interval(mins => v_item.minutes::int);
    if not public.member_is_working(v_business.id, v_item.team_member_id, v_cursor, v_end, v_tz) then
      raise exception 'outside_hours';
    end if;
    if exists (select 1 from public.blocked_times bt
               where bt.team_member_id = v_item.team_member_id and not bt.online_booking_allowed
                 and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
      raise exception 'slot_taken';
    end if;
    begin
      update public.appointment_items
        set start_time = v_cursor, end_time = v_end, is_blocking = true
        where id = v_item.id;
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;
    v_cursor := v_end;
  end loop;

  return jsonb_build_object('start', p_start, 'end', v_cursor);
end;
$$;

revoke all on function public.get_manage_booking(uuid) from public;
revoke all on function public.get_manage_busy(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_manage_availability(uuid, date, date) from public;
revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.get_manage_booking(uuid) to anon, authenticated;
grant execute on function public.get_manage_busy(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.get_manage_availability(uuid, date, date) to anon, authenticated;
grant execute on function public.cancel_booking(uuid, text) to anon, authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to anon, authenticated;

-- The policy shown on the booking page before the client confirms.
create or replace function public.get_booking_policy(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'notice_hours', booking_notice_hours,
    'allow_cancel', allow_client_cancel,
    'allow_reschedule', allow_client_reschedule,
    'text', booking_policy)
  from public.businesses
  where booking_slug = lower(p_slug) and online_booking_enabled;
$$;
revoke all on function public.get_booking_policy(text) from public;
grant execute on function public.get_booking_policy(text) to anon, authenticated;

-- Catalog → Products and Inventory: products, suppliers, stock orders, stocktakes, stock history.
-- products.stock_quantity is kept in step by stock_movements (insert-only ledger) via triggers.

create table if not exists public.product_brands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  brand_id uuid references public.product_brands(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  sku text,
  barcode text,
  description text,
  retail_price numeric not null default 0 check (retail_price >= 0),
  supply_price numeric check (supply_price is null or supply_price >= 0),
  track_stock boolean not null default true,
  stock_quantity integer not null default 0,
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_business_idx on public.products (business_id, name);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  change integer not null check (change <> 0),
  reason text not null check (reason in ('initial', 'adjustment', 'sale', 'refund', 'stock_order', 'stocktake', 'damaged', 'internal_use')),
  reference_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create table if not exists public.stock_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.stock_orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  supply_price numeric check (supply_price is null or supply_price >= 0)
);

create table if not exists public.stocktakes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.stocktake_items (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references public.stocktakes(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  expected integer not null,
  counted integer check (counted is null or counted >= 0),
  unique (stocktake_id, product_id)
);

alter table public.sale_items add column if not exists product_id uuid references public.products(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['product_brands', 'product_categories', 'suppliers', 'products', 'stock_movements',
                           'stock_orders', 'stock_order_items', 'stocktakes', 'stocktake_items'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- The ledger is append-only for the app: history can't be edited or deleted.
revoke update, delete on public.stock_movements from authenticated;

create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products
    set stock_quantity = stock_quantity + new.change, updated_at = now()
    where id = new.product_id and business_id = new.business_id;
  return new;
end;
$$;
revoke all on function public.apply_stock_movement() from public, anon, authenticated;
drop trigger if exists stock_movements_apply on public.stock_movements;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Selling a tracked product takes it out of stock (only for completed sales; drafts don't count).
create or replace function public.sale_item_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null
     and exists (select 1 from public.sales s where s.id = new.sale_id and s.status = 'completed')
     and exists (select 1 from public.products p where p.id = new.product_id and p.track_stock) then
    insert into public.stock_movements (business_id, product_id, change, reason, reference_id)
    values (new.business_id, new.product_id, -new.quantity, 'sale', new.sale_id);
  end if;
  return new;
end;
$$;
revoke all on function public.sale_item_stock() from public, anon, authenticated;
drop trigger if exists sale_items_stock on public.sale_items;
create trigger sale_items_stock after insert on public.sale_items
  for each row execute function public.sale_item_stock();

-- Refunding a completed sale puts its products back.
create or replace function public.sale_refund_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'completed' and new.status = 'refunded' then
    insert into public.stock_movements (business_id, product_id, change, reason, reference_id)
    select i.business_id, i.product_id, i.quantity, 'refund', new.id
    from public.sale_items i join public.products p on p.id = i.product_id
    where i.sale_id = new.id and p.track_stock;
  end if;
  return new;
end;
$$;
revoke all on function public.sale_refund_stock() from public, anon, authenticated;
drop trigger if exists sales_refund_stock on public.sales;
create trigger sales_refund_stock after update of status on public.sales
  for each row execute function public.sale_refund_stock();

-- Receive a stock order: adds every line to stock once.
create or replace function public.receive_stock_order(p_order uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_order public.stock_orders%rowtype;
begin
  select * into v_order from public.stock_orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status not in ('draft', 'ordered') then raise exception 'already_closed'; end if;
  insert into public.stock_movements (business_id, product_id, change, reason, reference_id, created_by)
  select i.business_id, i.product_id, i.quantity, 'stock_order', p_order, auth.uid()
  from public.stock_order_items i join public.products p on p.id = i.product_id
  where i.order_id = p_order and p.track_stock;
  update public.products p set supply_price = i.supply_price
    from public.stock_order_items i
    where i.order_id = p_order and i.product_id = p.id and i.supply_price is not null;
  update public.stock_orders set status = 'received', received_at = now() where id = p_order;
end;
$$;

-- Complete a stocktake: moves stock to the counted figures (difference recorded in the ledger).
create or replace function public.complete_stocktake(p_stocktake uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_take public.stocktakes%rowtype;
begin
  select * into v_take from public.stocktakes where id = p_stocktake for update;
  if not found then raise exception 'not_found'; end if;
  if v_take.status <> 'in_progress' then raise exception 'already_closed'; end if;
  insert into public.stock_movements (business_id, product_id, change, reason, reference_id, created_by)
  select i.business_id, i.product_id, i.counted - p.stock_quantity, 'stocktake', p_stocktake, auth.uid()
  from public.stocktake_items i join public.products p on p.id = i.product_id
  where i.stocktake_id = p_stocktake and i.counted is not null and i.counted <> p.stock_quantity;
  update public.stocktakes set status = 'completed', completed_at = now() where id = p_stocktake;
end;
$$;

grant execute on function public.receive_stock_order(uuid) to authenticated;
grant execute on function public.complete_stocktake(uuid) to authenticated;
revoke all on function public.receive_stock_order(uuid) from anon;
revoke all on function public.complete_stocktake(uuid) from anon;

-- Gift cards, packages and memberships: sold at checkout, redeemed later.
-- Balances and remaining sessions are derived from append-only redemption rows via triggers.

-- ─── Gift cards ─────────────────────────────────────────────────────────────
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{8}$'),
  initial_value numeric not null check (initial_value > 0),
  balance numeric not null check (balance >= 0),
  client_id uuid references public.clients(id) on delete set null,
  recipient_name text,
  message text,
  expires_on date,
  status text not null default 'active' check (status in ('active', 'void')),
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- ─── Packages ───────────────────────────────────────────────────────────────
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  price numeric not null check (price >= 0),
  valid_days integer check (valid_days is null or valid_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.package_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  sessions integer not null check (sessions between 1 and 100),
  unique (package_id, service_id)
);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid references public.packages(id) on delete set null,
  name text not null,
  price numeric not null default 0,
  sale_id uuid references public.sales(id) on delete set null,
  expires_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.client_package_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  sessions_total integer not null check (sessions_total > 0),
  sessions_used integer not null default 0 check (sessions_used >= 0 and sessions_used <= sessions_total)
);

create table if not exists public.package_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_package_item_id uuid not null references public.client_package_items(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  sessions integer not null default 1 check (sessions > 0),
  created_at timestamptz not null default now()
);

-- ─── Memberships ────────────────────────────────────────────────────────────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  price numeric not null check (price >= 0),
  duration_days integer not null check (duration_days between 1 and 3660),
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  name text not null,
  discount_percent numeric not null,
  price numeric not null default 0,
  sale_id uuid references public.sales(id) on delete set null,
  starts_on date not null default current_date,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint client_memberships_dates check (ends_on >= starts_on)
);

do $$
declare t text;
begin
  foreach t in array array['gift_cards', 'gift_card_redemptions', 'packages', 'package_items', 'client_packages',
                           'client_package_items', 'package_redemptions', 'memberships', 'client_memberships'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- Redemption ledgers are append-only for the app.
revoke update, delete on public.gift_card_redemptions from authenticated;
revoke update, delete on public.package_redemptions from authenticated;
-- Balances and sessions only change through redemptions: the app may update the other columns only.
revoke update on public.gift_cards from authenticated;
grant update (status, recipient_name, message, expires_on, client_id) on public.gift_cards to authenticated;
revoke update on public.client_package_items from authenticated;

create or replace function public.apply_gift_card_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_card public.gift_cards%rowtype;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and business_id = new.business_id) then
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
drop trigger if exists gift_card_redemptions_apply on public.gift_card_redemptions;
create trigger gift_card_redemptions_apply before insert on public.gift_card_redemptions
  for each row execute function public.apply_gift_card_redemption();

create or replace function public.apply_package_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item public.client_package_items%rowtype; v_expires date;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and business_id = new.business_id) then
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
drop trigger if exists package_redemptions_apply on public.package_redemptions;
create trigger package_redemptions_apply before insert on public.package_redemptions
  for each row execute function public.apply_package_redemption();

-- Sets the starting balance on insert (callers can't choose a balance different from the value).
create or replace function public.gift_card_set_balance()
returns trigger language plpgsql as $$
begin
  new.balance := new.initial_value;
  return new;
end;
$$;
drop trigger if exists gift_cards_set_balance on public.gift_cards;
create trigger gift_cards_set_balance before insert on public.gift_cards
  for each row execute function public.gift_card_set_balance();

-- New, unused 8-character code for a business (no 0/O/1/I to avoid misreading).
create or replace function public.new_gift_card_code(p_business uuid)
returns text language plpgsql volatile security invoker set search_path = public as $$
declare v_code text; v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v_code := (select string_agg(substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1), '')
               from generate_series(1, 8));
    exit when not exists (select 1 from public.gift_cards where business_id = p_business and code = v_code);
  end loop;
  return v_code;
end;
$$;
grant execute on function public.new_gift_card_code(uuid) to authenticated;
revoke all on function public.new_gift_card_code(uuid) from anon;

-- Repeating appointments: occurrences share a series_id (the first appointment's id) and the rule
-- that created them, e.g. {"unit":"week","every":1,"count":6} or {"unit":"month","every":1,"until":"2027-01-31"}.
alter table public.appointments add column if not exists series_id uuid;
alter table public.appointments add column if not exists repeat_rule jsonb;
create index if not exists appointments_series_idx on public.appointments (series_id) where series_id is not null;

-- Marketing → Deals: discount codes for checkout and online booking.

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  discount_type text not null check (discount_type in ('percent', 'amount')),
  value numeric not null check (value > 0),
  applies_to text not null default 'services' check (applies_to in ('services', 'all')),
  starts_on date,
  ends_on date,
  max_uses integer check (max_uses is null or max_uses > 0),
  online boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, code),
  constraint deals_dates check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint deals_percent check (discount_type <> 'percent' or value <= 100)
);

create table if not exists public.deal_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['deals', 'deal_redemptions'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;
revoke update, delete on public.deal_redemptions from authenticated;

-- A deal that can be used now, or an exception naming why not. Locks the deal row so usage limits hold.
create or replace function public.usable_deal(p_business uuid, p_code text, p_online boolean)
returns public.deals
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_deal public.deals%rowtype; v_used int;
begin
  select * into v_deal from public.deals
    where business_id = p_business and code = upper(trim(p_code)) and is_active
    for update;
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
revoke all on function public.usable_deal(uuid, text, boolean) from public, anon, authenticated;

-- Checkout: validate a code for the signed-in business (staff only).
create or replace function public.check_deal(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null then raise exception 'not_allowed'; end if;
  v_deal := public.usable_deal(v_business, p_code, false);
  return jsonb_build_object('id', v_deal.id, 'name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type,
                            'value', v_deal.value, 'applies_to', v_deal.applies_to);
end;
$$;
revoke all on function public.check_deal(text) from public, anon;
grant execute on function public.check_deal(text) to authenticated;

-- Booking page: preview a code before booking.
create or replace function public.check_booking_deal(p_slug text, p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then raise exception 'booking_unavailable'; end if;
  v_deal := public.usable_deal(v_business, p_code, true);
  return jsonb_build_object('name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type, 'value', v_deal.value);
end;
$$;
revoke all on function public.check_booking_deal(text, text) from public;
grant execute on function public.check_booking_deal(text, text) to anon, authenticated;

-- create_booking gains an optional promo code: the discount is applied to the booked prices
-- (spread across services in proportion) and recorded as a redemption.
drop function if exists public.create_booking(text, jsonb, timestamptz, jsonb, text);
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
  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;

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

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;

-- Checkout: record a code's use against a completed sale, re-checking limits atomically.
create or replace function public.redeem_deal(p_code text, p_sale uuid, p_amount numeric)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.sales where id = p_sale and business_id = v_business) then
    raise exception 'not_allowed';
  end if;
  v_deal := public.usable_deal(v_business, p_code, false);
  insert into public.deal_redemptions (business_id, deal_id, sale_id, amount)
  values (v_business, v_deal.id, p_sale, greatest(0, p_amount));
end;
$$;
revoke all on function public.redeem_deal(text, uuid, numeric) from public, anon;
grant execute on function public.redeem_deal(text, uuid, numeric) to authenticated;

-- In-app notifications for the business: online bookings, client changes, low stock.
-- Written by triggers/functions (never by the browser), read and marked read by staff.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('online_booking', 'client_cancelled', 'client_rescheduled', 'low_stock')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_business_idx on public.notifications (business_id, created_at desc);

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "Business members read notifications" on public.notifications;
create policy "Business members read notifications" on public.notifications for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Summary line for an appointment: "Ada · Haircut · Mon 21 Oct 10:30".
create or replace function public.appointment_summary(p_appointment uuid)
returns text language sql stable security definer set search_path = public as $$
  select concat_ws(' · ',
    coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''), 'Walk-in'),
    (select string_agg(s.name, ', ' order by i.sort_order) from public.appointment_items i
       left join public.services s on s.id = i.service_id where i.appointment_id = a.id),
    (select to_char(min(i.start_time) at time zone coalesce(b.timezone, 'Africa/Lagos'), 'Dy DD Mon HH24:MI')
       from public.appointment_items i where i.appointment_id = a.id))
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  left join public.clients c on c.id = a.client_id
  where a.id = p_appointment;
$$;
revoke all on function public.appointment_summary(uuid) from public, anon, authenticated;

create or replace function public.notify(p_business uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.notifications (business_id, kind, title, body, link) values (p_business, p_kind, p_title, p_body, p_link);
$$;
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Online bookings and client self-service changes arrive through these functions, so notify there.
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

-- Wrap cancel/reschedule so staff hear about client changes.
alter function public.cancel_booking(uuid, text) rename to cancel_booking_core;
alter function public.reschedule_booking(uuid, timestamptz) rename to reschedule_booking_core;
revoke all on function public.cancel_booking_core(uuid, text) from public, anon, authenticated;
revoke all on function public.reschedule_booking_core(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.cancel_booking(p_token uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_appt public.appointments%rowtype;
begin
  v_result := public.cancel_booking_core(p_token, p_reason);
  select * into v_appt from public.appointments where manage_token = p_token;
  perform public.notify(v_appt.business_id, 'client_cancelled', 'Client cancelled online',
    public.appointment_summary(v_appt.id) || coalesce(' · "' || nullif(trim(p_reason), '') || '"', ''),
    '/calendar?appointment=' || v_appt.id);
  return v_result;
end;
$$;

create or replace function public.reschedule_booking(p_token uuid, p_start timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_appt public.appointments%rowtype;
begin
  v_result := public.reschedule_booking_core(p_token, p_start);
  select * into v_appt from public.appointments where manage_token = p_token;
  perform public.notify(v_appt.business_id, 'client_rescheduled', 'Client rescheduled online',
    'Now ' || public.appointment_summary(v_appt.id), '/calendar?appointment=' || v_appt.id);
  return v_result;
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.cancel_booking(uuid, text) to anon, authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to anon, authenticated;

-- Low stock: when a tracked product falls to (or below) its warning level.
create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.track_stock and new.low_stock_threshold is not null
     and new.stock_quantity <= new.low_stock_threshold
     and old.stock_quantity > coalesce(old.low_stock_threshold, new.low_stock_threshold) then
    perform public.notify(new.business_id, 'low_stock',
      case when new.stock_quantity <= 0 then new.name || ' is out of stock' else new.name || ' is running low' end,
      new.stock_quantity || ' left', '/catalog?tab=products');
  end if;
  return new;
end;
$$;
revoke all on function public.notify_low_stock() from public, anon, authenticated;
drop trigger if exists products_low_stock on public.products;
create trigger products_low_stock after update of stock_quantity on public.products
  for each row execute function public.notify_low_stock();

-- Sales → Tax rates. Prices include tax (Fresha's default for Nigeria); checkout shows the tax part
-- of each price and stores the sale's total tax.
create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  rate numeric not null check (rate >= 0 and rate <= 100),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

grant select, insert, update, delete on public.tax_rates to authenticated;
grant all on public.tax_rates to service_role;
alter table public.tax_rates enable row level security;
drop policy if exists "Business members manage tax_rates" on public.tax_rates;
create policy "Business members manage tax_rates" on public.tax_rates for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

alter table public.businesses add column if not exists default_tax_rate_id uuid references public.tax_rates(id) on delete set null;
alter table public.businesses add column if not exists receipt_footer text;
alter table public.services add column if not exists tax_rate_id uuid references public.tax_rates(id) on delete set null;
alter table public.products add column if not exists tax_rate_id uuid references public.tax_rates(id) on delete set null;
alter table public.sale_items add column if not exists tax_amount numeric not null default 0;
alter table public.sales add column if not exists tax_amount numeric not null default 0;
alter table public.sales add column if not exists discount_amount numeric not null default 0;

-- Team → Timesheets, commissions and pay runs.

alter table public.team_members add column if not exists hourly_rate numeric check (hourly_rate is null or hourly_rate >= 0);
alter table public.team_members add column if not exists service_commission_percent numeric
  check (service_commission_percent is null or (service_commission_percent >= 0 and service_commission_percent <= 100));
alter table public.team_members add column if not exists product_commission_percent numeric
  check (product_commission_percent is null or (product_commission_percent >= 0 and product_commission_percent <= 100));

-- Who performed each sold item (for commission); checkout fills it from the cart line.
alter table public.sale_items add column if not exists team_member_id uuid references public.team_members(id) on delete set null;

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  notes text,
  created_at timestamptz not null default now(),
  constraint timesheets_order check (clock_out is null or clock_out > clock_in),
  constraint timesheets_length check (clock_out is null or clock_out - clock_in <= interval '24 hours')
);
create index if not exists timesheets_member_idx on public.timesheets (team_member_id, clock_in desc);
-- At most one open (not clocked out) entry per person.
create unique index if not exists timesheets_one_open on public.timesheets (team_member_id) where clock_out is null;

create table if not exists public.pay_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint pay_runs_period check (period_end >= period_start)
);

create table if not exists public.pay_run_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete set null,
  member_name text not null,
  hours numeric not null default 0,
  wages numeric not null default 0,
  commission numeric not null default 0,
  tips numeric not null default 0,
  adjustment numeric not null default 0,
  adjustment_note text,
  total numeric not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['timesheets', 'pay_runs', 'pay_run_lines'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- Paid pay runs are locked: no edits to the run or its lines.
create or replace function public.lock_paid_pay_runs()
returns trigger language plpgsql as $$
declare v_status text;
begin
  -- Deleting the whole business cascades here; let that through.
  if tg_op = 'DELETE' and not exists (select 1 from public.businesses where id = old.business_id) then
    return old;
  end if;
  if tg_table_name = 'pay_runs' then
    if old.status = 'paid' then raise exception 'pay_run_locked'; end if;
  else
    select status into v_status from public.pay_runs where id = coalesce(old.pay_run_id, new.pay_run_id);
    if v_status = 'paid' then raise exception 'pay_run_locked'; end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists pay_runs_lock on public.pay_runs;
create trigger pay_runs_lock before update or delete on public.pay_runs
  for each row execute function public.lock_paid_pay_runs();
drop trigger if exists pay_run_lines_lock on public.pay_run_lines;
create trigger pay_run_lines_lock before insert or update or delete on public.pay_run_lines
  for each row execute function public.lock_paid_pay_runs();
