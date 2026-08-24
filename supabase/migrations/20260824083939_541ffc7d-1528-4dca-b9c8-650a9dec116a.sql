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