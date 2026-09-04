CREATE TABLE public.business_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time,
  close_time time,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (business_id, day_of_week)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT ALL ON public.business_hours TO service_role;

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view their business hours"
ON public.business_hours FOR SELECT TO authenticated
USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Business members can manage their business hours"
ON public.business_hours FOR ALL TO authenticated
USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
);

CREATE TRIGGER update_business_hours_updated_at
BEFORE UPDATE ON public.business_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();