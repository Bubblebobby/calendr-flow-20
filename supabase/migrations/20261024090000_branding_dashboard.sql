-- Branding and a customisable Home (24 Oct 2026).
-- 1. Each salon picks a brand colour (one of Bookly's presets) and can upload a logo. Both show
--    on the client-facing pages (booking, salon page, confirmation, manage booking, receipts)
--    and the colour also tints the salon's own dashboard.
-- 2. Each person can arrange their own Home dashboard (which cards, in what order, how wide).

-- ── Brand colour and logo ──
alter table public.businesses add column if not exists brand_color text not null default 'black';
alter table public.businesses drop constraint if exists businesses_brand_color_check;
alter table public.businesses add constraint businesses_brand_color_check check (
  brand_color in ('black', 'navy', 'blue', 'purple', 'plum', 'emerald', 'teal', 'terracotta', 'rose')
);
-- Path inside the public business-logos bucket, e.g. <business_id>/logo-<uuid>.png.
alter table public.businesses add column if not exists logo_path text;

-- Logos appear on public pages, so this bucket is public to read. Only PNG, JPEG and WebP up to
-- 2 MB (no SVG, which can carry scripts). Only the salon owner can add, change or remove files,
-- and only inside their own business folder (the same rule as the other photo buckets).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-logos', 'business-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners read their logos" on storage.objects;
create policy "Owners read their logos" on storage.objects for select to authenticated
  using (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
drop policy if exists "Owners upload their logos" on storage.objects;
create policy "Owners upload their logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
drop policy if exists "Owners update their logos" on storage.objects;
create policy "Owners update their logos" on storage.objects for update to authenticated
  using (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()))
  with check (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
drop policy if exists "Owners delete their logos" on storage.objects;
create policy "Owners delete their logos" on storage.objects for delete to authenticated
  using (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

-- The public booking page and manage-booking link now include the colour and logo.
-- (Same functions as before, with brand_color and logo_path added to 'business'.)
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
      'location', b.location,
      'brand_color', b.brand_color,
      'logo_path', b.logo_path
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
      'brand_color', b.brand_color,
      'logo_path', b.logo_path,
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

-- ── Each person's Home layout ──
-- layout: [{"id": "sales", "hidden": false, "wide": false}, ...] in display order.
create table if not exists public.dashboard_layouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_layout_is_array check (jsonb_typeof(layout) = 'array')
);
alter table public.dashboard_layouts enable row level security;
revoke all on public.dashboard_layouts from anon;
grant select, insert, update, delete on public.dashboard_layouts to authenticated;

drop policy if exists "People read their own layout" on public.dashboard_layouts;
create policy "People read their own layout" on public.dashboard_layouts for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "People save their own layout" on public.dashboard_layouts;
create policy "People save their own layout" on public.dashboard_layouts for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "People change their own layout" on public.dashboard_layouts;
create policy "People change their own layout" on public.dashboard_layouts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "People reset their own layout" on public.dashboard_layouts;
create policy "People reset their own layout" on public.dashboard_layouts for delete to authenticated
  using (user_id = auth.uid());
