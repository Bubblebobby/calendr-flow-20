-- Bookly update, 22 Oct 2026 (part 3): sale lines can't move between sales or businesses; malformed bookings count.
-- Run after supabase-update-2026-10-22-sale-lock.sql. Safe to run more than once.

-- Fourth review (22 Oct 2026): lines can't be moved between sales or attached to another
-- business's sale, and malformed booking attempts count towards the limit too.

create or replace function public.guard_sale_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales%rowtype;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  -- Lines never move between sales (moving one out of a finished sale would empty it).
  if tg_op = 'UPDATE' and new.sale_id is distinct from old.sale_id then
    raise exception 'sale_locked' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = coalesce(new.sale_id, old.sale_id);
  -- Deleting a whole sale (or business) cascades here; let that through.
  if not found then return coalesce(new, old); end if;
  -- A line belongs to the same business as its sale.
  if tg_op <> 'DELETE' and new.business_id is distinct from v_sale.business_id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_sale.status = 'draft' or public.is_business_admin(v_sale.business_id) then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and v_sale.finalized_by = auth.uid() and v_sale.finalized_at > now() - interval '2 minutes' then
    return new;
  end if;
  raise exception 'sale_locked' using errcode = '42501';
end;
$$;
revoke all on function public.guard_sale_items() from public, anon, authenticated;

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
  exception
    when raise_exception then
      return jsonb_build_object('error', sqlerrm);
    -- Malformed input (a bad service id, say) also counts as an attempt; no internal details.
    when others then
      return jsonb_build_object('error', 'invalid_request');
  end;
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;
