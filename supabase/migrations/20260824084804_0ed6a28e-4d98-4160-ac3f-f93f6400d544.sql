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