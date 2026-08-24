ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS additional_email text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS additional_phone text,
  ADD COLUMN IF NOT EXISTS additional_phone_country_code text,
  ADD COLUMN IF NOT EXISTS birth_day integer,
  ADD COLUMN IF NOT EXISTS birth_month integer,
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS client_source text NOT NULL DEFAULT 'walk_in',
  ADD COLUMN IF NOT EXISTS referred_by_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_path text;

CREATE TABLE public.client_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_tags TO authenticated;
GRANT ALL ON public.client_tags TO service_role;
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view client tags" ON public.client_tags
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_tags.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can manage client tags" ON public.client_tags
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_tags.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_tags.business_id AND b.owner_id = auth.uid()));

CREATE TRIGGER update_client_tags_updated_at BEFORE UPDATE ON public.client_tags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.client_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.client_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_tag_assignments TO authenticated;
GRANT ALL ON public.client_tag_assignments TO service_role;
ALTER TABLE public.client_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view client tag assignments" ON public.client_tag_assignments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_tag_assignments.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can manage client tag assignments" ON public.client_tag_assignments
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_tag_assignments.business_id AND b.owner_id = auth.uid()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = client_tag_assignments.business_id AND b.owner_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_tag_assignments.client_id AND c.business_id = client_tag_assignments.business_id)
  AND EXISTS (SELECT 1 FROM public.client_tags t WHERE t.id = client_tag_assignments.tag_id AND t.business_id = client_tag_assignments.business_id)
);

CREATE INDEX IF NOT EXISTS client_tag_assignments_client_idx ON public.client_tag_assignments(client_id);
CREATE INDEX IF NOT EXISTS client_tags_business_idx ON public.client_tags(business_id);