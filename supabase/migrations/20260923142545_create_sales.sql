CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id uuid UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  is_walk_in boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  payment_method text NOT NULL DEFAULT 'cash',
  total numeric NOT NULL DEFAULT 0,
  notes text,
  sale_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_status_check CHECK (status IN ('draft','completed','refunded')),
  CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash','card','other'))
);

CREATE INDEX sales_business_idx ON public.sales (business_id, sale_date DESC);
CREATE INDEX sales_client_idx ON public.sales (client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage sales"
ON public.sales FOR ALL TO authenticated
USING (business_id IN (SELECT profiles.business_id FROM public.profiles WHERE profiles.id = auth.uid()))
WITH CHECK (business_id IN (SELECT profiles.business_id FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  appointment_item_id uuid REFERENCES public.appointment_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_quantity_check CHECK (quantity > 0)
);

CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_business_idx ON public.sale_items (business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage sale items"
ON public.sale_items FOR ALL TO authenticated
USING (business_id IN (SELECT profiles.business_id FROM public.profiles WHERE profiles.id = auth.uid()))
WITH CHECK (business_id IN (SELECT profiles.business_id FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_sales_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_set_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.touch_sales_updated_at();