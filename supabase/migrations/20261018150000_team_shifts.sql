-- Team → Scheduled shifts.
-- A team member's working time on a given date is decided in this order:
--   business closed period > time off > one-day override > repeating schedule > business opening hours.
-- Shift lists are JSON arrays of {"start":"HH:MM","end":"HH:MM"}; an empty array means "not working".

create table if not exists public.team_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  repeat_weeks smallint not null default 1 check (repeat_weeks between 1 and 4),
  start_date date not null,
  end_date date,
  -- weeks[n][day] = shift list; day 0 = Sunday … 6 = Saturday; jsonb_array_length(weeks) = repeat_weeks
  weeks jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_schedules_dates check (end_date is null or end_date >= start_date),
  constraint team_schedules_weeks check (jsonb_typeof(weeks) = 'array' and jsonb_array_length(weeks) = repeat_weeks)
);
create index if not exists team_schedules_member_idx on public.team_schedules (team_member_id, start_date);

create table if not exists public.team_shift_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  date date not null,
  shifts jsonb not null default '[]'::jsonb check (jsonb_typeof(shifts) = 'array'),
  created_at timestamptz not null default now(),
  unique (team_member_id, date)
);

create table if not exists public.team_time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type text not null default 'annual_leave',
  notes text,
  created_at timestamptz not null default now(),
  constraint team_time_off_dates check (end_date >= start_date),
  constraint team_time_off_type check (type in ('annual_leave', 'sick', 'personal', 'training', 'other'))
);
create index if not exists team_time_off_member_idx on public.team_time_off (team_member_id, start_date);

create table if not exists public.business_closed_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now(),
  constraint business_closed_periods_dates check (end_date >= start_date)
);

do $$
declare t text;
begin
  foreach t in array array['team_schedules', 'team_shift_overrides', 'team_time_off', 'business_closed_periods'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;
