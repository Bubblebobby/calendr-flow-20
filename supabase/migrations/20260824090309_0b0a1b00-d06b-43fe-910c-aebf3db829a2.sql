CREATE POLICY "Owners can read bundle portfolio objects" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can upload bundle portfolio objects" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can update bundle portfolio objects" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()))
WITH CHECK (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));

CREATE POLICY "Owners can delete bundle portfolio objects" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bundle-portfolio-images' AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()));
