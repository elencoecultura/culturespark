
CREATE TABLE public.iluminari_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  mentioned_user_id uuid,
  message text,
  audio_path text,
  image_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iluminari_moments TO authenticated;
GRANT ALL ON public.iluminari_moments TO service_role;
ALTER TABLE public.iluminari_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read iluminari" ON public.iluminari_moments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own iluminari" ON public.iluminari_moments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "delete own or admin" ON public.iluminari_moments
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE INDEX iluminari_created_idx ON public.iluminari_moments(created_at DESC);

-- Storage policies for the 'iluminari' bucket (files live under <auth.uid()>/...)
CREATE POLICY "read iluminari files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'iluminari');

CREATE POLICY "upload own iluminari files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'iluminari' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "update own iluminari files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'iluminari' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "delete own iluminari files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'iluminari' AND (storage.foldername(name))[1] = auth.uid()::text);
