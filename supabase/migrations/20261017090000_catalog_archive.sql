-- Catalog: archive services and categories instead of deleting them (Fresha's Archive action).
alter table public.services add column if not exists is_archived boolean not null default false;
alter table public.service_categories add column if not exists is_archived boolean not null default false;
