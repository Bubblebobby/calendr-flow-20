-- Bookly update, 20 Oct 2026 (part 2): profile safeguard + customer accounts.
-- Safe to run more than once.

-- Security: profiles.business_id decides which salon's data a login can read, and users may
-- edit their own profile row. Only let a signed-in user point it at a business they own.
-- Team invites are accepted server-side with the service key, which this doesn't restrict.

-- Not security definer on purpose: current_user must be the caller's role.
create or replace function public.guard_profile_business()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
     and not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid())
  then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_business_guard on public.profiles;
create trigger profiles_business_guard
  before insert or update of business_id on public.profiles
  for each row execute function public.guard_profile_business();

-- Customer accounts: one Bookly login across every salon a person books with.
-- Appointments, gift cards, packages and memberships reach the account through the salon's
-- client record, which is linked once its email matches the account's confirmed email.

-- ── Profile details customers manage themselves ──
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists email_reminders boolean not null default true;
alter table public.profiles add column if not exists marketing_emails boolean not null default false;

-- ── Client records ↔ customer accounts ──
alter table public.clients add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists clients_user_id_idx on public.clients (user_id) where user_id is not null;

-- Links every unclaimed client record with this account's confirmed email. Safe to repeat.
create or replace function public.link_my_clients()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email = '' then return 0; end if;
  update public.clients set user_id = auth.uid() where user_id is null and lower(email) = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Favourite salons ──
create table if not exists public.favorite_businesses (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
grant select, insert, delete on public.favorite_businesses to authenticated;
grant all on public.favorite_businesses to service_role;
alter table public.favorite_businesses enable row level security;
drop policy if exists "Customers manage their favourites" on public.favorite_businesses;
create policy "Customers manage their favourites" on public.favorite_businesses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Reviews (written by customers for completed appointments, shown on the salon page) ──
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  services text,
  team_member_name text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_business_idx on public.reviews (business_id, created_at desc);
grant select on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
drop policy if exists "Business members read reviews" on public.reviews;
create policy "Business members read reviews" on public.reviews for select to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Staff hear about new reviews in the top-bar notifications.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('online_booking', 'client_cancelled', 'client_rescheduled', 'low_stock', 'review'));

create or replace function public.submit_review(p_appointment uuid, p_rating integer, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_author text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'invalid_rating'; end if;

  select a.id, a.business_id, a.status, c.first_name, c.last_name
    into v_appt
    from public.appointments a
    join public.clients c on c.id = a.client_id
   where a.id = p_appointment and c.user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if v_appt.status <> 'completed' then raise exception 'not_completed'; end if;
  if exists (select 1 from public.reviews where appointment_id = p_appointment) then raise exception 'already_reviewed'; end if;

  -- First name and last initial, from the account or else the salon's client record.
  select nullif(trim(full_name), '') into v_author from public.profiles where id = auth.uid();
  v_author := coalesce(v_author, concat_ws(' ', v_appt.first_name, v_appt.last_name));
  v_author := split_part(v_author, ' ', 1)
    || case when split_part(v_author, ' ', 2) <> '' then ' ' || left(split_part(v_author, ' ', 2), 1) || '.' else '' end;

  insert into public.reviews (business_id, appointment_id, user_id, author_name, rating, comment, services, team_member_name)
  select v_appt.business_id, p_appointment, auth.uid(), v_author, p_rating,
         nullif(trim(coalesce(p_comment, '')), ''),
         string_agg(coalesce(s.name, 'Service'), ', ' order by i.sort_order),
         (array_agg(t.first_name order by i.sort_order))[1]
    from public.appointment_items i
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
   where i.appointment_id = p_appointment
  returning id into v_id;

  perform public.notify(v_appt.business_id, 'review', 'New ' || p_rating || '-star review',
    v_author || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 120), ''), '/calendar?appointment=' || p_appointment);
  return v_id;
end;
$$;

-- ── The signed-in customer's appointments at every salon ──
create or replace function public.my_appointments()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.item order by x.starts desc), '[]'::jsonb)
  from (
    select min(i.start_time) as starts,
      jsonb_build_object(
        'id', a.id,
        'status', a.status,
        'cancellation_reason', a.cancellation_reason,
        'manage_token', a.manage_token,
        'start', min(i.start_time),
        'end', max(i.end_time),
        'total', coalesce(sum(i.price), 0),
        'items', jsonb_agg(jsonb_build_object(
            'service_id', i.service_id,
            'name', coalesce(s.name, 'Service'),
            'price', i.price,
            'minutes', round(extract(epoch from i.end_time - i.start_time) / 60),
            'with', t.first_name
          ) order by i.sort_order, i.start_time),
        'business', jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'slug', case when b.online_booking_enabled then b.booking_slug end,
            'location', b.location,
            'categories', b.categories,
            'currency', b.currency,
            'country', b.country,
            'timezone', coalesce(b.timezone, 'Africa/Lagos'),
            'policy', b.booking_policy,
            'notice_hours', b.booking_notice_hours,
            'allow_cancel', b.allow_client_cancel,
            'allow_reschedule', b.allow_client_reschedule
          ),
        'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment)
                     from public.reviews r where r.appointment_id = a.id)
      ) as item
    from public.appointments a
    join public.clients c on c.id = a.client_id and c.user_id = auth.uid()
    join public.businesses b on b.id = a.business_id
    join public.appointment_items i on i.appointment_id = a.id
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
    where auth.uid() is not null
    group by a.id, b.id
  ) x;
$$;

-- ── Gift cards, packages and memberships the customer owns ──
create or replace function public.my_wallet()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gift_cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', g.id, 'code', g.code, 'balance', g.balance, 'initial', g.initial_value,
          'expires_on', g.expires_on, 'status', g.status, 'recipient', g.recipient_name,
          'business', jsonb_build_object('name', b.name, 'slug', case when b.online_booking_enabled then b.booking_slug end,
                                         'currency', b.currency, 'country', b.country)
        ) order by g.created_at desc), '[]'::jsonb)
      from public.gift_cards g
      join public.clients c on c.id = g.client_id and c.user_id = auth.uid()
      join public.businesses b on b.id = g.business_id
    ),
    'packages', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', cp.id, 'name', cp.name, 'expires_on', cp.expires_on, 'bought', cp.created_at,
          'items', (select coalesce(jsonb_agg(jsonb_build_object(
                        'service', ci.service_name, 'total', ci.sessions_total, 'used', ci.sessions_used)), '[]'::jsonb)
                      from public.client_package_items ci where ci.client_package_id = cp.id),
          'business', jsonb_build_object('name', b.name, 'slug', case when b.online_booking_enabled then b.booking_slug end)
        ) order by cp.created_at desc), '[]'::jsonb)
      from public.client_packages cp
      join public.clients c on c.id = cp.client_id and c.user_id = auth.uid()
      join public.businesses b on b.id = cp.business_id
    ),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', cm.id, 'name', cm.name, 'discount_percent', cm.discount_percent,
          'starts_on', cm.starts_on, 'ends_on', cm.ends_on, 'status', cm.status,
          'business', jsonb_build_object('name', b.name, 'slug', case when b.online_booking_enabled then b.booking_slug end)
        ) order by cm.ends_on desc), '[]'::jsonb)
      from public.client_memberships cm
      join public.clients c on c.id = cm.client_id and c.user_id = auth.uid()
      join public.businesses b on b.id = cm.business_id
    )
  )
  where auth.uid() is not null;
$$;

-- ── Discover: public listing of salons that take online bookings ──
create or replace function public.discover_businesses(
  p_query text default null, p_category text default null, p_city text default null, p_ids uuid[] default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.card order by x.reviews desc, x.created_at desc), '[]'::jsonb)
  from (
    select b.created_at, coalesce(r.cnt, 0) as reviews,
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.booking_slug,
        'categories', b.categories,
        'city', nullif(b.location->>'city', ''),
        'area', coalesce(nullif(b.location->>'district', ''), nullif(b.location->>'city', '')),
        'description', b.booking_description,
        'currency', b.currency,
        'country', b.country,
        'rating', r.avg,
        'review_count', coalesce(r.cnt, 0),
        'from_price', (select min(s.price) from public.services s
                        where s.business_id = b.id and not s.is_archived and s.online_booking_enabled and s.price > 0)
      ) as card
    from public.businesses b
    left join lateral (
      select round(avg(rating)::numeric, 1) as avg, count(*) as cnt from public.reviews where business_id = b.id
    ) r on true
    where b.online_booking_enabled and b.booking_slug is not null
      and (p_ids is null or b.id = any(p_ids))
      and (nullif(trim(coalesce(p_category, '')), '') is null or b.categories ? p_category)
      and (nullif(trim(coalesce(p_city, '')), '') is null
           or b.location->>'city' ilike '%' || trim(p_city) || '%'
           or b.location->>'district' ilike '%' || trim(p_city) || '%'
           or b.location->>'state' ilike '%' || trim(p_city) || '%')
      and (nullif(trim(coalesce(p_query, '')), '') is null
           or b.name ilike '%' || trim(p_query) || '%'
           or exists (select 1 from public.services s
                       where s.business_id = b.id and not s.is_archived and s.online_booking_enabled
                         and s.name ilike '%' || trim(p_query) || '%'))
    limit 60
  ) x;
$$;

-- ── Ratings and recent reviews for a salon's public page ──
create or replace function public.get_venue_reviews(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rating', (select round(avg(rating)::numeric, 1) from public.reviews where business_id = b.id),
    'count', (select count(*) from public.reviews where business_id = b.id),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object(
                    'author', r.author_name, 'rating', r.rating, 'comment', r.comment,
                    'services', r.services, 'with', r.team_member_name, 'created_at', r.created_at
                  ) order by r.created_at desc), '[]'::jsonb)
                from (select * from public.reviews where business_id = b.id order by created_at desc limit 20) r)
  )
  from public.businesses b
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled;
$$;

revoke all on function public.link_my_clients() from public;
revoke all on function public.submit_review(uuid, integer, text) from public;
revoke all on function public.my_appointments() from public;
revoke all on function public.my_wallet() from public;
revoke all on function public.discover_businesses(text, text, text, uuid[]) from public;
revoke all on function public.get_venue_reviews(text) from public;
grant execute on function public.link_my_clients() to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.my_appointments() to authenticated;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.discover_businesses(text, text, text, uuid[]) to anon, authenticated;
grant execute on function public.get_venue_reviews(text) to anon, authenticated;
