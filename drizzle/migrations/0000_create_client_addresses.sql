CREATE TYPE public.client_address_type AS ENUM ('home', 'work', 'other');

CREATE TABLE public.client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  address_type public.client_address_type NOT NULL DEFAULT 'home',
  address_name text NOT NULL DEFAULT 'Home',
  street_address text NOT NULL,
  apartment_suite text,
  district text,
  city text,
  region text,
  postcode text,
  country text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_addresses_business_id_idx ON public.client_addresses (business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_addresses TO authenticated;
GRANT ALL ON public.client_addresses TO service_role;

ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view client addresses"
ON public.client_addresses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_addresses.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can manage client addresses"
ON public.client_addresses FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_addresses.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_addresses.business_id AND b.owner_id = auth.uid()));