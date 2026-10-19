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
