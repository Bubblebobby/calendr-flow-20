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
