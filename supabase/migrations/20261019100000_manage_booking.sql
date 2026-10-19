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
