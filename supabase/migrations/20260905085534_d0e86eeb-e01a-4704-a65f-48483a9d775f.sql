create extension if not exists btree_gist;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  is_walk_in boolean not null default false,
  status text not null default 'booked'
    check (status in ('booked','confirmed','arrived','started','completed','no_show','cancelled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  bundle_id uuid references public.bundles(id) on delete set null,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  price numeric,
  sort_order integer not null default 0,
  is_blocking boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_items_time_valid check (end_time > start_time),
  constraint appointment_items_no_overlap exclude using gist (
    team_member_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (is_blocking)
);

create index appointment_items_business_start_idx on public.appointment_items (business_id, start_time);
create index appointments_business_idx on public.appointments (business_id);

grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
grant select, insert, update, delete on public.appointment_items to authenticated;
grant all on public.appointment_items to service_role;

alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;

create policy "Business members manage appointments"
  on public.appointments for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

create policy "Business members manage appointment items"
  on public.appointment_items for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

create or replace function public.sync_appointment_items_blocking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update public.appointment_items
      set is_blocking = (new.status not in ('cancelled','no_show')),
          updated_at = now()
    where appointment_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_appointment_items_blocking() from public, anon, authenticated;

create trigger on_appointment_status_change
  after update on public.appointments
  for each row execute function public.sync_appointment_items_blocking();

create trigger update_appointments_updated_at
  before update on public.appointments
  for each row execute function public.update_updated_at_column();

create trigger update_appointment_items_updated_at
  before update on public.appointment_items
  for each row execute function public.update_updated_at_column();