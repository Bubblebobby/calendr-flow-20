CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7BD3F7',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  pricing_type text NOT NULL DEFAULT 'fixed',
  price numeric(12,2),
  duration_minutes integer NOT NULL DEFAULT 60,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_categories_business_idx ON public.service_categories(business_id);
CREATE INDEX services_business_idx ON public.services(business_id);
CREATE INDEX services_category_idx ON public.services(category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view service categories" ON public.service_categories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_categories.business_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners can manage service categories" ON public.service_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_categories.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_categories.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can view services" ON public.services
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = services.business_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners can manage services" ON public.services
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = services.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = services.business_id AND b.owner_id = auth.uid()));