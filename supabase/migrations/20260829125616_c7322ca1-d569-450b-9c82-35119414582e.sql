ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.team_roles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_invite_token_key
  ON public.team_members (invite_token)
  WHERE invite_token IS NOT NULL;