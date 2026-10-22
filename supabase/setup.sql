-- Bookly database setup: every migration in supabase/migrations, in order.
-- Paste into a NEW Supabase project's SQL editor and run once.
-- Regenerate with: npm run db:setup-sql

-- ===== 20260819152055_0d2d1d68-31d2-422b-bfdb-5a96ea81b5fa.sql =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  user_type text NOT NULL DEFAULT 'business_owner' CHECK (user_type IN ('business_owner','staff','customer')),
  business_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  country text NOT NULL DEFAULT 'Nigeria',
  currency text NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE TABLE public.team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_roles TO authenticated;
GRANT ALL ON public.team_roles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Owners can view their businesses" ON public.businesses FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert businesses" ON public.businesses FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their businesses" ON public.businesses FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their businesses" ON public.businesses FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Business owners can view team roles" ON public.team_roles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = team_roles.business_id AND b.owner_id = auth.uid()));
CREATE POLICY "Business owners can manage team roles" ON public.team_roles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = team_roles.business_id AND b.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = team_roles.business_id AND b.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, user_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'business_owner')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== 20260819152102_d309f692-e8f3-4282-9cbf-994cbde31aba.sql =====
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ===== 20260821191141_966de653-e4b5-43ba-ab46-b0b523350f1b.sql =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- ===== 20260821192730_ff0c9d7d-558a-4bf8-ad55-14703a5cc8f3.sql =====
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS setup_step integer NOT NULL DEFAULT 1;

-- ===== 20260821193416_b7f3fe21-4fc8-445b-8f34-69b09f8d2bbe.sql =====
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_category text;

-- ===== 20260821193938_8f452ec2-e274-4ad2-80cf-135ae6b563f3.sql =====
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS team_size text;

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  job_title text,
  is_example boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_business_id_idx ON public.employees(business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view employees" ON public.employees
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = employees.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Business owners can manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = employees.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = employees.business_id AND b.owner_id = auth.uid()));

-- ===== 20260821194606_f9dd3fc4-2077-4143-b721-12854742f8fe.sql =====
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS service_locations jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ===== 20260821195131_216d2bd4-346e-42d2-99da-c11e14b82cbb.sql =====
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- ===== 20260821200829_8ccc9761-7106-4558-bb4b-d8fcdf553d34.sql =====
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS migration_source text;

-- ===== 20260821201724_75996d3f-57a5-4160-8138-b7ec7b01b004.sql =====
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS heard_about_source text;

-- ===== 20260822122444_92f203a9-c620-4665-bc4b-ce000c248239.sql =====
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

-- ===== 20260822143921_5ccd0bce-ca41-4054-8293-b4414704ef9b.sql =====
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS treatment_type text;

-- ===== 20260823143421_d180a68b-b917-4978-bf1c-d106367a855c.sql =====
CREATE TYPE public.team_invite_status AS ENUM ('not_invited', 'invited', 'active');

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  initials text GENERATED ALWAYS AS (
    upper(
      coalesce(substring(split_part(btrim(full_name), ' ', 1) from 1 for 1), '') ||
      coalesce(nullif(substring(split_part(btrim(full_name), ' ', 2) from 1 for 1), ''), '')
    )
  ) STORED,
  avatar_color text NOT NULL DEFAULT '#D9F0FA',
  email text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invite_status public.team_invite_status NOT NULL DEFAULT 'not_invited',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view team members" ON public.team_members FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = team_members.business_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners can manage team members" ON public.team_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = team_members.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = team_members.business_id AND b.owner_id = auth.uid()));

CREATE INDEX team_members_business_idx ON public.team_members (business_id);

CREATE TABLE public.service_team_members (
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, team_member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_team_members TO authenticated;
GRANT ALL ON public.service_team_members TO service_role;
ALTER TABLE public.service_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view service team members" ON public.service_team_members FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.services s JOIN public.businesses b ON b.id = s.business_id WHERE s.id = service_team_members.service_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners can manage service team members" ON public.service_team_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.services s JOIN public.businesses b ON b.id = s.business_id WHERE s.id = service_team_members.service_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.services s JOIN public.businesses b ON b.id = s.business_id WHERE s.id = service_team_members.service_id AND b.owner_id = auth.uid()));

CREATE INDEX service_team_members_member_idx ON public.service_team_members (team_member_id);

-- ===== 20260824071522_26bb63e6-35be-40ea-92b8-93decd47ca47.sql =====
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS duration_segments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ===== 20260824083939_541ffc7d-1528-4dca-b9c8-650a9dec116a.sql =====
CREATE TABLE public.service_portfolio_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  draft_id uuid,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  image_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_portfolio_images_service_idx ON public.service_portfolio_images (service_id);
CREATE INDEX service_portfolio_images_draft_idx ON public.service_portfolio_images (draft_id);
CREATE UNIQUE INDEX service_portfolio_images_one_primary ON public.service_portfolio_images (service_id) WHERE is_primary AND service_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_portfolio_images TO authenticated;
GRANT SELECT ON public.service_portfolio_images TO anon;
GRANT ALL ON public.service_portfolio_images TO service_role;

ALTER TABLE public.service_portfolio_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio images are readable"
  ON public.service_portfolio_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Owners can manage portfolio images"
  ON public.service_portfolio_images FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_portfolio_images.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_portfolio_images.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can read portfolio objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'service-portfolio-images'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid())
  );

CREATE POLICY "Owners can upload portfolio objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-portfolio-images'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid())
  );

CREATE POLICY "Owners can update portfolio objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-portfolio-images'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid())
  );

CREATE POLICY "Owners can delete portfolio objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-portfolio-images'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid())
  );

-- ===== 20260824084804_0ed6a28e-4d98-4160-ac3f-f93f6400d544.sql =====
DROP POLICY IF EXISTS "Owners can upload portfolio objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read portfolio objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update portfolio objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete portfolio objects" ON storage.objects;

CREATE POLICY "Owners can upload portfolio objects" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-portfolio-images' AND EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id::text = (storage.foldername(storage.objects.name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can read portfolio objects" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'service-portfolio-images' AND EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id::text = (storage.foldername(storage.objects.name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can update portfolio objects" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'service-portfolio-images' AND EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id::text = (storage.foldername(storage.objects.name))[1] AND b.owner_id = auth.uid()))
WITH CHECK (bucket_id = 'service-portfolio-images' AND EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id::text = (storage.foldername(storage.objects.name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can delete portfolio objects" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-portfolio-images' AND EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id::text = (storage.foldername(storage.objects.name))[1] AND b.owner_id = auth.uid()));

-- ===== 20260824090235_c0b2bb0c-fdb8-440b-8662-29f94a26e7e8.sql =====
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


-- ===== 20260824090309_0b0a1b00-d06b-43fe-910c-aebf3db829a2.sql =====
CREATE POLICY "Owners can read bundle portfolio objects" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can upload bundle portfolio objects" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can update bundle portfolio objects" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()))
WITH CHECK (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can delete bundle portfolio objects" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));


-- ===== 20260824104137_d8a1ee04-8e9b-401a-bd94-44727cf0eb4f.sql =====
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  notes text,
  avatar_color text NOT NULL DEFAULT '#EDE9FE',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX clients_business_id_created_at_idx ON public.clients (business_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view clients" ON public.clients
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can manage clients" ON public.clients
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()));

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260824110349_53d1c582-7791-4a7a-b403-ccd127f64522.sql =====
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

-- ===== 20260829125616_c7322ca1-d569-450b-9c82-35119414582e.sql =====
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.team_roles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_invite_token_key
  ON public.team_members (invite_token)
  WHERE invite_token IS NOT NULL;

-- ===== 20260830090408_b4961059-08ce-499d-9f42-4d9101af0f04.sql =====
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS additional_phone text,
  ADD COLUMN IF NOT EXISTS additional_phone_country_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS calendar_color text NOT NULL DEFAULT '#A5D8F3',
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS external_team_member_id text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_path text;

UPDATE public.team_members
SET first_name = COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), full_name),
    last_name = NULLIF(trim(substring(full_name from position(' ' in full_name) + 1)), '')
WHERE first_name IS NULL;

UPDATE public.team_members SET first_name = 'Team member' WHERE first_name IS NULL OR first_name = '';
UPDATE public.team_members SET last_name = NULL WHERE last_name = full_name;

ALTER TABLE public.team_members ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE public.team_members DROP COLUMN initials;
ALTER TABLE public.team_members DROP COLUMN full_name;
ALTER TABLE public.team_members
  ADD COLUMN initials text GENERATED ALWAYS AS (
    upper(left(first_name, 1)) || upper(coalesce(left(last_name, 1), ''))
  ) STORED;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_notes_length CHECK (notes IS NULL OR char_length(notes) <= 1000);

CREATE POLICY "Business members can read team photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'team-member-photos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]::text
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business members can upload team photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-member-photos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]::text
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business members can update team photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'team-member-photos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]::text
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business members can delete team photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'team-member-photos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]::text
      AND b.owner_id = auth.uid()
  )
);

-- ===== 20260903112437_9214aabf-03bb-4c26-91b7-fe2a50353f06.sql =====
DROP POLICY IF EXISTS "invited_user_can_claim_own_team_member_row" ON public.team_members;
CREATE POLICY "invited_user_can_claim_own_team_member_row"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (user_id IS NULL AND invite_status = 'invited')
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_profile_on_team_member_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.user_id IS NOT NULL AND (old.user_id IS NULL OR old.user_id IS DISTINCT FROM new.user_id) THEN
    UPDATE public.profiles
    SET business_id = new.business_id, user_type = 'staff'
    WHERE id = new.user_id;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_team_member_claimed ON public.team_members;
CREATE TRIGGER on_team_member_claimed
  AFTER UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_on_team_member_claim();

-- ===== 20260903112447_3d0fd47b-d140-4791-8f9b-fd41b930d780.sql =====
REVOKE EXECUTE ON FUNCTION public.sync_profile_on_team_member_claim() FROM PUBLIC, anon, authenticated;

-- ===== 20260904133037_ed86bab3-76e9-4fc3-9d2d-b29b5b649aaa.sql =====
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

-- ===== 20260905085534_d0e86eeb-e01a-4704-a65f-48483a9d775f.sql =====
create extension if not exists btree_gist;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  is_walk_in boolean not null default false,
  status text not null default 'booked'
    check (status in ('booked','confirmed','arrived','started','completed','no_show','cancelled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  bundle_id uuid references public.bundles(id) on delete set null,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  price numeric,
  sort_order integer not null default 0,
  is_blocking boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_items_time_valid check (end_time > start_time),
  constraint appointment_items_no_overlap exclude using gist (
    team_member_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (is_blocking)
);

create index appointment_items_business_start_idx on public.appointment_items (business_id, start_time);
create index appointments_business_idx on public.appointments (business_id);

grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
grant select, insert, update, delete on public.appointment_items to authenticated;
grant all on public.appointment_items to service_role;

alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;

create policy "Business members manage appointments"
  on public.appointments for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

create policy "Business members manage appointment items"
  on public.appointment_items for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

create or replace function public.sync_appointment_items_blocking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update public.appointment_items
      set is_blocking = (new.status not in ('cancelled','no_show')),
          updated_at = now()
    where appointment_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_appointment_items_blocking() from public, anon, authenticated;

create trigger on_appointment_status_change
  after update on public.appointments
  for each row execute function public.sync_appointment_items_blocking();

create trigger update_appointments_updated_at
  before update on public.appointments
  for each row execute function public.update_updated_at_column();

create trigger update_appointment_items_updated_at
  before update on public.appointment_items
  for each row execute function public.update_updated_at_column();

-- ===== 20260918163947_create_client_addresses.sql =====
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

-- ===== 20260923142545_create_sales.sql =====
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

-- ===== 20261013120000_blocked_times_waitlist_tips.sql =====
-- Calendar: blocked time
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text,
  block_type text not null default 'custom',
  description text,
  online_booking_allowed boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint blocked_times_end_after_start check (end_time > start_time)
);

create index blocked_times_business_start_idx on public.blocked_times (business_id, start_time);

grant select, insert, update, delete on public.blocked_times to authenticated;
grant all on public.blocked_times to service_role;
alter table public.blocked_times enable row level security;

create policy "Business members manage blocked times"
  on public.blocked_times for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Calendar: waitlist
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  preferred_date date,
  preferred_time text,
  status text not null default 'waiting',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint waitlist_entries_status_check check (status in ('waiting', 'expired', 'booked'))
);

create index waitlist_entries_business_idx on public.waitlist_entries (business_id, created_at desc);

grant select, insert, update, delete on public.waitlist_entries to authenticated;
grant all on public.waitlist_entries to service_role;
alter table public.waitlist_entries enable row level security;

create policy "Business members manage waitlist entries"
  on public.waitlist_entries for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Sales: tips at checkout
alter table public.sales add column tip_amount numeric not null default 0;

-- Appointments: cancellation reason
alter table public.appointments add column cancellation_reason text;


-- ===== 20261013120100_storage_buckets.sql =====
-- Storage buckets. Lovable created these outside of migrations; a fresh Supabase project needs them.
-- All private: the app reads files through signed URLs. Files live under "<business_id>/...".
insert into storage.buckets (id, name, public)
values
  ('service-portfolio-images', 'service-portfolio-images', false),
  ('bundle-portfolio-images', 'bundle-portfolio-images', false),
  ('team-member-photos', 'team-member-photos', false),
  ('client-photos', 'client-photos', false)
on conflict (id) do nothing;

-- client-photos had no policies in the repo; same rules as team-member-photos.
create policy "Business owners can read client photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'client-photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

create policy "Business owners can upload client photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'client-photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

create policy "Business owners can update client photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'client-photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()))
  with check (bucket_id = 'client-photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

create policy "Business owners can delete client photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-photos' and exists (
    select 1 from public.businesses b where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));


-- ===== 20261017090000_catalog_archive.sql =====
-- Catalog: archive services and categories instead of deleting them (Fresha's Archive action).
alter table public.services add column if not exists is_archived boolean not null default false;
alter table public.service_categories add column if not exists is_archived boolean not null default false;


-- ===== 20261018090000_online_booking.sql =====
-- Online booking: a public booking page at /book/<slug>.
-- Clients never touch tables directly; three security-definer functions expose exactly what the
-- page needs (menu, busy times, create booking) and only for businesses that have published.

alter table public.businesses add column if not exists booking_slug text;
alter table public.businesses add column if not exists online_booking_enabled boolean not null default false;
alter table public.businesses add column if not exists booking_description text;
alter table public.services add column if not exists online_booking_enabled boolean not null default true;

create unique index if not exists businesses_booking_slug_key on public.businesses (booking_slug);
alter table public.businesses drop constraint if exists businesses_booking_slug_format;
alter table public.businesses add constraint businesses_booking_slug_format
  check (booking_slug is null or booking_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

-- 1. The menu: business, opening hours, categories, bookable services and team (names only).
create or replace function public.get_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'currency', b.currency,
      'country', b.country,
      'timezone', coalesce(b.timezone, 'Africa/Lagos'),
      'description', b.booking_description,
      'location', b.location
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', h.day_of_week, 'open', h.is_open, 'from', h.open_time, 'to', h.close_time)), '[]'::jsonb)
      from public.business_hours h where h.business_id = b.id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
        order by c.sort_order, c.created_at), '[]'::jsonb)
      from public.service_categories c where c.business_id = b.id and not c.is_archived
    ),
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'category_id', s.category_id,
          'pricing_type', s.pricing_type,
          'price', s.price,
          'duration', s.duration_minutes,
          'team', (select coalesce(jsonb_agg(stm.team_member_id), '[]'::jsonb)
                   from public.service_team_members stm where stm.service_id = s.id)
        ) order by s.sort_order, s.created_at), '[]'::jsonb)
      from public.services s
      left join public.service_categories c on c.id = s.category_id
      where s.business_id = b.id and not s.is_archived and s.online_booking_enabled
        and coalesce(c.is_archived, false) = false
    ),
    'team', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.id, 'first_name', t.first_name, 'last_name', t.last_name,
          'initials', t.initials, 'color', t.avatar_color, 'job_title', t.job_title
        ) order by t.created_at), '[]'::jsonb)
      from public.team_members t where t.business_id = b.id and t.is_active
    )
  )
  from public.businesses b
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled;
$$;

-- 2. Busy intervals per team member (no client details) so the page can offer free slots.
create or replace function public.get_booking_busy(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (team_member_id uuid, start_time timestamptz, end_time timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.team_member_id, i.start_time, i.end_time
  from public.appointment_items i
  join public.businesses b on b.id = i.business_id
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled
    and i.is_blocking and i.start_time < p_to and i.end_time > p_from
    and p_to - p_from <= interval '32 days'
  union all
  select bt.team_member_id, bt.start_time, bt.end_time
  from public.blocked_times bt
  join public.businesses b on b.id = bt.business_id
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled
    and not bt.online_booking_allowed
    and bt.start_time < p_to and bt.end_time > p_from
    and p_to - p_from <= interval '32 days';
$$;

-- 3. Create the booking. Services run back to back from p_start. A null team member means
--    "any professional": the first active member who can do the service and is free.
create or replace function public.create_booking(
  p_slug text,
  p_items jsonb,          -- [{ "service_id": uuid, "team_member_id": uuid | null }]
  p_start timestamptz,
  p_client jsonb,         -- { first_name, last_name, email, phone }
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_tz text;
  v_client_id uuid;
  v_appointment_id uuid;
  v_cursor timestamptz := p_start;
  v_item jsonb;
  v_service public.services%rowtype;
  v_member uuid;
  v_end timestamptz;
  v_first text := nullif(trim(p_client->>'first_name'), '');
  v_last text := nullif(trim(p_client->>'last_name'), '');
  v_email text := lower(nullif(trim(p_client->>'email'), ''));
  v_phone text := nullif(regexp_replace(coalesce(p_client->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_sort int := 0;
begin
  select * into v_business from public.businesses
    where booking_slug = lower(p_slug) and online_booking_enabled;
  if not found then raise exception 'booking_unavailable'; end if;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');

  if v_first is null or length(v_first) > 100 or coalesce(length(v_last), 0) > 100 then
    raise exception 'invalid_client';
  end if;
  if v_email is null and v_phone is null then raise exception 'contact_required'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 6 then
    raise exception 'invalid_services';
  end if;

  -- Reuse the client record when the email or phone matches, otherwise create one.
  select id into v_client_id from public.clients
    where business_id = v_business.id
      and ((v_email is not null and lower(email) = v_email) or (v_phone is not null and phone = v_phone))
    order by created_at limit 1;
  if v_client_id is null then
    insert into public.clients (business_id, first_name, last_name, email, phone, client_source)
    values (v_business.id, v_first, v_last, v_email, v_phone, 'online_booking')
    returning id into v_client_id;
  end if;

  insert into public.appointments (business_id, client_id, is_walk_in, status, notes)
  values (v_business.id, v_client_id, false, 'booked', left(nullif(trim(p_notes), ''), 1000))
  returning id into v_appointment_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service from public.services
      where id = (v_item->>'service_id')::uuid and business_id = v_business.id
        and not is_archived and online_booking_enabled;
    if not found then raise exception 'invalid_services'; end if;
    v_end := v_cursor + make_interval(mins => v_service.duration_minutes);

    -- Must sit inside opening hours (defaults: Mon–Sat 09:00–18:00).
    if not exists (
      select 1 from (
        select coalesce(h.is_open, d.dow between 1 and 6) as is_open,
               coalesce(h.open_time, time '09:00') as open_time,
               coalesce(h.close_time, time '18:00') as close_time
        from (select extract(dow from v_cursor at time zone v_tz)::int as dow) d
        left join public.business_hours h on h.business_id = v_business.id and h.day_of_week = d.dow
      ) hrs
      where hrs.is_open
        and (v_cursor at time zone v_tz)::time >= hrs.open_time
        and (v_end at time zone v_tz)::time <= hrs.close_time
        and (v_cursor at time zone v_tz)::date = (v_end at time zone v_tz)::date
    ) then
      raise exception 'outside_hours';
    end if;

    v_member := nullif(v_item->>'team_member_id', '')::uuid;
    if v_member is null then
      select t.id into v_member
      from public.team_members t
      where t.business_id = v_business.id and t.is_active
        and (not exists (select 1 from public.service_team_members x where x.service_id = v_service.id)
             or exists (select 1 from public.service_team_members x
                        where x.service_id = v_service.id and x.team_member_id = t.id))
        and not exists (select 1 from public.appointment_items i
                        where i.team_member_id = t.id and i.is_blocking
                          and tstzrange(i.start_time, i.end_time) && tstzrange(v_cursor, v_end))
        and not exists (select 1 from public.blocked_times bt
                        where bt.team_member_id = t.id and not bt.online_booking_allowed
                          and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end))
      order by t.created_at
      limit 1;
      if v_member is null then raise exception 'slot_taken'; end if;
    else
      if not exists (select 1 from public.team_members t
                     where t.id = v_member and t.business_id = v_business.id and t.is_active) then
        raise exception 'invalid_team_member';
      end if;
      if exists (select 1 from public.blocked_times bt
                 where bt.team_member_id = v_member and not bt.online_booking_allowed
                   and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
        raise exception 'slot_taken';
      end if;
    end if;

    begin
      insert into public.appointment_items
        (appointment_id, business_id, service_id, team_member_id, start_time, end_time, price, sort_order)
      values
        (v_appointment_id, v_business.id, v_service.id, v_member, v_cursor, v_end,
         case when v_service.pricing_type = 'free' then 0 else v_service.price end, v_sort);
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;

    v_cursor := v_end;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('appointment_id', v_appointment_id, 'start', p_start, 'end', v_cursor);
end;
$$;

revoke all on function public.get_booking_page(text) from public;
revoke all on function public.get_booking_busy(text, timestamptz, timestamptz) from public;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text) from public;
grant execute on function public.get_booking_page(text) to anon, authenticated;
grant execute on function public.get_booking_busy(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text) to anon, authenticated;


-- ===== 20261018120000_message_automations.sql =====
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


-- ===== 20261018150000_team_shifts.sql =====
-- Team → Scheduled shifts.
-- A team member's working time on a given date is decided in this order:
--   business closed period > time off > one-day override > repeating schedule > business opening hours.
-- Shift lists are JSON arrays of {"start":"HH:MM","end":"HH:MM"}; an empty array means "not working".

create table if not exists public.team_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  repeat_weeks smallint not null default 1 check (repeat_weeks between 1 and 4),
  start_date date not null,
  end_date date,
  -- weeks[n][day] = shift list; day 0 = Sunday … 6 = Saturday; jsonb_array_length(weeks) = repeat_weeks
  weeks jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_schedules_dates check (end_date is null or end_date >= start_date),
  constraint team_schedules_weeks check (jsonb_typeof(weeks) = 'array' and jsonb_array_length(weeks) = repeat_weeks)
);
create index if not exists team_schedules_member_idx on public.team_schedules (team_member_id, start_date);

create table if not exists public.team_shift_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  date date not null,
  shifts jsonb not null default '[]'::jsonb check (jsonb_typeof(shifts) = 'array'),
  created_at timestamptz not null default now(),
  unique (team_member_id, date)
);

create table if not exists public.team_time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type text not null default 'annual_leave',
  notes text,
  created_at timestamptz not null default now(),
  constraint team_time_off_dates check (end_date >= start_date),
  constraint team_time_off_type check (type in ('annual_leave', 'sick', 'personal', 'training', 'other'))
);
create index if not exists team_time_off_member_idx on public.team_time_off (team_member_id, start_date);

create table if not exists public.business_closed_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now(),
  constraint business_closed_periods_dates check (end_date >= start_date)
);

do $$
declare t text;
begin
  foreach t in array array['team_schedules', 'team_shift_overrides', 'team_time_off', 'business_closed_periods'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;


-- ===== 20261018180000_booking_uses_shifts.sql =====
-- Online booking respects team shifts: time off, closed periods, day edits and repeating schedules.
-- Same precedence as the app (src/lib/team-shifts.ts):
--   closed period > time off > day override > repeating schedule > business opening hours.

create or replace function public.member_day_shifts(p_business uuid, p_member uuid, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shifts jsonb;
  v_schedule public.team_schedules%rowtype;
  v_hours public.business_hours%rowtype;
  v_dow int := extract(dow from p_day)::int;
  v_week_start date;
begin
  if exists (select 1 from public.business_closed_periods
             where business_id = p_business and p_day between start_date and end_date) then
    return '[]'::jsonb;
  end if;
  if exists (select 1 from public.team_time_off
             where team_member_id = p_member and p_day between start_date and end_date) then
    return '[]'::jsonb;
  end if;
  select shifts into v_shifts from public.team_shift_overrides where team_member_id = p_member and date = p_day;
  if found then return v_shifts; end if;

  select * into v_schedule from public.team_schedules
    where team_member_id = p_member and start_date <= p_day and (end_date is null or end_date >= p_day)
    order by start_date desc limit 1;
  if found then
    v_week_start := v_schedule.start_date - (extract(isodow from v_schedule.start_date)::int - 1);
    return coalesce(v_schedule.weeks -> (((p_day - v_week_start) / 7) % v_schedule.repeat_weeks) -> v_dow, '[]'::jsonb);
  end if;

  select * into v_hours from public.business_hours where business_id = p_business and day_of_week = v_dow;
  if not found then
    return case when v_dow = 0 then '[]'::jsonb else '[{"start":"09:00","end":"18:00"}]'::jsonb end;
  end if;
  if not v_hours.is_open or v_hours.open_time is null or v_hours.close_time is null then return '[]'::jsonb; end if;
  return jsonb_build_array(jsonb_build_object(
    'start', to_char(v_hours.open_time, 'HH24:MI'), 'end', to_char(v_hours.close_time, 'HH24:MI')));
end;
$$;

-- True when [p_start, p_end) sits inside one of the member's shifts on that local day.
create or replace function public.member_is_working(p_business uuid, p_member uuid, p_start timestamptz, p_end timestamptz, p_tz text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_start at time zone p_tz)::date = (p_end at time zone p_tz)::date
     and exists (
       select 1
       from jsonb_array_elements(public.member_day_shifts(p_business, p_member, (p_start at time zone p_tz)::date)) s
       where (p_start at time zone p_tz)::time >= (s->>'start')::time
         and ((p_end at time zone p_tz)::time <= (s->>'end')::time or s->>'end' = '24:00')
     );
$$;

-- Each active team member's shifts per day, for the booking page.
create or replace function public.get_booking_availability(p_slug text, p_from date, p_to date)
returns table (team_member_id uuid, day date, shifts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, d::date, public.member_day_shifts(b.id, t.id, d::date)
  from public.businesses b
  join public.team_members t on t.business_id = b.id and t.is_active
  cross join generate_series(p_from, least(p_to, p_from + 31), interval '1 day') d
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled and p_to >= p_from;
$$;

create or replace function public.create_booking(
  p_slug text,
  p_items jsonb,
  p_start timestamptz,
  p_client jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_tz text;
  v_client_id uuid;
  v_appointment_id uuid;
  v_cursor timestamptz := p_start;
  v_item jsonb;
  v_service public.services%rowtype;
  v_member uuid;
  v_end timestamptz;
  v_first text := nullif(trim(p_client->>'first_name'), '');
  v_last text := nullif(trim(p_client->>'last_name'), '');
  v_email text := lower(nullif(trim(p_client->>'email'), ''));
  v_phone text := nullif(regexp_replace(coalesce(p_client->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_sort int := 0;
begin
  select * into v_business from public.businesses
    where booking_slug = lower(p_slug) and online_booking_enabled;
  if not found then raise exception 'booking_unavailable'; end if;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');

  if v_first is null or length(v_first) > 100 or coalesce(length(v_last), 0) > 100 then
    raise exception 'invalid_client';
  end if;
  if v_email is null and v_phone is null then raise exception 'contact_required'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 6 then
    raise exception 'invalid_services';
  end if;

  select id into v_client_id from public.clients
    where business_id = v_business.id
      and ((v_email is not null and lower(email) = v_email) or (v_phone is not null and phone = v_phone))
    order by created_at limit 1;
  if v_client_id is null then
    insert into public.clients (business_id, first_name, last_name, email, phone, client_source)
    values (v_business.id, v_first, v_last, v_email, v_phone, 'online_booking')
    returning id into v_client_id;
  end if;

  insert into public.appointments (business_id, client_id, is_walk_in, status, notes)
  values (v_business.id, v_client_id, false, 'booked', left(nullif(trim(p_notes), ''), 1000))
  returning id into v_appointment_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service from public.services
      where id = (v_item->>'service_id')::uuid and business_id = v_business.id
        and not is_archived and online_booking_enabled;
    if not found then raise exception 'invalid_services'; end if;
    v_end := v_cursor + make_interval(mins => v_service.duration_minutes);

    v_member := nullif(v_item->>'team_member_id', '')::uuid;
    if v_member is null then
      select t.id into v_member
      from public.team_members t
      where t.business_id = v_business.id and t.is_active
        and (not exists (select 1 from public.service_team_members x where x.service_id = v_service.id)
             or exists (select 1 from public.service_team_members x
                        where x.service_id = v_service.id and x.team_member_id = t.id))
        and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)
        and not exists (select 1 from public.appointment_items i
                        where i.team_member_id = t.id and i.is_blocking
                          and tstzrange(i.start_time, i.end_time) && tstzrange(v_cursor, v_end))
        and not exists (select 1 from public.blocked_times bt
                        where bt.team_member_id = t.id and not bt.online_booking_allowed
                          and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end))
      order by t.created_at
      limit 1;
      if v_member is null then
        -- Nobody free: say whether it's because nobody works then, or everyone is booked.
        if exists (select 1 from public.team_members t
                   where t.business_id = v_business.id and t.is_active
                     and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)) then
          raise exception 'slot_taken';
        end if;
        raise exception 'outside_hours';
      end if;
    else
      if not exists (select 1 from public.team_members t
                     where t.id = v_member and t.business_id = v_business.id and t.is_active) then
        raise exception 'invalid_team_member';
      end if;
      if not public.member_is_working(v_business.id, v_member, v_cursor, v_end, v_tz) then
        raise exception 'outside_hours';
      end if;
      if exists (select 1 from public.blocked_times bt
                 where bt.team_member_id = v_member and not bt.online_booking_allowed
                   and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
        raise exception 'slot_taken';
      end if;
    end if;

    begin
      insert into public.appointment_items
        (appointment_id, business_id, service_id, team_member_id, start_time, end_time, price, sort_order)
      values
        (v_appointment_id, v_business.id, v_service.id, v_member, v_cursor, v_end,
         case when v_service.pricing_type = 'free' then 0 else v_service.price end, v_sort);
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;

    v_cursor := v_end;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('appointment_id', v_appointment_id, 'start', p_start, 'end', v_cursor);
end;
$$;

revoke all on function public.member_day_shifts(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.member_is_working(uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.get_booking_availability(text, date, date) from public;
grant execute on function public.get_booking_availability(text, date, date) to anon, authenticated;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text) to anon, authenticated;


-- ===== 20261019100000_manage_booking.sql =====
-- Clients manage their own online bookings from a private link: view, cancel or reschedule,
-- within the business's booking policy. The token is the only key; it is unguessable (uuid v4).

alter table public.appointments add column if not exists manage_token uuid not null default gen_random_uuid();
create unique index if not exists appointments_manage_token_key on public.appointments (manage_token);

alter table public.businesses add column if not exists booking_notice_hours int not null default 24
  check (booking_notice_hours between 0 and 336);
alter table public.businesses add column if not exists allow_client_cancel boolean not null default true;
alter table public.businesses add column if not exists allow_client_reschedule boolean not null default true;
alter table public.businesses add column if not exists booking_policy text;

-- Include the token in create_booking's result so the confirmation screen can show the link.
create or replace function public.booking_manage_token(p_appointment uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select manage_token from public.appointments where id = p_appointment;
$$;
revoke all on function public.booking_manage_token(uuid) from public, anon, authenticated;

-- Wrap the existing create_booking: same checks, plus the manage token in the result.
alter function public.create_booking(text, jsonb, timestamptz, jsonb, text) rename to create_booking_core;
revoke all on function public.create_booking_core(text, jsonb, timestamptz, jsonb, text) from public, anon, authenticated;

create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  return v_result || jsonb_build_object(
    'manage_token', public.booking_manage_token((v_result->>'appointment_id')::uuid));
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text) to anon, authenticated;

-- Everything the manage page shows. Client sees only their own appointment.
create or replace function public.get_manage_booking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'notes', a.notes,
      'start', (select min(i.start_time) from public.appointment_items i where i.appointment_id = a.id),
      'end', (select max(i.end_time) from public.appointment_items i where i.appointment_id = a.id),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'service_id', i.service_id,
            'service', s.name,
            'duration', s.duration_minutes,
            'price', i.price,
            'team_member_id', i.team_member_id,
            'team_member', t.first_name,
            'start', i.start_time,
            'end', i.end_time
          ) order by i.sort_order), '[]'::jsonb)
        from public.appointment_items i
        left join public.services s on s.id = i.service_id
        left join public.team_members t on t.id = i.team_member_id
        where i.appointment_id = a.id
      ),
      'client_first_name', c.first_name
    ),
    'business', jsonb_build_object(
      'name', b.name,
      'slug', b.booking_slug,
      'currency', b.currency,
      'country', b.country,
      'timezone', coalesce(b.timezone, 'Africa/Lagos'),
      'location', b.location,
      'hours', (select coalesce(jsonb_agg(jsonb_build_object('day', h.day_of_week, 'open', h.is_open, 'from', h.open_time, 'to', h.close_time)), '[]'::jsonb)
                from public.business_hours h where h.business_id = b.id)
    ),
    'policy', jsonb_build_object(
      'notice_hours', b.booking_notice_hours,
      'allow_cancel', b.allow_client_cancel,
      'allow_reschedule', b.allow_client_reschedule,
      'text', b.booking_policy
    )
  )
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  left join public.clients c on c.id = a.client_id
  where a.manage_token = p_token;
$$;

-- Busy times for rescheduling, ignoring the client's own appointment.
create or replace function public.get_manage_busy(p_token uuid, p_from timestamptz, p_to timestamptz)
returns table (team_member_id uuid, start_time timestamptz, end_time timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with appt as (select id, business_id from public.appointments where manage_token = p_token)
  select i.team_member_id, i.start_time, i.end_time
  from public.appointment_items i, appt
  where i.business_id = appt.business_id and i.appointment_id <> appt.id and i.is_blocking
    and i.start_time < p_to and i.end_time > p_from and p_to - p_from <= interval '32 days'
  union all
  select bt.team_member_id, bt.start_time, bt.end_time
  from public.blocked_times bt, appt
  where bt.business_id = appt.business_id and not bt.online_booking_allowed
    and bt.start_time < p_to and bt.end_time > p_from and p_to - p_from <= interval '32 days';
$$;

-- Shifts per team member per day, for rescheduling (same as get_booking_availability, keyed by token).
create or replace function public.get_manage_availability(p_token uuid, p_from date, p_to date)
returns table (team_member_id uuid, day date, shifts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, d::date, public.member_day_shifts(a.business_id, t.id, d::date)
  from public.appointments a
  join public.team_members t on t.business_id = a.business_id and t.is_active
  cross join generate_series(p_from, least(p_to, p_from + 31), interval '1 day') d
  where a.manage_token = p_token and p_to >= p_from;
$$;

-- Raises unless the appointment can still be changed by the client.
create or replace function public.assert_manageable(p_token uuid, p_action text)
returns public.appointments
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_start timestamptz;
begin
  select * into v_appt from public.appointments where manage_token = p_token;
  if not found then raise exception 'not_found'; end if;
  select * into v_business from public.businesses where id = v_appt.business_id;
  if v_appt.status not in ('booked', 'confirmed') then raise exception 'not_changeable'; end if;
  if p_action = 'cancel' and not v_business.allow_client_cancel then raise exception 'not_allowed'; end if;
  if p_action = 'reschedule' and not v_business.allow_client_reschedule then raise exception 'not_allowed'; end if;
  select min(start_time) into v_start from public.appointment_items where appointment_id = v_appt.id;
  if v_start is null or v_start < now() + make_interval(hours => v_business.booking_notice_hours) then
    raise exception 'too_late';
  end if;
  return v_appt;
end;
$$;
revoke all on function public.assert_manageable(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_booking(p_token uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
begin
  v_appt := public.assert_manageable(p_token, 'cancel');
  update public.appointments
    set status = 'cancelled',
        cancellation_reason = left(coalesce(nullif(trim(p_reason), ''), 'Cancelled by client online'), 300)
    where id = v_appt.id;
  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- Moves every service to start at p_start (back to back), keeping the same team members.
create or replace function public.reschedule_booking(p_token uuid, p_start timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_tz text;
  v_cursor timestamptz := p_start;
  v_item record;
  v_end timestamptz;
begin
  v_appt := public.assert_manageable(p_token, 'reschedule');
  select * into v_business from public.businesses where id = v_appt.business_id;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');
  if p_start < now() + make_interval(hours => v_business.booking_notice_hours)
     or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;

  -- Free the old slots first so moving by a few minutes doesn't clash with itself.
  update public.appointment_items set is_blocking = false where appointment_id = v_appt.id;

  for v_item in
    select i.id, i.team_member_id, extract(epoch from (i.end_time - i.start_time)) / 60 as minutes
    from public.appointment_items i where i.appointment_id = v_appt.id order by i.sort_order
  loop
    v_end := v_cursor + make_interval(mins => v_item.minutes::int);
    if not public.member_is_working(v_business.id, v_item.team_member_id, v_cursor, v_end, v_tz) then
      raise exception 'outside_hours';
    end if;
    if exists (select 1 from public.blocked_times bt
               where bt.team_member_id = v_item.team_member_id and not bt.online_booking_allowed
                 and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
      raise exception 'slot_taken';
    end if;
    begin
      update public.appointment_items
        set start_time = v_cursor, end_time = v_end, is_blocking = true
        where id = v_item.id;
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;
    v_cursor := v_end;
  end loop;

  return jsonb_build_object('start', p_start, 'end', v_cursor);
end;
$$;

revoke all on function public.get_manage_booking(uuid) from public;
revoke all on function public.get_manage_busy(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_manage_availability(uuid, date, date) from public;
revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.get_manage_booking(uuid) to anon, authenticated;
grant execute on function public.get_manage_busy(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.get_manage_availability(uuid, date, date) to anon, authenticated;
grant execute on function public.cancel_booking(uuid, text) to anon, authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to anon, authenticated;

-- The policy shown on the booking page before the client confirms.
create or replace function public.get_booking_policy(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'notice_hours', booking_notice_hours,
    'allow_cancel', allow_client_cancel,
    'allow_reschedule', allow_client_reschedule,
    'text', booking_policy)
  from public.businesses
  where booking_slug = lower(p_slug) and online_booking_enabled;
$$;
revoke all on function public.get_booking_policy(text) from public;
grant execute on function public.get_booking_policy(text) to anon, authenticated;


-- ===== 20261019120000_products_inventory.sql =====
-- Catalog → Products and Inventory: products, suppliers, stock orders, stocktakes, stock history.
-- products.stock_quantity is kept in step by stock_movements (insert-only ledger) via triggers.

create table if not exists public.product_brands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  brand_id uuid references public.product_brands(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  sku text,
  barcode text,
  description text,
  retail_price numeric not null default 0 check (retail_price >= 0),
  supply_price numeric check (supply_price is null or supply_price >= 0),
  track_stock boolean not null default true,
  stock_quantity integer not null default 0,
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_business_idx on public.products (business_id, name);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  change integer not null check (change <> 0),
  reason text not null check (reason in ('initial', 'adjustment', 'sale', 'refund', 'stock_order', 'stocktake', 'damaged', 'internal_use')),
  reference_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create table if not exists public.stock_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.stock_orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  supply_price numeric check (supply_price is null or supply_price >= 0)
);

create table if not exists public.stocktakes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.stocktake_items (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references public.stocktakes(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  expected integer not null,
  counted integer check (counted is null or counted >= 0),
  unique (stocktake_id, product_id)
);

alter table public.sale_items add column if not exists product_id uuid references public.products(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['product_brands', 'product_categories', 'suppliers', 'products', 'stock_movements',
                           'stock_orders', 'stock_order_items', 'stocktakes', 'stocktake_items'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- The ledger is append-only for the app: history can't be edited or deleted.
revoke update, delete on public.stock_movements from authenticated;

create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products
    set stock_quantity = stock_quantity + new.change, updated_at = now()
    where id = new.product_id and business_id = new.business_id;
  return new;
end;
$$;
revoke all on function public.apply_stock_movement() from public, anon, authenticated;
drop trigger if exists stock_movements_apply on public.stock_movements;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Selling a tracked product takes it out of stock (only for completed sales; drafts don't count).
create or replace function public.sale_item_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null
     and exists (select 1 from public.sales s where s.id = new.sale_id and s.status = 'completed')
     and exists (select 1 from public.products p where p.id = new.product_id and p.track_stock) then
    insert into public.stock_movements (business_id, product_id, change, reason, reference_id)
    values (new.business_id, new.product_id, -new.quantity, 'sale', new.sale_id);
  end if;
  return new;
end;
$$;
revoke all on function public.sale_item_stock() from public, anon, authenticated;
drop trigger if exists sale_items_stock on public.sale_items;
create trigger sale_items_stock after insert on public.sale_items
  for each row execute function public.sale_item_stock();

-- Refunding a completed sale puts its products back.
create or replace function public.sale_refund_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'completed' and new.status = 'refunded' then
    insert into public.stock_movements (business_id, product_id, change, reason, reference_id)
    select i.business_id, i.product_id, i.quantity, 'refund', new.id
    from public.sale_items i join public.products p on p.id = i.product_id
    where i.sale_id = new.id and p.track_stock;
  end if;
  return new;
end;
$$;
revoke all on function public.sale_refund_stock() from public, anon, authenticated;
drop trigger if exists sales_refund_stock on public.sales;
create trigger sales_refund_stock after update of status on public.sales
  for each row execute function public.sale_refund_stock();

-- Receive a stock order: adds every line to stock once.
create or replace function public.receive_stock_order(p_order uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_order public.stock_orders%rowtype;
begin
  select * into v_order from public.stock_orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status not in ('draft', 'ordered') then raise exception 'already_closed'; end if;
  insert into public.stock_movements (business_id, product_id, change, reason, reference_id, created_by)
  select i.business_id, i.product_id, i.quantity, 'stock_order', p_order, auth.uid()
  from public.stock_order_items i join public.products p on p.id = i.product_id
  where i.order_id = p_order and p.track_stock;
  update public.products p set supply_price = i.supply_price
    from public.stock_order_items i
    where i.order_id = p_order and i.product_id = p.id and i.supply_price is not null;
  update public.stock_orders set status = 'received', received_at = now() where id = p_order;
end;
$$;

-- Complete a stocktake: moves stock to the counted figures (difference recorded in the ledger).
create or replace function public.complete_stocktake(p_stocktake uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_take public.stocktakes%rowtype;
begin
  select * into v_take from public.stocktakes where id = p_stocktake for update;
  if not found then raise exception 'not_found'; end if;
  if v_take.status <> 'in_progress' then raise exception 'already_closed'; end if;
  insert into public.stock_movements (business_id, product_id, change, reason, reference_id, created_by)
  select i.business_id, i.product_id, i.counted - p.stock_quantity, 'stocktake', p_stocktake, auth.uid()
  from public.stocktake_items i join public.products p on p.id = i.product_id
  where i.stocktake_id = p_stocktake and i.counted is not null and i.counted <> p.stock_quantity;
  update public.stocktakes set status = 'completed', completed_at = now() where id = p_stocktake;
end;
$$;

grant execute on function public.receive_stock_order(uuid) to authenticated;
grant execute on function public.complete_stocktake(uuid) to authenticated;
revoke all on function public.receive_stock_order(uuid) from anon;
revoke all on function public.complete_stocktake(uuid) from anon;


-- ===== 20261019140000_gift_cards_packages_memberships.sql =====
-- Gift cards, packages and memberships: sold at checkout, redeemed later.
-- Balances and remaining sessions are derived from append-only redemption rows via triggers.

-- ─── Gift cards ─────────────────────────────────────────────────────────────
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{8}$'),
  initial_value numeric not null check (initial_value > 0),
  balance numeric not null check (balance >= 0),
  client_id uuid references public.clients(id) on delete set null,
  recipient_name text,
  message text,
  expires_on date,
  status text not null default 'active' check (status in ('active', 'void')),
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- ─── Packages ───────────────────────────────────────────────────────────────
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  price numeric not null check (price >= 0),
  valid_days integer check (valid_days is null or valid_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.package_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  sessions integer not null check (sessions between 1 and 100),
  unique (package_id, service_id)
);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid references public.packages(id) on delete set null,
  name text not null,
  price numeric not null default 0,
  sale_id uuid references public.sales(id) on delete set null,
  expires_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.client_package_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  sessions_total integer not null check (sessions_total > 0),
  sessions_used integer not null default 0 check (sessions_used >= 0 and sessions_used <= sessions_total)
);

create table if not exists public.package_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_package_item_id uuid not null references public.client_package_items(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  sessions integer not null default 1 check (sessions > 0),
  created_at timestamptz not null default now()
);

-- ─── Memberships ────────────────────────────────────────────────────────────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  price numeric not null check (price >= 0),
  duration_days integer not null check (duration_days between 1 and 3660),
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  name text not null,
  discount_percent numeric not null,
  price numeric not null default 0,
  sale_id uuid references public.sales(id) on delete set null,
  starts_on date not null default current_date,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint client_memberships_dates check (ends_on >= starts_on)
);

do $$
declare t text;
begin
  foreach t in array array['gift_cards', 'gift_card_redemptions', 'packages', 'package_items', 'client_packages',
                           'client_package_items', 'package_redemptions', 'memberships', 'client_memberships'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- Redemption ledgers are append-only for the app.
revoke update, delete on public.gift_card_redemptions from authenticated;
revoke update, delete on public.package_redemptions from authenticated;
-- Balances and sessions only change through redemptions: the app may update the other columns only.
revoke update on public.gift_cards from authenticated;
grant update (status, recipient_name, message, expires_on, client_id) on public.gift_cards to authenticated;
revoke update on public.client_package_items from authenticated;

create or replace function public.apply_gift_card_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_card public.gift_cards%rowtype;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and business_id = new.business_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_card from public.gift_cards where id = new.gift_card_id and business_id = new.business_id for update;
  if not found then raise exception 'gift_card_not_found'; end if;
  if v_card.status <> 'active' then raise exception 'gift_card_void'; end if;
  if v_card.expires_on is not null and v_card.expires_on < current_date then raise exception 'gift_card_expired'; end if;
  if v_card.balance < new.amount then raise exception 'gift_card_insufficient'; end if;
  update public.gift_cards set balance = balance - new.amount where id = v_card.id;
  return new;
end;
$$;
revoke all on function public.apply_gift_card_redemption() from public, anon, authenticated;
drop trigger if exists gift_card_redemptions_apply on public.gift_card_redemptions;
create trigger gift_card_redemptions_apply before insert on public.gift_card_redemptions
  for each row execute function public.apply_gift_card_redemption();

create or replace function public.apply_package_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item public.client_package_items%rowtype; v_expires date;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and business_id = new.business_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_item from public.client_package_items where id = new.client_package_item_id and business_id = new.business_id for update;
  if not found then raise exception 'package_not_found'; end if;
  select expires_on into v_expires from public.client_packages where id = v_item.client_package_id;
  if v_expires is not null and v_expires < current_date then raise exception 'package_expired'; end if;
  if v_item.sessions_used + new.sessions > v_item.sessions_total then raise exception 'package_used_up'; end if;
  update public.client_package_items set sessions_used = sessions_used + new.sessions where id = v_item.id;
  return new;
end;
$$;
revoke all on function public.apply_package_redemption() from public, anon, authenticated;
drop trigger if exists package_redemptions_apply on public.package_redemptions;
create trigger package_redemptions_apply before insert on public.package_redemptions
  for each row execute function public.apply_package_redemption();

-- Sets the starting balance on insert (callers can't choose a balance different from the value).
create or replace function public.gift_card_set_balance()
returns trigger language plpgsql as $$
begin
  new.balance := new.initial_value;
  return new;
end;
$$;
drop trigger if exists gift_cards_set_balance on public.gift_cards;
create trigger gift_cards_set_balance before insert on public.gift_cards
  for each row execute function public.gift_card_set_balance();

-- New, unused 8-character code for a business (no 0/O/1/I to avoid misreading).
create or replace function public.new_gift_card_code(p_business uuid)
returns text language plpgsql volatile security invoker set search_path = public as $$
declare v_code text; v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v_code := (select string_agg(substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1), '')
               from generate_series(1, 8));
    exit when not exists (select 1 from public.gift_cards where business_id = p_business and code = v_code);
  end loop;
  return v_code;
end;
$$;
grant execute on function public.new_gift_card_code(uuid) to authenticated;
revoke all on function public.new_gift_card_code(uuid) from anon;


-- ===== 20261019160000_repeating_appointments.sql =====
-- Repeating appointments: occurrences share a series_id (the first appointment's id) and the rule
-- that created them, e.g. {"unit":"week","every":1,"count":6} or {"unit":"month","every":1,"until":"2027-01-31"}.
alter table public.appointments add column if not exists series_id uuid;
alter table public.appointments add column if not exists repeat_rule jsonb;
create index if not exists appointments_series_idx on public.appointments (series_id) where series_id is not null;


-- ===== 20261019180000_deals.sql =====
-- Marketing → Deals: discount codes for checkout and online booking.

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  discount_type text not null check (discount_type in ('percent', 'amount')),
  value numeric not null check (value > 0),
  applies_to text not null default 'services' check (applies_to in ('services', 'all')),
  starts_on date,
  ends_on date,
  max_uses integer check (max_uses is null or max_uses > 0),
  online boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, code),
  constraint deals_dates check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint deals_percent check (discount_type <> 'percent' or value <= 100)
);

create table if not exists public.deal_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['deals', 'deal_redemptions'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;
revoke update, delete on public.deal_redemptions from authenticated;

-- A deal that can be used now, or an exception naming why not. Locks the deal row so usage limits hold.
create or replace function public.usable_deal(p_business uuid, p_code text, p_online boolean)
returns public.deals
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_deal public.deals%rowtype; v_used int;
begin
  select * into v_deal from public.deals
    where business_id = p_business and code = upper(trim(p_code)) and is_active
    for update;
  if not found then raise exception 'deal_not_found'; end if;
  if p_online and not v_deal.online then raise exception 'deal_not_online'; end if;
  if v_deal.starts_on is not null and v_deal.starts_on > current_date then raise exception 'deal_not_started'; end if;
  if v_deal.ends_on is not null and v_deal.ends_on < current_date then raise exception 'deal_expired'; end if;
  if v_deal.max_uses is not null then
    select count(*) into v_used from public.deal_redemptions where deal_id = v_deal.id;
    if v_used >= v_deal.max_uses then raise exception 'deal_used_up'; end if;
  end if;
  return v_deal;
end;
$$;
revoke all on function public.usable_deal(uuid, text, boolean) from public, anon, authenticated;

-- Checkout: validate a code for the signed-in business (staff only).
create or replace function public.check_deal(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null then raise exception 'not_allowed'; end if;
  v_deal := public.usable_deal(v_business, p_code, false);
  return jsonb_build_object('id', v_deal.id, 'name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type,
                            'value', v_deal.value, 'applies_to', v_deal.applies_to);
end;
$$;
revoke all on function public.check_deal(text) from public, anon;
grant execute on function public.check_deal(text) to authenticated;

-- Booking page: preview a code before booking.
create or replace function public.check_booking_deal(p_slug text, p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then raise exception 'booking_unavailable'; end if;
  v_deal := public.usable_deal(v_business, p_code, true);
  return jsonb_build_object('name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type, 'value', v_deal.value);
end;
$$;
revoke all on function public.check_booking_deal(text, text) from public;
grant execute on function public.check_booking_deal(text, text) to anon, authenticated;

-- create_booking gains an optional promo code: the discount is applied to the booked prices
-- (spread across services in proportion) and recorded as a redemption.
drop function if exists public.create_booking(text, jsonb, timestamptz, jsonb, text);
create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_appointment uuid;
  v_business uuid;
  v_deal public.deals%rowtype;
  v_total numeric;
  v_discount numeric := 0;
begin
  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;

  if v_deal.id is not null then
    select coalesce(sum(price), 0) into v_total from public.appointment_items where appointment_id = v_appointment;
    v_discount := least(v_total, case when v_deal.discount_type = 'percent' then round(v_total * v_deal.value / 100, 2) else v_deal.value end);
    if v_total > 0 and v_discount > 0 then
      update public.appointment_items
        set price = round(price - price / v_total * v_discount, 2)
        where appointment_id = v_appointment;
    end if;
    insert into public.deal_redemptions (business_id, deal_id, appointment_id, amount)
    values (v_deal.business_id, v_deal.id, v_appointment, v_discount);
    update public.appointments
      set notes = concat_ws(E'\n', notes, 'Promo code ' || v_deal.code || ' applied')
      where id = v_appointment;
  end if;

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;

-- Checkout: record a code's use against a completed sale, re-checking limits atomically.
create or replace function public.redeem_deal(p_code text, p_sale uuid, p_amount numeric)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.sales where id = p_sale and business_id = v_business) then
    raise exception 'not_allowed';
  end if;
  v_deal := public.usable_deal(v_business, p_code, false);
  insert into public.deal_redemptions (business_id, deal_id, sale_id, amount)
  values (v_business, v_deal.id, p_sale, greatest(0, p_amount));
end;
$$;
revoke all on function public.redeem_deal(text, uuid, numeric) from public, anon;
grant execute on function public.redeem_deal(text, uuid, numeric) to authenticated;


-- ===== 20261019200000_notifications.sql =====
-- In-app notifications for the business: online bookings, client changes, low stock.
-- Written by triggers/functions (never by the browser), read and marked read by staff.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('online_booking', 'client_cancelled', 'client_rescheduled', 'low_stock')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_business_idx on public.notifications (business_id, created_at desc);

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "Business members read notifications" on public.notifications;
create policy "Business members read notifications" on public.notifications for all to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Summary line for an appointment: "Ada · Haircut · Mon 21 Oct 10:30".
create or replace function public.appointment_summary(p_appointment uuid)
returns text language sql stable security definer set search_path = public as $$
  select concat_ws(' · ',
    coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''), 'Walk-in'),
    (select string_agg(s.name, ', ' order by i.sort_order) from public.appointment_items i
       left join public.services s on s.id = i.service_id where i.appointment_id = a.id),
    (select to_char(min(i.start_time) at time zone coalesce(b.timezone, 'Africa/Lagos'), 'Dy DD Mon HH24:MI')
       from public.appointment_items i where i.appointment_id = a.id))
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  left join public.clients c on c.id = a.client_id
  where a.id = p_appointment;
$$;
revoke all on function public.appointment_summary(uuid) from public, anon, authenticated;

create or replace function public.notify(p_business uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.notifications (business_id, kind, title, body, link) values (p_business, p_kind, p_title, p_body, p_link);
$$;
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Online bookings and client self-service changes arrive through these functions, so notify there.
create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_appointment uuid;
  v_business uuid;
  v_deal public.deals%rowtype;
  v_total numeric;
  v_discount numeric := 0;
begin
  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;
  select business_id into v_business from public.appointments where id = v_appointment;

  if v_deal.id is not null then
    select coalesce(sum(price), 0) into v_total from public.appointment_items where appointment_id = v_appointment;
    v_discount := least(v_total, case when v_deal.discount_type = 'percent' then round(v_total * v_deal.value / 100, 2) else v_deal.value end);
    if v_total > 0 and v_discount > 0 then
      update public.appointment_items
        set price = round(price - price / v_total * v_discount, 2)
        where appointment_id = v_appointment;
    end if;
    insert into public.deal_redemptions (business_id, deal_id, appointment_id, amount)
    values (v_deal.business_id, v_deal.id, v_appointment, v_discount);
    update public.appointments
      set notes = concat_ws(E'\n', notes, 'Promo code ' || v_deal.code || ' applied')
      where id = v_appointment;
  end if;

  perform public.notify(v_business, 'online_booking', 'New online booking',
    public.appointment_summary(v_appointment), '/calendar?appointment=' || v_appointment);

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;

-- Wrap cancel/reschedule so staff hear about client changes.
alter function public.cancel_booking(uuid, text) rename to cancel_booking_core;
alter function public.reschedule_booking(uuid, timestamptz) rename to reschedule_booking_core;
revoke all on function public.cancel_booking_core(uuid, text) from public, anon, authenticated;
revoke all on function public.reschedule_booking_core(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.cancel_booking(p_token uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_appt public.appointments%rowtype;
begin
  v_result := public.cancel_booking_core(p_token, p_reason);
  select * into v_appt from public.appointments where manage_token = p_token;
  perform public.notify(v_appt.business_id, 'client_cancelled', 'Client cancelled online',
    public.appointment_summary(v_appt.id) || coalesce(' · "' || nullif(trim(p_reason), '') || '"', ''),
    '/calendar?appointment=' || v_appt.id);
  return v_result;
end;
$$;

create or replace function public.reschedule_booking(p_token uuid, p_start timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_appt public.appointments%rowtype;
begin
  v_result := public.reschedule_booking_core(p_token, p_start);
  select * into v_appt from public.appointments where manage_token = p_token;
  perform public.notify(v_appt.business_id, 'client_rescheduled', 'Client rescheduled online',
    'Now ' || public.appointment_summary(v_appt.id), '/calendar?appointment=' || v_appt.id);
  return v_result;
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.cancel_booking(uuid, text) to anon, authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to anon, authenticated;

-- Low stock: when a tracked product falls to (or below) its warning level.
create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.track_stock and new.low_stock_threshold is not null
     and new.stock_quantity <= new.low_stock_threshold
     and old.stock_quantity > coalesce(old.low_stock_threshold, new.low_stock_threshold) then
    perform public.notify(new.business_id, 'low_stock',
      case when new.stock_quantity <= 0 then new.name || ' is out of stock' else new.name || ' is running low' end,
      new.stock_quantity || ' left', '/catalog?tab=products');
  end if;
  return new;
end;
$$;
revoke all on function public.notify_low_stock() from public, anon, authenticated;
drop trigger if exists products_low_stock on public.products;
create trigger products_low_stock after update of stock_quantity on public.products
  for each row execute function public.notify_low_stock();


-- ===== 20261019220000_tax_rates.sql =====
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


-- ===== 20261019240000_team_pay.sql =====
-- Team → Timesheets, commissions and pay runs.

alter table public.team_members add column if not exists hourly_rate numeric check (hourly_rate is null or hourly_rate >= 0);
alter table public.team_members add column if not exists service_commission_percent numeric
  check (service_commission_percent is null or (service_commission_percent >= 0 and service_commission_percent <= 100));
alter table public.team_members add column if not exists product_commission_percent numeric
  check (product_commission_percent is null or (product_commission_percent >= 0 and product_commission_percent <= 100));

-- Who performed each sold item (for commission); checkout fills it from the cart line.
alter table public.sale_items add column if not exists team_member_id uuid references public.team_members(id) on delete set null;

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  notes text,
  created_at timestamptz not null default now(),
  constraint timesheets_order check (clock_out is null or clock_out > clock_in),
  constraint timesheets_length check (clock_out is null or clock_out - clock_in <= interval '24 hours')
);
create index if not exists timesheets_member_idx on public.timesheets (team_member_id, clock_in desc);
-- At most one open (not clocked out) entry per person.
create unique index if not exists timesheets_one_open on public.timesheets (team_member_id) where clock_out is null;

create table if not exists public.pay_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint pay_runs_period check (period_end >= period_start)
);

create table if not exists public.pay_run_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete set null,
  member_name text not null,
  hours numeric not null default 0,
  wages numeric not null default 0,
  commission numeric not null default 0,
  tips numeric not null default 0,
  adjustment numeric not null default 0,
  adjustment_note text,
  total numeric not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['timesheets', 'pay_runs', 'pay_run_lines'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format(
      'create policy "Business members manage %s" on public.%I for all to authenticated
         using (business_id in (select business_id from public.profiles where id = auth.uid()))
         with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
  end loop;
end $$;

-- Paid pay runs are locked: no edits to the run or its lines.
create or replace function public.lock_paid_pay_runs()
returns trigger language plpgsql as $$
declare v_status text;
begin
  -- Deleting the whole business cascades here; let that through.
  if tg_op = 'DELETE' and not exists (select 1 from public.businesses where id = old.business_id) then
    return old;
  end if;
  if tg_table_name = 'pay_runs' then
    if old.status = 'paid' then raise exception 'pay_run_locked'; end if;
  else
    select status into v_status from public.pay_runs where id = coalesce(old.pay_run_id, new.pay_run_id);
    if v_status = 'paid' then raise exception 'pay_run_locked'; end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists pay_runs_lock on public.pay_runs;
create trigger pay_runs_lock before update or delete on public.pay_runs
  for each row execute function public.lock_paid_pay_runs();
drop trigger if exists pay_run_lines_lock on public.pay_run_lines;
create trigger pay_run_lines_lock before insert or update or delete on public.pay_run_lines
  for each row execute function public.lock_paid_pay_runs();


-- ===== 20261020100000_sale_item_discounts.sql =====
-- Each sold line's share of the cart discount, so commission and tax use what was actually charged.
-- Null on sales saved before this was recorded (pay runs estimate those).
alter table public.sale_items add column if not exists discount_amount numeric
  check (discount_amount is null or discount_amount >= 0);


-- ===== 20261020120000_profile_business_guard.sql =====
-- Security: profiles.business_id decides which salon's data a login can read, and users may
-- edit their own profile row. Only let a signed-in user point it at a business they own.
-- Team invites are accepted server-side with the service key, which this doesn't restrict.

-- Not security definer on purpose: current_user must be the caller's role.
create or replace function public.guard_profile_business()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
     and not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid())
  then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_business_guard on public.profiles;
create trigger profiles_business_guard
  before insert or update of business_id on public.profiles
  for each row execute function public.guard_profile_business();


-- ===== 20261020140000_customer_accounts.sql =====
-- Customer accounts: one Bookly login across every salon a person books with.
-- Appointments, gift cards, packages and memberships reach the account through the salon's
-- client record, which is linked once its email matches the account's confirmed email.

-- ── Profile details customers manage themselves ──
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists email_reminders boolean not null default true;
alter table public.profiles add column if not exists marketing_emails boolean not null default false;

-- ── Client records ↔ customer accounts ──
alter table public.clients add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists clients_user_id_idx on public.clients (user_id) where user_id is not null;

-- Links every unclaimed client record with this account's confirmed email. Safe to repeat.
create or replace function public.link_my_clients()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email = '' then return 0; end if;
  update public.clients set user_id = auth.uid() where user_id is null and lower(email) = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Favourite salons ──
create table if not exists public.favorite_businesses (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
grant select, insert, delete on public.favorite_businesses to authenticated;
grant all on public.favorite_businesses to service_role;
alter table public.favorite_businesses enable row level security;
drop policy if exists "Customers manage their favourites" on public.favorite_businesses;
create policy "Customers manage their favourites" on public.favorite_businesses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Reviews (written by customers for completed appointments, shown on the salon page) ──
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  services text,
  team_member_name text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_business_idx on public.reviews (business_id, created_at desc);
grant select on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
drop policy if exists "Business members read reviews" on public.reviews;
create policy "Business members read reviews" on public.reviews for select to authenticated
  using (business_id in (select business_id from public.profiles where id = auth.uid()));

-- Staff hear about new reviews in the top-bar notifications.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('online_booking', 'client_cancelled', 'client_rescheduled', 'low_stock', 'review'));

create or replace function public.submit_review(p_appointment uuid, p_rating integer, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
  v_author text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'invalid_rating'; end if;

  select a.id, a.business_id, a.status, c.first_name, c.last_name
    into v_appt
    from public.appointments a
    join public.clients c on c.id = a.client_id
   where a.id = p_appointment and c.user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if v_appt.status <> 'completed' then raise exception 'not_completed'; end if;
  if exists (select 1 from public.reviews where appointment_id = p_appointment) then raise exception 'already_reviewed'; end if;

  -- First name and last initial, from the account or else the salon's client record.
  select nullif(trim(full_name), '') into v_author from public.profiles where id = auth.uid();
  v_author := coalesce(v_author, concat_ws(' ', v_appt.first_name, v_appt.last_name));
  v_author := split_part(v_author, ' ', 1)
    || case when split_part(v_author, ' ', 2) <> '' then ' ' || left(split_part(v_author, ' ', 2), 1) || '.' else '' end;

  insert into public.reviews (business_id, appointment_id, user_id, author_name, rating, comment, services, team_member_name)
  select v_appt.business_id, p_appointment, auth.uid(), v_author, p_rating,
         nullif(trim(coalesce(p_comment, '')), ''),
         string_agg(coalesce(s.name, 'Service'), ', ' order by i.sort_order),
         (array_agg(t.first_name order by i.sort_order))[1]
    from public.appointment_items i
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
   where i.appointment_id = p_appointment
  returning id into v_id;

  perform public.notify(v_appt.business_id, 'review', 'New ' || p_rating || '-star review',
    v_author || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 120), ''), '/calendar?appointment=' || p_appointment);
  return v_id;
end;
$$;

-- ── The signed-in customer's appointments at every salon ──
create or replace function public.my_appointments()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.item order by x.starts desc), '[]'::jsonb)
  from (
    select min(i.start_time) as starts,
      jsonb_build_object(
        'id', a.id,
        'status', a.status,
        'cancellation_reason', a.cancellation_reason,
        'manage_token', a.manage_token,
        'start', min(i.start_time),
        'end', max(i.end_time),
        'total', coalesce(sum(i.price), 0),
        'items', jsonb_agg(jsonb_build_object(
            'service_id', i.service_id,
            'name', coalesce(s.name, 'Service'),
            'price', i.price,
            'minutes', round(extract(epoch from i.end_time - i.start_time) / 60),
            'with', t.first_name
          ) order by i.sort_order, i.start_time),
        'business', jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'slug', case when b.online_booking_enabled then b.booking_slug end,
            'location', b.location,
            'categories', b.categories,
            'currency', b.currency,
            'country', b.country,
            'timezone', coalesce(b.timezone, 'Africa/Lagos'),
            'policy', b.booking_policy,
            'notice_hours', b.booking_notice_hours,
            'allow_cancel', b.allow_client_cancel,
            'allow_reschedule', b.allow_client_reschedule
          ),
        'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment)
                     from public.reviews r where r.appointment_id = a.id)
      ) as item
    from public.appointments a
    join public.clients c on c.id = a.client_id and c.user_id = auth.uid()
    join public.businesses b on b.id = a.business_id
    join public.appointment_items i on i.appointment_id = a.id
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
    where auth.uid() is not null
    group by a.id, b.id
  ) x;
$$;

-- ── Gift cards, packages and memberships the customer owns ──
create or replace function public.my_wallet()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gift_cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', g.id, 'code', g.code, 'balance', g.balance, 'initial', g.initial_value,
          'expires_on', g.expires_on, 'status', g.status, 'recipient', g.recipient_name,
          'business', jsonb_build_object('name', b.name, 'slug', case when b.online_booking_enabled then b.booking_slug end,
                                         'currency', b.currency, 'country', b.country)
        ) order by g.created_at desc), '[]'::jsonb)
      from public.gift_cards g
      join public.clients c on c.id = g.client_id and c.user_id = auth.uid()
      join public.businesses b on b.id = g.business_id
    ),
    'packages', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', cp.id, 'name', cp.name, 'expires_on', cp.expires_on, 'bought', cp.created_at,
          'items', (select coalesce(jsonb_agg(jsonb_build_object(
                        'service', ci.service_name, 'total', ci.sessions_total, 'used', ci.sessions_used)), '[]'::jsonb)
                      from public.client_package_items ci where ci.client_package_id = cp.id),
          'business', jsonb_build_object('name', b.name, 'slug', case when b.online_booking_enabled then b.booking_slug end)
        ) order by cp.created_at desc), '[]'::jsonb)
      from public.client_packages cp
      join public.clients c on c.id = cp.client_id and c.user_id = auth.uid()
      join public.businesses b on b.id = cp.business_id
    ),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', cm.id, 'name', cm.name, 'discount_percent', cm.discount_percent,
          'starts_on', cm.starts_on, 'ends_on', cm.ends_on, 'status', cm.status,
          'business', jsonb_build_object('name', b.name, 'slug', case when b.online_booking_enabled then b.booking_slug end)
        ) order by cm.ends_on desc), '[]'::jsonb)
      from public.client_memberships cm
      join public.clients c on c.id = cm.client_id and c.user_id = auth.uid()
      join public.businesses b on b.id = cm.business_id
    )
  )
  where auth.uid() is not null;
$$;

-- ── Discover: public listing of salons that take online bookings ──
create or replace function public.discover_businesses(
  p_query text default null, p_category text default null, p_city text default null, p_ids uuid[] default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.card order by x.reviews desc, x.created_at desc), '[]'::jsonb)
  from (
    select b.created_at, coalesce(r.cnt, 0) as reviews,
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.booking_slug,
        'categories', b.categories,
        'city', nullif(b.location->>'city', ''),
        'area', coalesce(nullif(b.location->>'district', ''), nullif(b.location->>'city', '')),
        'description', b.booking_description,
        'currency', b.currency,
        'country', b.country,
        'rating', r.avg,
        'review_count', coalesce(r.cnt, 0),
        'from_price', (select min(s.price) from public.services s
                        where s.business_id = b.id and not s.is_archived and s.online_booking_enabled and s.price > 0)
      ) as card
    from public.businesses b
    left join lateral (
      select round(avg(rating)::numeric, 1) as avg, count(*) as cnt from public.reviews where business_id = b.id
    ) r on true
    where b.online_booking_enabled and b.booking_slug is not null
      and (p_ids is null or b.id = any(p_ids))
      and (nullif(trim(coalesce(p_category, '')), '') is null or b.categories ? p_category)
      and (nullif(trim(coalesce(p_city, '')), '') is null
           or b.location->>'city' ilike '%' || trim(p_city) || '%'
           or b.location->>'district' ilike '%' || trim(p_city) || '%'
           or b.location->>'state' ilike '%' || trim(p_city) || '%')
      and (nullif(trim(coalesce(p_query, '')), '') is null
           or b.name ilike '%' || trim(p_query) || '%'
           or exists (select 1 from public.services s
                       where s.business_id = b.id and not s.is_archived and s.online_booking_enabled
                         and s.name ilike '%' || trim(p_query) || '%'))
    limit 60
  ) x;
$$;

-- ── Ratings and recent reviews for a salon's public page ──
create or replace function public.get_venue_reviews(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rating', (select round(avg(rating)::numeric, 1) from public.reviews where business_id = b.id),
    'count', (select count(*) from public.reviews where business_id = b.id),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object(
                    'author', r.author_name, 'rating', r.rating, 'comment', r.comment,
                    'services', r.services, 'with', r.team_member_name, 'created_at', r.created_at
                  ) order by r.created_at desc), '[]'::jsonb)
                from (select * from public.reviews where business_id = b.id order by created_at desc limit 20) r)
  )
  from public.businesses b
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled;
$$;

revoke all on function public.link_my_clients() from public;
revoke all on function public.submit_review(uuid, integer, text) from public;
revoke all on function public.my_appointments() from public;
revoke all on function public.my_wallet() from public;
revoke all on function public.discover_businesses(text, text, text, uuid[]) from public;
revoke all on function public.get_venue_reviews(text) from public;
grant execute on function public.link_my_clients() to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.my_appointments() to authenticated;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.discover_businesses(text, text, text, uuid[]) to anon, authenticated;
grant execute on function public.get_venue_reviews(text) to anon, authenticated;


-- ===== 20261021090000_security_tenancy_fix.sql =====
-- Security fixes from the audit (C1, H1, H2, L2, L5, L6).
--
-- C1: most RLS policies trusted profiles.business_id, which users could write themselves.
--     Membership now comes from rows users can't forge: businesses.owner_id, or an active
--     team_members row (created by the owner, claimed through the invite server function).
-- H1: pay, timesheets, deals and tax settings are limited to the owner and admins.
-- H2: the token-less "claim any pending invite" policy is removed; invites get an expiry.

-- ── 1. Trusted membership checks ──
alter table public.team_members add column if not exists access_level text not null default 'staff';
alter table public.team_members drop constraint if exists team_members_access_level_check;
alter table public.team_members add constraint team_members_access_level_check
  check (access_level in ('staff', 'admin'));
alter table public.team_members add column if not exists invite_expires_at timestamptz;

create or replace function public.is_business_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_business is not null and auth.uid() is not null and (
    exists (select 1 from public.businesses b where b.id = p_business and b.owner_id = auth.uid())
    or exists (select 1 from public.team_members t
               where t.business_id = p_business and t.user_id = auth.uid() and t.invite_status = 'active')
  );
$$;

create or replace function public.is_business_admin(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_business is not null and auth.uid() is not null and (
    exists (select 1 from public.businesses b where b.id = p_business and b.owner_id = auth.uid())
    or exists (select 1 from public.team_members t
               where t.business_id = p_business and t.user_id = auth.uid()
                 and t.invite_status = 'active' and t.access_level = 'admin')
  );
$$;

revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.is_business_admin(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_admin(uuid) to authenticated;

-- ── 2. Profiles: people edit their personal fields only, never business_id or user_type ──
revoke insert, update on public.profiles from authenticated;
grant insert (id, full_name, phone, avatar_url, country, timezone, onboarded_at) on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, country, timezone, onboarded_at,
              birthday, gender, email_reminders, marketing_emails) on public.profiles to authenticated;

-- Even privileged paths may only point a profile at a business its user owns or is an active
-- member of. Replaces the narrower 20 Oct guard (same function, one trigger).
create or replace function public.guard_profile_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
     and not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.id)
     and not exists (select 1 from public.team_members t
                     where t.business_id = new.business_id and t.user_id = new.id and t.invite_status = 'active')
  then
    raise exception 'not_a_member_of_business' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_business() from public, anon, authenticated;
drop trigger if exists profiles_business_guard on public.profiles;
drop trigger if exists profiles_guard_business on public.profiles;
create trigger profiles_guard_business before insert or update of business_id on public.profiles
  for each row execute function public.guard_profile_business();

-- The only way the app sets business_id: link the caller to a business they own.
create or replace function public.link_my_business(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.profiles set business_id = p_business where id = auth.uid();
end;
$$;
revoke all on function public.link_my_business(uuid) from public, anon;
grant execute on function public.link_my_business(uuid) to authenticated;

-- L5: don't take user_type from sign-up data, except "customer" (which grants nothing; customer
-- sign-up uses it so the account isn't mistaken for a business).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, user_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    case when new.raw_user_meta_data ->> 'user_type' = 'customer' then 'customer' else 'business_owner' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── 3. Rewrite every policy that trusted profiles.business_id ──
-- Found dynamically so tables from any earlier migration are covered.
do $$
declare
  p record;
  v_has_col boolean;
begin
  for p in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'profiles'
      and (coalesce(qual, '') ~* 'from\s+(public\.)?profiles' or coalesce(with_check, '') ~* 'from\s+(public\.)?profiles')
  loop
    select exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = p.tablename and column_name = 'business_id')
      into v_has_col;
    if not v_has_col then
      raise exception 'policy %.% trusts profiles but the table has no business_id; fix by hand', p.tablename, p.policyname;
    end if;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    if p.cmd in ('SELECT', 'DELETE') then
      execute format('create policy %I on public.%I for %s to authenticated using (public.is_business_member(business_id))',
                     p.policyname, p.tablename, p.cmd);
    elsif p.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.is_business_member(business_id))',
                     p.policyname, p.tablename);
    else -- ALL / UPDATE
      execute format('create policy %I on public.%I for %s to authenticated
                        using (public.is_business_member(business_id))
                        with check (public.is_business_member(business_id))',
                     p.policyname, p.tablename, p.cmd);
    end if;
  end loop;
end $$;

-- ── 4. H1: owner/admin-only data ──
-- Pay runs, pay lines and timesheets: owner and admins only.
-- Deals and tax rates: every member can read them (checkout needs them); only admins change them.
do $$
declare t text;
begin
  foreach t in array array['pay_runs', 'pay_run_lines', 'timesheets'] loop
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format('drop policy if exists "Business admins manage %s" on public.%I', t, t);
    execute format('create policy "Business admins manage %s" on public.%I for all to authenticated
                      using (public.is_business_admin(business_id))
                      with check (public.is_business_admin(business_id))', t, t);
  end loop;

  foreach t in array array['deals', 'tax_rates'] loop
    execute format('drop policy if exists "Business members manage %s" on public.%I', t, t);
    execute format('drop policy if exists "Business members read %s" on public.%I', t, t);
    execute format('drop policy if exists "Business admins manage %s" on public.%I', t, t);
    execute format('create policy "Business members read %s" on public.%I for select to authenticated
                      using (public.is_business_member(business_id))', t, t);
    execute format('create policy "Business admins manage %s" on public.%I for all to authenticated
                      using (public.is_business_admin(business_id))
                      with check (public.is_business_admin(business_id))', t, t);
  end loop;
end $$;

-- ── 5. H2: invites are claimed only through the server function ──
drop policy if exists "invited_user_can_claim_own_team_member_row" on public.team_members;

-- ── 6. Functions that trusted profiles.business_id ──
create or replace function public.check_deal(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null or not public.is_business_member(v_business) then raise exception 'not_allowed'; end if;
  v_deal := public.usable_deal(v_business, p_code, false);
  return jsonb_build_object('id', v_deal.id, 'name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type,
                            'value', v_deal.value, 'applies_to', v_deal.applies_to);
end;
$$;
revoke all on function public.check_deal(text) from public, anon;
grant execute on function public.check_deal(text) to authenticated;

-- L6: the recorded amount can't be more than the sale's items are worth.
create or replace function public.redeem_deal(p_code text, p_sale uuid, p_amount numeric)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype; v_items numeric;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null or not public.is_business_member(v_business) then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.sales where id = p_sale and business_id = v_business) then
    raise exception 'not_allowed';
  end if;
  select coalesce(sum(price * quantity), 0) into v_items from public.sale_items where sale_id = p_sale;
  v_deal := public.usable_deal(v_business, p_code, false);
  insert into public.deal_redemptions (business_id, deal_id, sale_id, amount)
  values (v_business, v_deal.id, p_sale, least(greatest(0, coalesce(p_amount, 0)), greatest(v_items, 0)));
end;
$$;
revoke all on function public.redeem_deal(text, uuid, numeric) from public, anon;
grant execute on function public.redeem_deal(text, uuid, numeric) to authenticated;

-- L2: gift-card codes from a secure random source (gen_random_uuid uses the OS CSPRNG).
-- 256 is a multiple of 32, so "byte % 32" picks characters without bias.
create or replace function public.new_gift_card_code(p_business uuid)
returns text language plpgsql volatile security invoker set search_path = public as $$
declare
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  if not public.is_business_member(p_business) then raise exception 'not_allowed'; end if;
  loop
    v_bytes := uuid_send(gen_random_uuid());
    select string_agg(substr(v_chars, 1 + (get_byte(v_bytes, i) % 32), 1), '' order by i)
      into v_code from generate_series(0, 7) i;
    exit when not exists (select 1 from public.gift_cards where business_id = p_business and code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.new_gift_card_code(uuid) from public, anon;
grant execute on function public.new_gift_card_code(uuid) to authenticated;

-- ── 7. Repair: detach profiles pointing at a business they don't belong to ──
-- (Your check on 20 Oct found none; kept so the file is safe on any database.)
create table if not exists public.security_audit_detached_profiles (
  profile_id uuid not null,
  business_id uuid not null,
  detached_at timestamptz not null default now()
);
alter table public.security_audit_detached_profiles enable row level security; -- no policies: service role only
revoke all on public.security_audit_detached_profiles from anon, authenticated;

with bad as (
  select p.id, p.business_id from public.profiles p
  where p.business_id is not null
    and not exists (select 1 from public.businesses b where b.id = p.business_id and b.owner_id = p.id)
    and not exists (select 1 from public.team_members t
                    where t.business_id = p.business_id and t.user_id = p.id and t.invite_status = 'active')
), logged as (
  insert into public.security_audit_detached_profiles (profile_id, business_id)
  select id, business_id from bad returning profile_id
)
update public.profiles set business_id = null where id in (select profile_id from logged);


-- ===== 20261021120000_account_classes.sql =====
-- Two classes of user, like Fresha/Booksy: customer accounts (sign up at /sign-in) and business
-- accounts (owners and staff, sign up at /auth). One login belongs to one class:
-- customers can't create, join or link a business; business logins can't act as customers.
-- profiles.user_type is set once at sign-up (handle_new_user) and users can't change it.

create or replace function public.is_customer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select user_type = 'customer' from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_customer() from public, anon;
grant execute on function public.is_customer() to authenticated;

-- ── Customers never get a business ──
create or replace function public.guard_profile_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
  then
    -- Check the old type too: claiming a staff invite switches user_type to 'staff' in the same update.
    if new.user_type = 'customer' or (tg_op = 'UPDATE' and old.user_type = 'customer') then
      raise exception 'customer_account' using errcode = '42501';
    end if;
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.id)
       and not exists (select 1 from public.team_members t
                       where t.business_id = new.business_id and t.user_id = new.id and t.invite_status = 'active')
    then
      raise exception 'not_a_member_of_business' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_business() from public, anon, authenticated;

drop policy if exists "Owners can insert businesses" on public.businesses;
create policy "Owners can insert businesses" on public.businesses for insert to authenticated
  with check (auth.uid() = owner_id and not public.is_customer());

create or replace function public.link_my_business(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_customer() then raise exception 'customer_account' using errcode = '42501'; end if;
  if not exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.profiles set business_id = p_business where id = auth.uid();
end;
$$;
revoke all on function public.link_my_business(uuid) from public, anon;
grant execute on function public.link_my_business(uuid) to authenticated;

-- ── Customer features are for customer accounts only ──
create or replace function public.link_my_clients()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_count integer;
begin
  if not public.is_customer() then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email = '' then return 0; end if;
  update public.clients set user_id = auth.uid() where user_id is null and lower(email) = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop policy if exists "Customers manage their favourites" on public.favorite_businesses;
create policy "Customers manage their favourites" on public.favorite_businesses for all to authenticated
  using (user_id = auth.uid() and public.is_customer())
  with check (user_id = auth.uid() and public.is_customer());

-- my_appointments / my_wallet / submit_review only see client records linked to the caller,
-- and only customers can link, so unlinking non-customers below closes them too. The review
-- function also checks directly.
create or replace function public.submit_review(p_appointment uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_appt record;
  v_author text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not public.is_customer() then raise exception 'customer_account_required'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'invalid_rating'; end if;

  select a.id, a.business_id, a.status, c.first_name, c.last_name
    into v_appt
    from public.appointments a
    join public.clients c on c.id = a.client_id
   where a.id = p_appointment and c.user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if v_appt.status <> 'completed' then raise exception 'not_completed'; end if;
  if exists (select 1 from public.reviews where appointment_id = p_appointment) then raise exception 'already_reviewed'; end if;

  select nullif(trim(full_name), '') into v_author from public.profiles where id = auth.uid();
  v_author := coalesce(v_author, concat_ws(' ', v_appt.first_name, v_appt.last_name));
  v_author := split_part(v_author, ' ', 1)
    || case when split_part(v_author, ' ', 2) <> '' then ' ' || left(split_part(v_author, ' ', 2), 1) || '.' else '' end;

  insert into public.reviews (business_id, appointment_id, user_id, author_name, rating, comment, services, team_member_name)
  select v_appt.business_id, p_appointment, auth.uid(), v_author, p_rating,
         nullif(trim(coalesce(p_comment, '')), ''),
         string_agg(coalesce(s.name, 'Service'), ', ' order by i.sort_order),
         (array_agg(t.first_name order by i.sort_order))[1]
    from public.appointment_items i
    left join public.services s on s.id = i.service_id
    left join public.team_members t on t.id = i.team_member_id
   where i.appointment_id = p_appointment
  returning id into v_id;

  perform public.notify(v_appt.business_id, 'review', 'New ' || p_rating || '-star review',
    v_author || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 120), ''), '/calendar?appointment=' || p_appointment);
  return v_id;
end;
$$;
revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- ── Clean up links made before the classes were separate (e.g. testing with a business login) ──
update public.clients c set user_id = null
  where c.user_id is not null
    and not exists (select 1 from public.profiles p where p.id = c.user_id and p.user_type = 'customer');
delete from public.favorite_businesses f
  where not exists (select 1 from public.profiles p where p.id = f.user_id and p.user_type = 'customer');


-- ===== 20261022090000_security_fixes_2.sql =====
-- Second security review (22 Oct 2026).
-- #1 Owners could set a team row's user_id to anyone and "revoke" them, banning that account
--    platform-wide. Protected team_members columns can now only change through the server.
-- #2/#3 Rate limits on the public booking and promo-code functions; promo previews no longer
--    lock the deal row; online bookings only reuse a client record the booker has proved is theirs.
-- #5 Admin-only: deleting sales, changing lines of finished sales, voiding gift cards, deleting products.

-- ── #1 team_members: user_id, invite fields and access_level are server-only ──
revoke update on public.team_members from authenticated;
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'team_members'
    and column_name not in ('id', 'business_id', 'user_id', 'invite_status', 'invite_token',
                            'invite_expires_at', 'access_level', 'initials', 'created_at')
    and is_generated = 'NEVER';
  execute format('grant update (%s) on public.team_members to authenticated', v_cols);
end $$;

-- New rows from the browser start unlinked, uninvited and staff-level. The one exception is the
-- owner adding themselves to their own team (the app does this so they can take bookings).
-- Not security definer on purpose: current_user must be the caller's role.
create or replace function public.guard_team_member_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.user_id is not null and not (
       new.user_id = auth.uid()
       and exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = auth.uid())
     ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  new.invite_status := case when new.user_id is null then 'not_invited' else new.invite_status end;
  new.invite_token := null;
  new.invite_expires_at := null;
  new.access_level := 'staff';
  return new;
end;
$$;
revoke all on function public.guard_team_member_insert() from public, anon, authenticated;
drop trigger if exists team_members_guard_insert on public.team_members;
create trigger team_members_guard_insert before insert on public.team_members
  for each row execute function public.guard_team_member_insert();

-- ── #2/#3 Rate limiting ──
-- Counts hits per key in a fixed window. Keys combine the action with the caller's IP (from the
-- request headers Supabase passes through), the signed-in account, or the salon.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security; -- no policies: functions only
revoke all on public.rate_limits from anon, authenticated;

-- The caller's IP as Supabase's edge reports it ("unknown" if it isn't passed through).
create or replace function public.request_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(trim(h ->> 'cf-connecting-ip'), ''),
    nullif(trim(h ->> 'x-real-ip'), ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x;
$$;
grant execute on function public.request_ip() to anon, authenticated;

create or replace function public.limit_requests(p_key text, p_limit integer, p_window interval)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  -- Occasionally clear out old windows so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  if v_hits > p_limit then raise exception 'too_many_requests'; end if;
end;
$$;
revoke all on function public.limit_requests(text, integer, interval) from public, anon, authenticated;

-- Promo codes: previews don't lock the deal row; only redemption does.
drop function if exists public.usable_deal(uuid, text, boolean);
create or replace function public.usable_deal(p_business uuid, p_code text, p_online boolean, p_lock boolean default true)
returns public.deals language plpgsql volatile security definer set search_path = public as $$
declare v_deal public.deals%rowtype; v_used int;
begin
  if p_lock then
    select * into v_deal from public.deals
      where business_id = p_business and code = upper(trim(p_code)) and is_active
      for update;
  else
    select * into v_deal from public.deals
      where business_id = p_business and code = upper(trim(p_code)) and is_active;
  end if;
  if not found then raise exception 'deal_not_found'; end if;
  if p_online and not v_deal.online then raise exception 'deal_not_online'; end if;
  if v_deal.starts_on is not null and v_deal.starts_on > current_date then raise exception 'deal_not_started'; end if;
  if v_deal.ends_on is not null and v_deal.ends_on < current_date then raise exception 'deal_expired'; end if;
  if v_deal.max_uses is not null then
    select count(*) into v_used from public.deal_redemptions where deal_id = v_deal.id;
    if v_used >= v_deal.max_uses then raise exception 'deal_used_up'; end if;
  end if;
  return v_deal;
end;
$$;
revoke all on function public.usable_deal(uuid, text, boolean, boolean) from public, anon, authenticated;

-- Public promo check: limited per visitor and per salon, and no row lock.
create or replace function public.check_booking_deal(p_slug text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('promo:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '10 minutes');
  end if;
  perform public.limit_requests('promo-salon:' || lower(p_slug), 100, interval '10 minutes');
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then raise exception 'booking_unavailable'; end if;
  -- A bad code is returned as {"error": ...} rather than raised, so the attempt still counts
  -- towards the limit above (raising would roll the count back).
  begin
    v_deal := public.usable_deal(v_business, p_code, true, false);
  exception when raise_exception then
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object('name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type, 'value', v_deal.value);
end;
$$;
revoke all on function public.check_booking_deal(text, text) from public;
grant execute on function public.check_booking_deal(text, text) to anon, authenticated;

-- Checkout preview (staff): no lock either.
create or replace function public.check_deal(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  select business_id into v_business from public.profiles where id = auth.uid();
  if v_business is null or not public.is_business_member(v_business) then raise exception 'not_allowed'; end if;
  v_deal := public.usable_deal(v_business, p_code, false, false);
  return jsonb_build_object('id', v_deal.id, 'name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type,
                            'value', v_deal.value, 'applies_to', v_deal.applies_to);
end;
$$;
revoke all on function public.check_deal(text) from public, anon;
grant execute on function public.check_deal(text) to authenticated;

-- ── #3 Online bookings: safer client matching (core) and rate limits (wrapper) ──
create or replace function public.create_booking_core(
  p_slug text,
  p_items jsonb,
  p_start timestamptz,
  p_client jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_tz text;
  v_client_id uuid;
  v_appointment_id uuid;
  v_cursor timestamptz := p_start;
  v_item jsonb;
  v_service public.services%rowtype;
  v_member uuid;
  v_end timestamptz;
  v_first text := nullif(trim(p_client->>'first_name'), '');
  v_last text := nullif(trim(p_client->>'last_name'), '');
  v_email text := lower(nullif(trim(p_client->>'email'), ''));
  v_phone text := nullif(regexp_replace(coalesce(p_client->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_sort int := 0;
begin
  select * into v_business from public.businesses
    where booking_slug = lower(p_slug) and online_booking_enabled;
  if not found then raise exception 'booking_unavailable'; end if;
  v_tz := coalesce(v_business.timezone, 'Africa/Lagos');

  if v_first is null or length(v_first) > 100 or coalesce(length(v_last), 0) > 100 then
    raise exception 'invalid_client';
  end if;
  if v_email is null and v_phone is null then raise exception 'contact_required'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '180 days' then
    raise exception 'invalid_time';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 6 then
    raise exception 'invalid_services';
  end if;

  -- Reuse an existing client record only when the caller has shown it's theirs: a signed-in
  -- customer booking with their own confirmed email, or both email and phone matching.
  -- Otherwise a new record is made, so nobody can add bookings to someone else's history
  -- just by knowing their email or phone number.
  if v_email is not null and public.is_customer()
     and v_email = (select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null)
  then
    select id into v_client_id from public.clients
      where business_id = v_business.id and lower(email) = v_email
      order by (user_id = auth.uid()) desc nulls last, created_at
      limit 1;
  elsif v_email is not null and v_phone is not null then
    select id into v_client_id from public.clients
      where business_id = v_business.id and lower(email) = v_email and phone = v_phone
      order by created_at
      limit 1;
  end if;
  if v_client_id is null then
    insert into public.clients (business_id, first_name, last_name, email, phone, client_source)
    values (v_business.id, v_first, v_last, v_email, v_phone, 'online_booking')
    returning id into v_client_id;
  end if;

  insert into public.appointments (business_id, client_id, is_walk_in, status, notes)
  values (v_business.id, v_client_id, false, 'booked', left(nullif(trim(p_notes), ''), 1000))
  returning id into v_appointment_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service from public.services
      where id = (v_item->>'service_id')::uuid and business_id = v_business.id
        and not is_archived and online_booking_enabled;
    if not found then raise exception 'invalid_services'; end if;
    v_end := v_cursor + make_interval(mins => v_service.duration_minutes);

    v_member := nullif(v_item->>'team_member_id', '')::uuid;
    if v_member is null then
      select t.id into v_member
      from public.team_members t
      where t.business_id = v_business.id and t.is_active
        and (not exists (select 1 from public.service_team_members x where x.service_id = v_service.id)
             or exists (select 1 from public.service_team_members x
                        where x.service_id = v_service.id and x.team_member_id = t.id))
        and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)
        and not exists (select 1 from public.appointment_items i
                        where i.team_member_id = t.id and i.is_blocking
                          and tstzrange(i.start_time, i.end_time) && tstzrange(v_cursor, v_end))
        and not exists (select 1 from public.blocked_times bt
                        where bt.team_member_id = t.id and not bt.online_booking_allowed
                          and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end))
      order by t.created_at
      limit 1;
      if v_member is null then
        -- Nobody free: say whether it's because nobody works then, or everyone is booked.
        if exists (select 1 from public.team_members t
                   where t.business_id = v_business.id and t.is_active
                     and public.member_is_working(v_business.id, t.id, v_cursor, v_end, v_tz)) then
          raise exception 'slot_taken';
        end if;
        raise exception 'outside_hours';
      end if;
    else
      if not exists (select 1 from public.team_members t
                     where t.id = v_member and t.business_id = v_business.id and t.is_active) then
        raise exception 'invalid_team_member';
      end if;
      if not public.member_is_working(v_business.id, v_member, v_cursor, v_end, v_tz) then
        raise exception 'outside_hours';
      end if;
      if exists (select 1 from public.blocked_times bt
                 where bt.team_member_id = v_member and not bt.online_booking_allowed
                   and tstzrange(bt.start_time, bt.end_time) && tstzrange(v_cursor, v_end)) then
        raise exception 'slot_taken';
      end if;
    end if;

    begin
      insert into public.appointment_items
        (appointment_id, business_id, service_id, team_member_id, start_time, end_time, price, sort_order)
      values
        (v_appointment_id, v_business.id, v_service.id, v_member, v_cursor, v_end,
         case when v_service.pricing_type = 'free' then 0 else v_service.price end, v_sort);
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;

    v_cursor := v_end;
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('appointment_id', v_appointment_id, 'start', p_start, 'end', v_cursor);
end;
$$;
revoke all on function public.create_booking_core(text, jsonb, timestamptz, jsonb, text) from public, anon, authenticated;

create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_appointment uuid;
  v_business uuid;
  v_deal public.deals%rowtype;
  v_total numeric;
  v_discount numeric := 0;
begin
  -- Spam protection: per visitor (or signed-in account) and per salon.
  -- (Skipped when the visitor can't be identified, so unknown visitors don't share one bucket.)
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('book:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '1 hour');
  end if;
  perform public.limit_requests('book-salon:' || lower(p_slug), 60, interval '1 hour');

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;
  select business_id into v_business from public.appointments where id = v_appointment;

  if v_deal.id is not null then
    select coalesce(sum(price), 0) into v_total from public.appointment_items where appointment_id = v_appointment;
    v_discount := least(v_total, case when v_deal.discount_type = 'percent' then round(v_total * v_deal.value / 100, 2) else v_deal.value end);
    if v_total > 0 and v_discount > 0 then
      update public.appointment_items
        set price = round(price - price / v_total * v_discount, 2)
        where appointment_id = v_appointment;
    end if;
    insert into public.deal_redemptions (business_id, deal_id, appointment_id, amount)
    values (v_deal.business_id, v_deal.id, v_appointment, v_discount);
    update public.appointments
      set notes = concat_ws(E'\n', notes, 'Promo code ' || v_deal.code || ' applied')
      where id = v_appointment;
  end if;

  perform public.notify(v_business, 'online_booking', 'New online booking',
    public.appointment_summary(v_appointment), '/calendar?appointment=' || v_appointment);

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;

-- ── #5 Admin-only for destructive or money-changing actions ──
-- Sales: members can create and update; only admins delete.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sales' loop
    execute format('drop policy %I on public.sales', p.policyname);
  end loop;
end $$;
create policy "Business members use sales" on public.sales for select to authenticated
  using (public.is_business_member(business_id));
create policy "Business members add sales" on public.sales for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "Business members update sales" on public.sales for update to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Business admins delete sales" on public.sales for delete to authenticated
  using (public.is_business_admin(business_id));

-- Sale lines: members can add lines, but removing or editing them needs a draft sale (checkout
-- re-saves drafts) or an admin. Server and SQL-editor changes (no signed-in user) are allowed.
create or replace function public.guard_sale_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_business uuid; v_status text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select business_id, status into v_business, v_status from public.sales where id = old.sale_id;
  -- Deleting a whole sale (or business) cascades here; let that through.
  if v_business is null then return coalesce(new, old); end if;
  if v_status <> 'draft' and not public.is_business_admin(v_business) then
    raise exception 'sale_locked' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.guard_sale_items() from public, anon, authenticated;
drop trigger if exists sale_items_guard on public.sale_items;
create trigger sale_items_guard before update or delete on public.sale_items
  for each row execute function public.guard_sale_items();

-- Gift cards: voiding (or un-voiding) a card is admin-only. Balances already change only
-- through redemptions.
create or replace function public.guard_gift_card_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.status is distinct from old.status
     and not public.is_business_admin(new.business_id) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_gift_card_status() from public, anon, authenticated;
drop trigger if exists gift_cards_guard_status on public.gift_cards;
create trigger gift_cards_guard_status before update on public.gift_cards
  for each row execute function public.guard_gift_card_status();

-- Products: only admins delete them (stock history stays meaningful).
do $$
declare p record;
begin
  for p in select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'products' loop
    execute format('drop policy %I on public.products', p.policyname);
  end loop;
end $$;
create policy "Business members read products" on public.products for select to authenticated
  using (public.is_business_member(business_id));
create policy "Business members add products" on public.products for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "Business members update products" on public.products for update to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Business admins delete products" on public.products for delete to authenticated
  using (public.is_business_admin(business_id));


-- ===== 20261022120000_sale_lock.sql =====
-- Third security review (22 Oct 2026): lock finished sales properly, admin-only deletion of stored
-- value (gift cards, packages, memberships, redemptions), and rate-limit tuning.

-- ── Finished sales: staff can't reopen, re-price, refund or edit them ──
-- Who finished a sale and when, so checkout's own last step (adding the lines, which deducts
-- stock) still works for the person who just completed it.
alter table public.sales add column if not exists finalized_at timestamptz;
alter table public.sales add column if not exists finalized_by uuid;

create or replace function public.guard_sales_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Record the moment a sale stops being a draft.
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.finalized_at := now();
    new.finalized_by := auth.uid();
  elsif tg_op = 'UPDATE' and auth.uid() is not null then
    -- People can't move the finish time (it decides who may still add lines).
    new.finalized_at := old.finalized_at;
    new.finalized_by := old.finalized_by;
  end if;

  -- Once finished, only admins may change it (status, totals, payment, client, date...).
  -- Notes stay editable. The server and SQL editor (no signed-in user) are not restricted.
  if tg_op = 'UPDATE' and auth.uid() is not null and old.status <> 'draft'
     and not public.is_business_admin(old.business_id)
     and (to_jsonb(new) - 'notes' - 'updated_at') is distinct from (to_jsonb(old) - 'notes' - 'updated_at')
  then
    raise exception 'sale_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_sales_write() from public, anon, authenticated;
drop trigger if exists sales_guard_write on public.sales;
create trigger sales_guard_write before insert or update on public.sales
  for each row execute function public.guard_sales_write();

-- Sale lines: drafts are open; finished sales are admin-only, except that the person who just
-- finished a sale has 2 minutes to add its lines (checkout does this right after completing).
create or replace function public.guard_sale_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales%rowtype;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select * into v_sale from public.sales where id = coalesce(new.sale_id, old.sale_id);
  -- Deleting a whole sale (or business) cascades here; let that through.
  if not found then return coalesce(new, old); end if;
  if v_sale.status = 'draft' or public.is_business_admin(v_sale.business_id) then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and v_sale.finalized_by = auth.uid() and v_sale.finalized_at > now() - interval '2 minutes' then
    return new;
  end if;
  raise exception 'sale_locked' using errcode = '42501';
end;
$$;
revoke all on function public.guard_sale_items() from public, anon, authenticated;
drop trigger if exists sale_items_guard on public.sale_items;
create trigger sale_items_guard before insert or update or delete on public.sale_items
  for each row execute function public.guard_sale_items();

-- Redemption checks: membership comes from is_business_member, not the profile's business link.
create or replace function public.apply_gift_card_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_card public.gift_cards%rowtype;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not public.is_business_member(new.business_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_card from public.gift_cards where id = new.gift_card_id and business_id = new.business_id for update;
  if not found then raise exception 'gift_card_not_found'; end if;
  if v_card.status <> 'active' then raise exception 'gift_card_void'; end if;
  if v_card.expires_on is not null and v_card.expires_on < current_date then raise exception 'gift_card_expired'; end if;
  if v_card.balance < new.amount then raise exception 'gift_card_insufficient'; end if;
  update public.gift_cards set balance = balance - new.amount where id = v_card.id;
  return new;
end;
$$;
revoke all on function public.apply_gift_card_redemption() from public, anon, authenticated;

create or replace function public.apply_package_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item public.client_package_items%rowtype; v_expires date;
begin
  -- Runs before row-level security checks, so confirm the caller belongs to this business first.
  if auth.uid() is not null and not public.is_business_member(new.business_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_item from public.client_package_items where id = new.client_package_item_id and business_id = new.business_id for update;
  if not found then raise exception 'package_not_found'; end if;
  select expires_on into v_expires from public.client_packages where id = v_item.client_package_id;
  if v_expires is not null and v_expires < current_date then raise exception 'package_expired'; end if;
  if v_item.sessions_used + new.sessions > v_item.sessions_total then raise exception 'package_used_up'; end if;
  update public.client_package_items set sessions_used = sessions_used + new.sessions where id = v_item.id;
  return new;
end;
$$;
revoke all on function public.apply_package_redemption() from public, anon, authenticated;

-- ── Stored value: only admins delete it ──
-- Splits each "for all" member policy into select/insert/update for members and delete for admins.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['gift_cards', 'gift_card_redemptions', 'packages', 'client_packages',
                           'client_package_items', 'package_redemptions', 'memberships',
                           'client_memberships', 'deal_redemptions'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname, cmd from pg_policies where schemaname = 'public' and tablename = t loop
      if p.cmd = 'ALL' then
        execute format('drop policy %I on public.%I', p.policyname, t);
        execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(business_id))',
                       'Business members read ' || t, t);
        execute format('create policy %I on public.%I for insert to authenticated with check (public.is_business_member(business_id))',
                       'Business members add ' || t, t);
        execute format('create policy %I on public.%I for update to authenticated
                          using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))',
                       'Business members update ' || t, t);
        execute format('create policy %I on public.%I for delete to authenticated using (public.is_business_admin(business_id))',
                       'Business admins delete ' || t, t);
      elsif p.cmd = 'DELETE' and p.policyname <> 'Business admins delete ' || t then
        execute format('drop policy %I on public.%I', p.policyname, t);
        execute format('create policy %I on public.%I for delete to authenticated using (public.is_business_admin(business_id))',
                       'Business admins delete ' || t, t);
      end if;
    end loop;
  end loop;
end $$;

-- ── Rate limits ──
-- (request_ip trusts cf-connecting-ip / x-real-ip / x-forwarded-for. On Supabase's hosted
-- platform the edge overwrites these, so visitors can't fake them; tested 22 Oct 2026. If you
-- ever self-host, only trust the header your own proxy sets.)

-- Promo check: per-visitor limit first, then a high per-salon cap, counted only for real salons.
create or replace function public.check_booking_deal(p_slug text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_business uuid; v_deal public.deals%rowtype;
begin
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('promo:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '10 minutes');
  end if;
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then raise exception 'booking_unavailable'; end if;
  perform public.limit_requests('promo-salon:' || v_business, 500, interval '10 minutes');
  -- A bad code is returned as {"error": ...} rather than raised, so the attempt still counts.
  begin
    v_deal := public.usable_deal(v_business, p_code, true, false);
  exception when raise_exception then
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object('name', v_deal.name, 'code', v_deal.code, 'discount_type', v_deal.discount_type, 'value', v_deal.value);
end;
$$;
revoke all on function public.check_booking_deal(text, text) from public;
grant execute on function public.check_booking_deal(text, text) to anon, authenticated;

-- Online bookings: same pattern.
create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_appointment uuid;
  v_business uuid;
  v_deal public.deals%rowtype;
  v_total numeric;
  v_discount numeric := 0;
begin
  -- Spam protection: per visitor (or signed-in account) first, then a high per-salon cap counted
  -- only for real salons. (The visitor limit is skipped when they can't be identified, so unknown
  -- visitors don't share one bucket.)
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('book:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '1 hour');
  end if;
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then return jsonb_build_object('error', 'booking_unavailable'); end if;
  perform public.limit_requests('book-salon:' || v_business, 300, interval '1 hour');

  -- Booking problems (slot taken, bad service, bad code...) come back as {"error": ...} instead of
  -- being raised, so failed attempts still count towards the limits above.
  begin
  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;
  select business_id into v_business from public.appointments where id = v_appointment;

  if v_deal.id is not null then
    select coalesce(sum(price), 0) into v_total from public.appointment_items where appointment_id = v_appointment;
    v_discount := least(v_total, case when v_deal.discount_type = 'percent' then round(v_total * v_deal.value / 100, 2) else v_deal.value end);
    if v_total > 0 and v_discount > 0 then
      update public.appointment_items
        set price = round(price - price / v_total * v_discount, 2)
        where appointment_id = v_appointment;
    end if;
    insert into public.deal_redemptions (business_id, deal_id, appointment_id, amount)
    values (v_deal.business_id, v_deal.id, v_appointment, v_discount);
    update public.appointments
      set notes = concat_ws(E'\n', notes, 'Promo code ' || v_deal.code || ' applied')
      where id = v_appointment;
  end if;

  perform public.notify(v_business, 'online_booking', 'New online booking',
    public.appointment_summary(v_appointment), '/calendar?appointment=' || v_appointment);

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
  exception when raise_exception then
    return jsonb_build_object('error', sqlerrm);
  end;
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;


-- ===== 20261022140000_sale_items_guard.sql =====
-- Fourth review (22 Oct 2026): lines can't be moved between sales or attached to another
-- business's sale, and malformed booking attempts count towards the limit too.

create or replace function public.guard_sale_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales%rowtype;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  -- Lines never move between sales (moving one out of a finished sale would empty it).
  if tg_op = 'UPDATE' and new.sale_id is distinct from old.sale_id then
    raise exception 'sale_locked' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = coalesce(new.sale_id, old.sale_id);
  -- Deleting a whole sale (or business) cascades here; let that through.
  if not found then return coalesce(new, old); end if;
  -- A line belongs to the same business as its sale.
  if tg_op <> 'DELETE' and new.business_id is distinct from v_sale.business_id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_sale.status = 'draft' or public.is_business_admin(v_sale.business_id) then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and v_sale.finalized_by = auth.uid() and v_sale.finalized_at > now() - interval '2 minutes' then
    return new;
  end if;
  raise exception 'sale_locked' using errcode = '42501';
end;
$$;
revoke all on function public.guard_sale_items() from public, anon, authenticated;

create or replace function public.create_booking(
  p_slug text, p_items jsonb, p_start timestamptz, p_client jsonb, p_notes text default null, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_appointment uuid;
  v_business uuid;
  v_deal public.deals%rowtype;
  v_total numeric;
  v_discount numeric := 0;
begin
  -- Spam protection: per visitor (or signed-in account) first, then a high per-salon cap counted
  -- only for real salons. (The visitor limit is skipped when they can't be identified, so unknown
  -- visitors don't share one bucket.)
  if auth.uid() is not null or public.request_ip() <> 'unknown' then
    perform public.limit_requests('book:' || coalesce(auth.uid()::text, public.request_ip()), 10, interval '1 hour');
  end if;
  select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
  if v_business is null then return jsonb_build_object('error', 'booking_unavailable'); end if;
  perform public.limit_requests('book-salon:' || v_business, 300, interval '1 hour');

  -- Booking problems (slot taken, bad service, bad code...) come back as {"error": ...} instead of
  -- being raised, so failed attempts still count towards the limits above.
  begin
  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select id into v_business from public.businesses where booking_slug = lower(p_slug) and online_booking_enabled;
    if v_business is null then raise exception 'booking_unavailable'; end if;
    v_deal := public.usable_deal(v_business, p_code, true);
  end if;

  v_result := public.create_booking_core(p_slug, p_items, p_start, p_client, p_notes);
  v_appointment := (v_result->>'appointment_id')::uuid;
  select business_id into v_business from public.appointments where id = v_appointment;

  if v_deal.id is not null then
    select coalesce(sum(price), 0) into v_total from public.appointment_items where appointment_id = v_appointment;
    v_discount := least(v_total, case when v_deal.discount_type = 'percent' then round(v_total * v_deal.value / 100, 2) else v_deal.value end);
    if v_total > 0 and v_discount > 0 then
      update public.appointment_items
        set price = round(price - price / v_total * v_discount, 2)
        where appointment_id = v_appointment;
    end if;
    insert into public.deal_redemptions (business_id, deal_id, appointment_id, amount)
    values (v_deal.business_id, v_deal.id, v_appointment, v_discount);
    update public.appointments
      set notes = concat_ws(E'\n', notes, 'Promo code ' || v_deal.code || ' applied')
      where id = v_appointment;
  end if;

  perform public.notify(v_business, 'online_booking', 'New online booking',
    public.appointment_summary(v_appointment), '/calendar?appointment=' || v_appointment);

  return v_result
    || jsonb_build_object('manage_token', public.booking_manage_token(v_appointment), 'discount', v_discount);
  exception
    when raise_exception then
      return jsonb_build_object('error', sqlerrm);
    -- Malformed input (a bad service id, say) also counts as an attempt; no internal details.
    when others then
      return jsonb_build_object('error', 'invalid_request');
  end;
end;
$$;
revoke all on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) from public;
grant execute on function public.create_booking(text, jsonb, timestamptz, jsonb, text, text) to anon, authenticated;


-- ===== 20261023090000_performance.sql =====
-- Speed (23 Oct 2026).
-- 1. Access checks: every policy called is_business_member(business_id) once per row. Working
--    out the caller's salons once per query is ~40x faster (8.5 ms vs 339 ms for 1,500 of 30,000
--    appointments in testing). Same rules, evaluated once.
-- 2. Staff can read their own business's row (they couldn't, so the app found no business).
-- 3. Indexes for the lookups the app does all the time.

create or replace function public.my_business_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.businesses where owner_id = auth.uid()
  union
  select business_id from public.team_members
   where user_id = auth.uid() and invite_status = 'active';
$$;

create or replace function public.my_admin_business_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.businesses where owner_id = auth.uid()
  union
  select business_id from public.team_members
   where user_id = auth.uid() and invite_status = 'active' and access_level = 'admin';
$$;

revoke all on function public.my_business_ids() from public, anon;
revoke all on function public.my_admin_business_ids() from public, anon;
grant execute on function public.my_business_ids() to authenticated;
grant execute on function public.my_admin_business_ids() to authenticated;

-- Rewrite every policy that checks membership row by row into the set-based form.
do $$
declare
  p record;
  v_using text;
  v_check text;
  v_roles text;
begin
  for p in
    select tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'is_business_(member|admin)\(business_id\)'
           or coalesce(with_check, '') ~ 'is_business_(member|admin)\(business_id\)')
  loop
    v_using := regexp_replace(regexp_replace(p.qual,
      '(public\.)?is_business_member\(business_id\)', 'business_id IN (SELECT public.my_business_ids())', 'g'),
      '(public\.)?is_business_admin\(business_id\)', 'business_id IN (SELECT public.my_admin_business_ids())', 'g');
    v_check := regexp_replace(regexp_replace(p.with_check,
      '(public\.)?is_business_member\(business_id\)', 'business_id IN (SELECT public.my_business_ids())', 'g'),
      '(public\.)?is_business_admin\(business_id\)', 'business_id IN (SELECT public.my_admin_business_ids())', 'g');
    select string_agg(quote_ident(r), ', ') into v_roles from unnest(p.roles) r;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, p.permissive, p.cmd, v_roles,
      case when v_using is not null then ' using (' || v_using || ')' else '' end,
      case when v_check is not null then ' with check (' || v_check || ')' else '' end);
  end loop;
end $$;

-- Staff (active team members) can read the business they work for.
drop policy if exists "Members can view their business" on public.businesses;
create policy "Members can view their business" on public.businesses for select to authenticated
  using (id in (select public.my_business_ids()));

-- Indexes.
create index if not exists appointment_items_appointment_idx on public.appointment_items (appointment_id);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id) where product_id is not null;
create index if not exists sale_items_team_member_idx on public.sale_items (team_member_id) where team_member_id is not null;
create index if not exists sales_team_member_idx on public.sales (team_member_id) where team_member_id is not null;
create index if not exists team_members_user_idx on public.team_members (user_id) where user_id is not null;
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists gift_cards_client_idx on public.gift_cards (client_id) where client_id is not null;
create index if not exists gift_card_redemptions_card_idx on public.gift_card_redemptions (gift_card_id);
create index if not exists client_packages_client_idx on public.client_packages (client_id);
create index if not exists client_package_items_package_idx on public.client_package_items (client_package_id);
create index if not exists client_memberships_client_idx on public.client_memberships (client_id);
create index if not exists pay_run_lines_run_idx on public.pay_run_lines (pay_run_id);
create index if not exists waitlist_entries_client_idx on public.waitlist_entries (client_id);
create index if not exists blocked_times_member_idx on public.blocked_times (team_member_id);
create index if not exists deal_redemptions_sale_idx on public.deal_redemptions (sale_id) where sale_id is not null;

-- business_id on the tables that didn't have it indexed yet.
do $$
declare t text;
begin
  foreach t in array array['bundles', 'business_closed_periods', 'client_memberships', 'client_package_items',
                           'client_packages', 'client_tag_assignments', 'deal_redemptions', 'gift_card_redemptions',
                           'memberships', 'package_items', 'package_redemptions', 'packages', 'pay_run_lines',
                           'pay_runs', 'stock_movements', 'stock_order_items', 'stock_orders', 'stocktake_items',
                           'stocktakes', 'suppliers', 'team_roles', 'team_schedules', 'team_shift_overrides',
                           'team_time_off', 'timesheets'] loop
    if to_regclass('public.' || t) is not null then
      execute format('create index if not exists %I on public.%I (business_id)', t || '_business_idx', t);
    end if;
  end loop;
end $$;


-- ===== 20261024090000_branding_dashboard.sql =====
-- Branding and a customisable Home (24 Oct 2026).
-- 1. Each salon picks a brand colour (one of Bookly's presets) and can upload a logo. Both show
--    on the client-facing pages (booking, salon page, confirmation, manage booking, receipts)
--    and the colour also tints the salon's own dashboard.
-- 2. Each person can arrange their own Home dashboard (which cards, in what order, how wide).

-- ── Brand colour and logo ──
alter table public.businesses add column if not exists brand_color text not null default 'black';
alter table public.businesses drop constraint if exists businesses_brand_color_check;
alter table public.businesses add constraint businesses_brand_color_check check (
  brand_color in ('black', 'navy', 'blue', 'purple', 'plum', 'emerald', 'teal', 'terracotta', 'rose')
);
-- Path inside the public business-logos bucket, e.g. <business_id>/logo-<uuid>.png.
alter table public.businesses add column if not exists logo_path text;

-- Logos appear on public pages, so this bucket is public to read. Only PNG, JPEG and WebP up to
-- 2 MB (no SVG, which can carry scripts). Only the salon owner can add, change or remove files,
-- and only inside their own business folder (the same rule as the other photo buckets).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-logos', 'business-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners read their logos" on storage.objects;
create policy "Owners read their logos" on storage.objects for select to authenticated
  using (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
drop policy if exists "Owners upload their logos" on storage.objects;
create policy "Owners upload their logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
drop policy if exists "Owners update their logos" on storage.objects;
create policy "Owners update their logos" on storage.objects for update to authenticated
  using (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()))
  with check (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));
drop policy if exists "Owners delete their logos" on storage.objects;
create policy "Owners delete their logos" on storage.objects for delete to authenticated
  using (bucket_id = 'business-logos' and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()));

-- The public booking page and manage-booking link now include the colour and logo.
-- (Same functions as before, with brand_color and logo_path added to 'business'.)
create or replace function public.get_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'currency', b.currency,
      'country', b.country,
      'timezone', coalesce(b.timezone, 'Africa/Lagos'),
      'description', b.booking_description,
      'location', b.location,
      'brand_color', b.brand_color,
      'logo_path', b.logo_path
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', h.day_of_week, 'open', h.is_open, 'from', h.open_time, 'to', h.close_time)), '[]'::jsonb)
      from public.business_hours h where h.business_id = b.id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
        order by c.sort_order, c.created_at), '[]'::jsonb)
      from public.service_categories c where c.business_id = b.id and not c.is_archived
    ),
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'category_id', s.category_id,
          'pricing_type', s.pricing_type,
          'price', s.price,
          'duration', s.duration_minutes,
          'team', (select coalesce(jsonb_agg(stm.team_member_id), '[]'::jsonb)
                   from public.service_team_members stm where stm.service_id = s.id)
        ) order by s.sort_order, s.created_at), '[]'::jsonb)
      from public.services s
      left join public.service_categories c on c.id = s.category_id
      where s.business_id = b.id and not s.is_archived and s.online_booking_enabled
        and coalesce(c.is_archived, false) = false
    ),
    'team', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.id, 'first_name', t.first_name, 'last_name', t.last_name,
          'initials', t.initials, 'color', t.avatar_color, 'job_title', t.job_title
        ) order by t.created_at), '[]'::jsonb)
      from public.team_members t where t.business_id = b.id and t.is_active
    )
  )
  from public.businesses b
  where b.booking_slug = lower(p_slug) and b.online_booking_enabled;
$$;

create or replace function public.get_manage_booking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'notes', a.notes,
      'start', (select min(i.start_time) from public.appointment_items i where i.appointment_id = a.id),
      'end', (select max(i.end_time) from public.appointment_items i where i.appointment_id = a.id),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'service_id', i.service_id,
            'service', s.name,
            'duration', s.duration_minutes,
            'price', i.price,
            'team_member_id', i.team_member_id,
            'team_member', t.first_name,
            'start', i.start_time,
            'end', i.end_time
          ) order by i.sort_order), '[]'::jsonb)
        from public.appointment_items i
        left join public.services s on s.id = i.service_id
        left join public.team_members t on t.id = i.team_member_id
        where i.appointment_id = a.id
      ),
      'client_first_name', c.first_name
    ),
    'business', jsonb_build_object(
      'name', b.name,
      'slug', b.booking_slug,
      'currency', b.currency,
      'country', b.country,
      'timezone', coalesce(b.timezone, 'Africa/Lagos'),
      'location', b.location,
      'brand_color', b.brand_color,
      'logo_path', b.logo_path,
      'hours', (select coalesce(jsonb_agg(jsonb_build_object('day', h.day_of_week, 'open', h.is_open, 'from', h.open_time, 'to', h.close_time)), '[]'::jsonb)
                from public.business_hours h where h.business_id = b.id)
    ),
    'policy', jsonb_build_object(
      'notice_hours', b.booking_notice_hours,
      'allow_cancel', b.allow_client_cancel,
      'allow_reschedule', b.allow_client_reschedule,
      'text', b.booking_policy
    )
  )
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  left join public.clients c on c.id = a.client_id
  where a.manage_token = p_token;
$$;

-- ── Each person's Home layout ──
-- layout: [{"id": "sales", "hidden": false, "wide": false}, ...] in display order.
create table if not exists public.dashboard_layouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_layout_is_array check (jsonb_typeof(layout) = 'array')
);
alter table public.dashboard_layouts enable row level security;
revoke all on public.dashboard_layouts from anon;
grant select, insert, update, delete on public.dashboard_layouts to authenticated;

drop policy if exists "People read their own layout" on public.dashboard_layouts;
create policy "People read their own layout" on public.dashboard_layouts for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "People save their own layout" on public.dashboard_layouts;
create policy "People save their own layout" on public.dashboard_layouts for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "People change their own layout" on public.dashboard_layouts;
create policy "People change their own layout" on public.dashboard_layouts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "People reset their own layout" on public.dashboard_layouts;
create policy "People reset their own layout" on public.dashboard_layouts for delete to authenticated
  using (user_id = auth.uid());


-- ===== 20261025090000_business_contact.sql =====
-- A phone number and email clients can use to reach the salon, shown on the booking
-- confirmation and the manage-booking page.

alter table public.businesses
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

alter table public.businesses
  drop constraint if exists businesses_contact_phone_check,
  add constraint businesses_contact_phone_check
    check (contact_phone is null or char_length(contact_phone) between 5 and 30),
  drop constraint if exists businesses_contact_email_check,
  add constraint businesses_contact_email_check
    check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

-- Public: only what a salon would print on a business card.
create or replace function public.get_business_contact(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', name,
    'phone', contact_phone,
    'email', contact_email,
    'website', website,
    'location', location)
  from public.businesses
  where booking_slug = lower(p_slug);
$$;

revoke all on function public.get_business_contact(text) from public;
grant execute on function public.get_business_contact(text) to anon, authenticated;


-- ===== 20261026090000_email_log.sql =====
-- Emails sent through Brevo (booking confirmations, cancellations, reschedules, receipts).
-- One row per email event. dedupe_key is unique, so the same event can only be emailed once
-- (refreshing a confirmation page or replaying a request sends nothing). Receipts have no
-- dedupe_key and are rate limited by the server instead.
-- Only the server (service role) reads or writes this table.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  sale_id uuid references public.sales (id) on delete cascade,
  kind text not null check (kind in ('booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'receipt')),
  dedupe_key text unique,
  recipients text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists email_log_sale_recent on public.email_log (sale_id, created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

