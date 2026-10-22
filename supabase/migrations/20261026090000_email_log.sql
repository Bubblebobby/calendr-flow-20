-- Emails sent through Brevo (booking confirmations, cancellations, reschedules, receipts).
-- One row per email event. dedupe_key is unique, so the same event can only be emailed once
-- (refreshing a confirmation page or replaying a request sends nothing). Receipts have no
-- dedupe_key and are rate limited by the server instead.
-- Only the server (service role) reads or writes this table.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  sale_id uuid references public.sales (id) on delete cascade,
  kind text not null check (kind in ('booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'receipt')),
  dedupe_key text unique,
  recipients text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists email_log_sale_recent on public.email_log (sale_id, created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
