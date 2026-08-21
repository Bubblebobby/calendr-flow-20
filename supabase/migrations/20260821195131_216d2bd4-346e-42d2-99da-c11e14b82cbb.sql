ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;