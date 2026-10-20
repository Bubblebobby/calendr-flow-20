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
