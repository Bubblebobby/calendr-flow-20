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