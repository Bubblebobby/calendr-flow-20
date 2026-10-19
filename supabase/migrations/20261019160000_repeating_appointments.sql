-- Repeating appointments: occurrences share a series_id (the first appointment's id) and the rule
-- that created them, e.g. {"unit":"week","every":1,"count":6} or {"unit":"month","every":1,"until":"2027-01-31"}.
alter table public.appointments add column if not exists series_id uuid;
alter table public.appointments add column if not exists repeat_rule jsonb;
create index if not exists appointments_series_idx on public.appointments (series_id) where series_id is not null;
