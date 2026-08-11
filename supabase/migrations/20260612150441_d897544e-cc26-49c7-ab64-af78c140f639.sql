
-- 1) Tabela de faltas com anexo
CREATE TABLE public.journey_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  absence_date date NOT NULL,
  reason text,
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, absence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_absences TO authenticated;
GRANT ALL ON public.journey_absences TO service_role;

ALTER TABLE public.journey_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own absences"
  ON public.journey_absences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leaders and admins read absences"
  ON public.journey_absences
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'leader') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER journey_absences_set_updated_at
  BEFORE UPDATE ON public.journey_absences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Função para copiar a última escala do próprio usuário para uma semana destino
CREATE OR REPLACE FUNCTION public.copy_previous_week(_target_week date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  src record;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.weekly_schedules
    WHERE user_id = uid AND week_start = _target_week
  ) THEN
    RAISE EXCEPTION 'week_already_exists';
  END IF;

  SELECT * INTO src FROM public.weekly_schedules
   WHERE user_id = uid AND week_start < _target_week
   ORDER BY week_start DESC LIMIT 1;

  IF src IS NULL THEN
    RAISE EXCEPTION 'no_previous_week';
  END IF;

  INSERT INTO public.weekly_schedules (
    user_id, week_start, attraction, days_off, weekly_hours, notes, created_by, completed_full
  )
  VALUES (
    uid, _target_week, src.attraction, src.days_off, src.weekly_hours, src.notes, uid, false
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

-- 3) Políticas do bucket privado journey-absences
CREATE POLICY "absences owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'journey-absences'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "absences owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journey-absences'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "absences owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'journey-absences'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "absences leaders read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'journey-absences'
    AND (public.has_role(auth.uid(), 'leader') OR public.has_role(auth.uid(), 'admin'))
  );
