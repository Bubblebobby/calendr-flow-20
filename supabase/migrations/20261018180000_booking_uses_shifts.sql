-- Online booking respects team shifts: time off, closed periods, day edits and repeating schedules.
-- Same precedence as the app (src/lib/team-shifts.ts):
--   closed period > time off > day override > repeating schedule > business opening hours.

create or replace function public.member_day_shifts(p_business uuid, p_member uuid, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shifts jsonb;
  v_schedule public.team_schedules%rowtype;
  v_hours public.business_hours%rowtype;
  v_dow int := extract(dow from p_day)::int;
  v_week_start date;
begin
  if exists (select 1 from public.business_closed_periods
             where business_id = p_business and p_day between start_date and end_date) then
    return '[]'::jsonb;
  end if;
  if exists (select 1 from public.team_time_off
             where team_member_id = p_member and p_day between start_date and end_date) then
    return '[]'::jsonb;
  end if;
  select shifts into v_shifts from public.team_shift_overrides where team_member_id = p_member and date = p_day;
  if found then return v_shifts; end if;

  select * into v_schedule from public.team_schedules
    where team_member_id = p_member and start_date <= p_day and (end_date is null or end_date >= p_day)
    order by start_date desc limit 1;
  if found then
    v_week_start := v_schedule.start_date - (extract(isodow from v_schedule.start_date)::int - 1);
    return coalesce(v_schedule.weeks -> (((p_day - v_week_start) / 7) % v_schedule.repeat_weeks) -> v_dow, '[]'::jsonb);
  end if;

  select * into v_hours from public.business_hours where business_id = p_business and day_of_week = v_dow;
  if not found then
    return case when v_dow = 0 then '[]'::jsonb else '[{"start":"09:00","end":"18:00"}]'::jsonb end;
  end if;
  if not v_hours.is_open or v_hours.open_time is null or v_hours.close_time is null then return '[]'::jsonb; end if;
  return jsonb_build_array(jsonb_build_object(
    'start', to_char(v_hours.open_time, 'HH24:MI'), 'end', to_char(v_hours.close_time, 'HH24:MI')));
end;
$$;

-- True when [p_start, p_end) sits inside one of the member's shifts on that local day.
create or replace function public.member_is_working(p_business uuid, p_member uuid, p_start timestamptz, p_end timestamptz, p_tz text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_start at time zone p_tz)::date = (p_end at time zone p_tz)::date
     and exists (
       select 1
       from jsonb_array_elements(public.member_day_shifts(p_business, p_member, (p_start at time zone p_tz)::date)) s
       where (p_start at time zone p_tz)::time >= (s->>'start')::time
         and ((p_end at time zone p_tz)::time <= (s->>'end')::time or s->>'end' = '24:00')
     );
$$;

-- Each active team member's shifts per day, for the booking page.
create or replace function public.get_booking_availability(p_slug text, p_from date, p_to date)
returns table (team_member_id uuid, day date, shifts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, d::date, public.member_day_shifts(b.id, t.id, d::date)
  from public.businesses b
  join public.team_members t on t.business_id = b.id and t.is_active
  cross join generate_series(p_from, least(p_to, p_from + 31), interval '1 day') d
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled and p_to >= p_from;
$$;

create or replace function public.create_booking(
  p_slug text,
  p_items jsonb,
  p_start timestamptz,
  p_client jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_tz text;
  v_client_id uuid;
  v_appointment_id uuid;
  v_cursor timestamptz := p_start;
  v_item jsonb;
  v_service public.services%rowtype;
  v_member uuid;
  v_end timestamptz;
  v_first text := nullif(trim(p_client->>'first_name'), '');
  v_last text := nullif(trim(p_client->>'last_name'), '');
  v_email text := lower(nullif(trim(p_client->>'email'), ''));
  v_phone text := nullif(regexp_replace(coalesce(p_client->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_sort int := 0;
begin
  select * into v_business from public.businesses
    where booking_slug = lower(p_slug) and online_booking_enabled;
  if not found then raise exception 'booking_unavailable'; end if;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');

  if v_first is null or length(v_first) > 100 or coalesce(length(v_last), 0) > 100 then
    raise exception 'invalid_client';
  end if;
  if v_email is null and v_phone is null then raise exception 'contact_required'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 6 then
    raise exception 'invalid_services';
  end if;

  select id into v_client_id from public.clients
    where business_id = v_business.id
      and ((v_email is not null and lower(email) = v_email) or (v_phone is not null and phone = v_phone))
    order by created_at limit 1;
  if v_client_id is null then
    insert into public.clients (business_id, first_name, last_name, email, phone, client_source)
    values (v_business.id, v_first, v_last, v_email, v_phone, 'online_booking')
    returning id into v_client_id;
  end if;

  insert into public.appointments (business_id, client_id, is_walk_in, status, notes)
  values (v_business.id, v_client_id, false, 'booked', left(nullif(trim(p_notes), ''), 1000))
  returning id into v_appointment_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service from public.services
      where id = (v_item->>'service_id')::uuid and business_id = v_business.id
        and not is_archived and online_booking_enabled;
    if not found then raise exception 'invalid_services'; end if;
    v_end := v_cursor + make_interval(mins => v_service.duration_minutes);

    v_member := nullif(v_item->>'team_member_id', '')::uuid;
    if v_member is null then
      select t.id into v_member
      from public.team_members t
      where t.business_id = v_business.id and t.is_active
        and (not exists (select 1 from public.service_team_members x where x.service_id = v_service.id)
             or exists (select 1 from public.service_team_members x
                        where x.service_id = v_service.id and x.team_member_id = t.id))
        and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)
        and not exists (select 1 from public.appointment_items i
                        where i.team_member_id = t.id and i.is_blocking
                          and tstzrange(i.start_time, i.end_time) && tstzrange(v_cursor, v_end))
        and not exists (select 1 from public.blocked_times bt
                        where bt.team_member_id = t.id and not bt.online_booking_allowed
                          and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end))
      order by t.created_at
      limit 1;
      if v_member is null then
        -- Nobody free: say whether it's because nobody works then, or everyone is booked.
        if exists (select 1 from public.team_members t
                   where t.business_id = v_business.id and t.is_active
                     and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)) then
          raise exception 'slot_taken';
        end if;
        raise exception 'outside_hours';
      end if;
    else
      if not exists (select 1 from public.team_members t
                     where t.id = v_member and t.business_id = v_business.id and t.is_active) then
        raise exception 'invalid_team_member';
      end if;
      if not public.member_is_working(v_business.id, v_member, v_cursor, v_end, v_tz) then
        raise exception 'outside_hours';
      end if;
      if exists (select 1 from public.blocked_times bt
                 where bt.team_member_id = v_member and not bt.online_booking_allowed
                   and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
        raise exception 'slot_taken';
      end if;
    end if;

    begin
      insert into public.appointment_items
        (appointment_id, business_id, service_id, team_member_id, start_time, end_time, price, sort_order)
      values
        (v_appointment_id, v_business.id, v_service.id, v_member, v_cursor, v_end,
         case when v_service.pricing_type = 'free' then 0 else v_service.price end, v_sort);
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;

    v_cursor := v_end;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('appointment_id', v_appointment_id, 'start', p_start, 'end', v_cursor);
end;
$$;

revoke all on function public.member_day_shifts(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.member_is_working(uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.get_booking_availability(text, date, date) from public;
grant execute on function public.get_booking_availability(text, date, date) to anon, authenticated;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text) to anon, authenticated;
