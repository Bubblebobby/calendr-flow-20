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
