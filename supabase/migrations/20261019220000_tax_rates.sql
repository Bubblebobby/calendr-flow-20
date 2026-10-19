-- Sales → Tax rates. Prices include tax (Fresha's default for Nigeria); checkout shows the tax part
-- of each price and stores the sale's total tax.
create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  rate numeric not null check (rate >= 0 and rate <= 100),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

grant select, insert, update, delete on public.tax_rates to authenticated;
grant all on public.tax_rates to service_role;
alter table public.tax_rates enable row level security;
drop policy if exists "Business members manage tax_rates" on public.tax_rates;
create policy "Business members manage tax_rates" on public.tax_rates for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

alter table public.businesses add column if not exists default_tax_rate_id uuid references public.tax_rates(id) on delete set null;
alter table public.businesses add column if not exists receipt_footer text;
alter table public.services add column if not exists tax_rate_id uuid references public.tax_rates(id) on delete set null;
alter table public.products add column if not exists tax_rate_id uuid references public.tax_rates(id) on delete set null;
alter table public.sale_items add column if not exists tax_amount numeric not null default 0;
alter table public.sales add column if not exists tax_amount numeric not null default 0;
alter table public.sales add column if not exists discount_amount numeric not null default 0;
