-- Run this once in Supabase → SQL Editor (new project lfzpkqqzbdasxskhcqeh).
-- It applies the two migrations added after the project was created.

-- Catalog: archive services and categories instead of deleting them (Fresha's Archive action).
alter table public.services add column if not exists is_archived boolean not null default false;
alter table public.service_categories add column if not exists is_archived boolean not null default false;

-- Online booking: a public booking page at /book/<slug>.
-- Clients never touch tables directly; three security-definer functions expose exactly what the
-- page needs (menu, busy times, create booking) and only for businesses that have published.

alter table public.businesses add column if not exists booking_slug text;
alter table public.businesses add column if not exists online_booking_enabled boolean not null default false;
alter table public.businesses add column if not exists booking_description text;
alter table public.services add column if not exists online_booking_enabled boolean not null default true;

create unique index if not exists businesses_booking_slug_key on public.businesses (booking_slug);
alter table public.businesses drop constraint if exists businesses_booking_slug_format;
alter table public.businesses add constraint businesses_booking_slug_format
  check (booking_slug is null or booking_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

-- 1. The menu: business, opening hours, categories, bookable services and team (names only).
create or replace function public.get_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'currency', b.currency,
      'country', b.country,
      'timezone', coalesce(b.timezone, 'Africa/Lagos'),
      'description', b.booking_description,
      'location', b.location
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', h.day_of_week, 'open', h.is_open, 'from', h.open_time, 'to', h.close_time)), '[]'::jsonb)
      from public.business_hours h where h.business_id = b.id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
        order by c.sort_order, c.created_at), '[]'::jsonb)
      from public.service_categories c where c.business_id = b.id and not c.is_archived
    ),
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'category_id', s.category_id,
          'pricing_type', s.pricing_type,
          'price', s.price,
          'duration', s.duration_minutes,
          'team', (select coalesce(jsonb_agg(stm.team_member_id), '[]'::jsonb)
                   from public.service_team_members stm where stm.service_id = s.id)
        ) order by s.sort_order, s.created_at), '[]'::jsonb)
      from public.services s
      left join public.service_categories c on c.id = s.category_id
      where s.business_id = b.id and not s.is_archived and s.online_booking_enabled
        and coalesce(c.is_archived, false) = false
    ),
    'team', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.id, 'first_name', t.first_name, 'last_name', t.last_name,
          'initials', t.initials, 'color', t.avatar_color, 'job_title', t.job_title
        ) order by t.created_at), '[]'::jsonb)
      from public.team_members t where t.business_id = b.id and t.is_active
    )
  )
  from public.businesses b
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled;
$$;

-- 2. Busy intervals per team member (no client details) so the page can offer free slots.
create or replace function public.get_booking_busy(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (team_member_id uuid, start_time timestamptz, end_time timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.team_member_id, i.start_time, i.end_time
  from public.appointment_items i
  join public.businesses b on b.id = i.business_id
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled
    and i.is_blocking and i.start_time < p_to and i.end_time > p_from
    and p_to - p_from <= interval '32 days'
  union all
  select bt.team_member_id, bt.start_time, bt.end_time
  from public.blocked_times bt
  join public.businesses b on b.id = bt.business_id
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled
    and not bt.online_booking_allowed
    and bt.start_time < p_to and bt.end_time > p_from
    and p_to - p_from <= interval '32 days';
$$;

-- 3. Create the booking. Services run back to back from p_start. A null team member means
--    "any professional": the first active member who can do the service and is free.
create or replace function public.create_booking(
  p_slug text,
  p_items jsonb,          -- [{ "service_id": uuid, "team_member_id": uuid | null }]
  p_start timestamptz,
  p_client jsonb,         -- { first_name, last_name, email, phone }
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

  -- Reuse the client record when the email or phone matches, otherwise create one.
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

    -- Must sit inside opening hours (defaults: Mon–Sat 09:00–18:00).
    if not exists (
      select 1 from (
        select coalesce(h.is_open, d.dow between 1 and 6) as is_open,
               coalesce(h.open_time, time '09:00') as open_time,
               coalesce(h.close_time, time '18:00') as close_time
        from (select extract(dow from v_cursor at time zone v_tz)::int as dow) d
        left join public.business_hours h on h.business_id = v_business.id and h.day_of_week = d.dow
      ) hrs
      where hrs.is_open
        and (v_cursor at time zone v_tz)::time >= hrs.open_time
        and (v_end at time zone v_tz)::time <= hrs.close_time
        and (v_cursor at time zone v_tz)::date = (v_end at time zone v_tz)::date
    ) then
      raise exception 'outside_hours';
    end if;

    v_member := nullif(v_item->>'team_member_id', '')::uuid;
    if v_member is null then
      select t.id into v_member
      from public.team_members t
      where t.business_id = v_business.id and t.is_active
        and (not exists (select 1 from public.service_team_members x where x.service_id = v_service.id)
             or exists (select 1 from public.service_team_members x
                        where x.service_id = v_service.id and x.team_member_id = t.id))
        and not exists (select 1 from public.appointment_items i
                        where i.team_member_id = t.id and i.is_blocking
                          and tstzrange(i.start_time, i.end_time) && tstzrange(v_cursor, v_end))
        and not exists (select 1 from public.blocked_times bt
                        where bt.team_member_id = t.id and not bt.online_booking_allowed
                          and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end))
      order by t.created_at
      limit 1;
      if v_member is null then raise exception 'slot_taken'; end if;
    else
      if not exists (select 1 from public.team_members t
                     where t.id = v_member and t.business_id = v_business.id and t.is_active) then
        raise exception 'invalid_team_member';
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

revoke all on function public.get_booking_page(text) from public;
revoke all on function public.get_booking_busy(text, timestamptz, timestamptz) from public;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text) from public;
grant execute on function public.get_booking_page(text) to anon, authenticated;
grant execute on function public.get_booking_busy(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text) to anon, authenticated;
