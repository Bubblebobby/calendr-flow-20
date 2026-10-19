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
