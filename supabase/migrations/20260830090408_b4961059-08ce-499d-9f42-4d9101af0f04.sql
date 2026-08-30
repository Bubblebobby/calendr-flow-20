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