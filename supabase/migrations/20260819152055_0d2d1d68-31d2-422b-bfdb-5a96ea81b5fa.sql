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