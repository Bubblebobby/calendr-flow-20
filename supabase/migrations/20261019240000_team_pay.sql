-- Team → Timesheets, commissions and pay runs.

alter table public.team_members add column if not exists hourly_rate numeric check (hourly_rate is null or hourly_rate >= 0);
alter table public.team_members add column if not exists service_commission_percent numeric
  check (service_commission_percent is null or (service_commission_percent >= 0 and service_commission_percent <= 100));
alter table public.team_members add column if not exists product_commission_percent numeric
  check (product_commission_percent is null or (product_commission_percent >= 0 and product_commission_percent <= 100));

-- Who performed each sold item (for commission); checkout fills it from the cart line.
alter table public.sale_items add column if not exists team_member_id uuid references public.team_members(id) on delete set null;

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  notes text,
  created_at timestamptz not null default now(),
  constraint timesheets_order check (clock_out is null or clock_out > clock_in),
  constraint timesheets_length check (clock_out is null or clock_out - clock_in <= interval '24 hours')
);
create index if not exists timesheets_member_idx on public.timesheets (team_member_id, clock_in desc);
-- At most one open (not clocked out) entry per person.
create unique index if not exists timesheets_one_open on public.timesheets (team_member_id) where clock_out is null;

create table if not exists public.pay_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint pay_runs_period check (period_end >= period_start)
);

create table if not exists public.pay_run_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete set null,
  member_name text not null,
  hours numeric not null default 0,
  wages numeric not null default 0,
  commission numeric not null default 0,
  tips numeric not null default 0,
  adjustment numeric not null default 0,
  adjustment_note text,
  total numeric not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['timesheets', 'pay_runs', 'pay_run_lines'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- Paid pay runs are locked: no edits to the run or its lines.
create or replace function public.lock_paid_pay_runs()
returns trigger language plpgsql as $$
declare v_status text;
begin
  -- Deleting the whole business cascades here; let that through.
  if tg_op = 'DELETE' and not exists (select 1 from public.businesses where id = old.business_id) then
    return old;
  end if;
  if tg_table_name = 'pay_runs' then
    if old.status = 'paid' then raise exception 'pay_run_locked'; end if;
  else
    select status into v_status from public.pay_runs where id = coalesce(old.pay_run_id, new.pay_run_id);
    if v_status = 'paid' then raise exception 'pay_run_locked'; end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists pay_runs_lock on public.pay_runs;
create trigger pay_runs_lock before update or delete on public.pay_runs
  for each row execute function public.lock_paid_pay_runs();
drop trigger if exists pay_run_lines_lock on public.pay_run_lines;
create trigger pay_run_lines_lock before insert or update or delete on public.pay_run_lines
  for each row execute function public.lock_paid_pay_runs();
