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