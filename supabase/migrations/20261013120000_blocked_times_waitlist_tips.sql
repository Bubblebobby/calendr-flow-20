-- Calendar: blocked time
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text,
  block_type text not null default 'custom',
  description text,
  online_booking_allowed boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint blocked_times_end_after_start check (end_time > start_time)
);

create index blocked_times_business_start_idx on public.blocked_times (business_id, start_time);

grant select, insert, update, delete on public.blocked_times to authenticated;
grant all on public.blocked_times to service_role;
alter table public.blocked_times enable row level security;

create policy "Business members manage blocked times"
  on public.blocked_times for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Calendar: waitlist
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  preferred_date date,
  preferred_time text,
  status text not null default 'waiting',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint waitlist_entries_status_check check (status in ('waiting', 'expired', 'booked'))
);

create index waitlist_entries_business_idx on public.waitlist_entries (business_id, created_at desc);

grant select, insert, update, delete on public.waitlist_entries to authenticated;
grant all on public.waitlist_entries to service_role;
alter table public.waitlist_entries enable row level security;

create policy "Business members manage waitlist entries"
  on public.waitlist_entries for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Sales: tips at checkout
alter table public.sales add column tip_amount numeric not null default 0;

-- Appointments: cancellation reason
alter table public.appointments add column cancellation_reason text;
