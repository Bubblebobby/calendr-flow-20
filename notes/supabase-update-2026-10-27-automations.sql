-- Automated client emails (Marketing → Automations): reminders and appointment updates.
-- 1. email_log accepts the automation kinds, and remembers the start time a client was last told
--    about, so a later change of time can be detected as a reschedule.
-- 2. automation_runs records each run of the scheduler, so the Automations page can show that
--    it's working. Only the server reads or writes it.

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in (
  'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'receipt',
  'appointment_new', 'appointment_rescheduled', 'appointment_cancelled', 'appointment_no_show',
  'appointment_thank_you', 'reminder_3_days', 'reminder_24_hours', 'reminder_1_hour'
));
alter table public.email_log add column if not exists notified_start timestamptz;

create index if not exists email_log_appointment on public.email_log (appointment_id, created_at desc);
create index if not exists appointments_updated_at on public.appointments (updated_at);
create index if not exists appointment_items_start_time on public.appointment_items (start_time);
create index if not exists appointment_items_updated_at on public.appointment_items (updated_at);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  sent integer not null default 0,
  failed integer not null default 0
);
create index if not exists automation_runs_recent on public.automation_runs (ran_at desc);

alter table public.automation_runs enable row level security;
revoke all on public.automation_runs from anon, authenticated;
