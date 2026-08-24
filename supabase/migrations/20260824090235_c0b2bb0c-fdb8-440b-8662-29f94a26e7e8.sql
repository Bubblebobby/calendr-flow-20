CREATE TYPE public.bundle_schedule_type AS ENUM ('sequence', 'parallel');
CREATE TYPE public.bundle_pricing_mode AS ENUM ('service_pricing', 'custom', 'percentage_discount', 'free');

CREATE TABLE public.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  description text,
  schedule_type public.bundle_schedule_type NOT NULL DEFAULT 'sequence',
  pricing_mode public.bundle_pricing_mode NOT NULL DEFAULT 'service_pricing',
  custom_price numeric,
  discount_percentage numeric,
  online_booking_enabled boolean NOT NULL DEFAULT false,
  portfolio_image_url text,
  portfolio_image_path text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundles TO authenticated;
GRANT ALL ON public.bundles TO service_role;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view bundles" ON public.bundles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = bundles.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can manage bundles" ON public.bundles FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = bundles.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = bundles.business_id AND b.owner_id = auth.uid()));

CREATE TABLE public.bundle_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_services TO authenticated;
GRANT ALL ON public.bundle_services TO service_role;
ALTER TABLE public.bundle_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view bundle services" ON public.bundle_services FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bundles bu JOIN public.businesses b ON b.id = bu.business_id WHERE bu.id = bundle_services.bundle_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can manage bundle services" ON public.bundle_services FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bundles bu JOIN public.businesses b ON b.id = bu.business_id WHERE bu.id = bundle_services.bundle_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.bundles bu JOIN public.businesses b ON b.id = bu.business_id WHERE bu.id = bundle_services.bundle_id AND b.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_bundles_updated_at BEFORE UPDATE ON public.bundles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
