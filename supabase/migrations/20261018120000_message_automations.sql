-- Marketing → Automations: which automated client messages are switched on, per business.
-- Rows are created lazily; a missing row means "use the default" defined in the app.
create table if not exists public.message_automations (
  business_id uuid not null references public.businesses(id) on delete cascade,
  key text not null,
  enabled boolean not null,
  channels text[] not null default array['email']::text[],
  updated_at timestamptz not null default now(),
  primary key (business_id, key),
  constraint message_automations_key_format check (key ~ '^[a-z0-9_]{2,64}$'),
  constraint message_automations_channels check (channels <@ array['email', 'sms', 'whatsapp']::text[])
);

grant select, insert, update, delete on public.message_automations to authenticated;
grant all on public.message_automations to service_role;
alter table public.message_automations enable row level security;

create policy "Business members manage message automations"
  on public.message_automations for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));
