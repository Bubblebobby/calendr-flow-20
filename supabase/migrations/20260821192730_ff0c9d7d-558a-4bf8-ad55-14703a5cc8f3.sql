ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS setup_step integer NOT NULL DEFAULT 1;