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
