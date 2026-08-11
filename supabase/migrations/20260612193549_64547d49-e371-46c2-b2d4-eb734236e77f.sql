
CREATE TABLE IF NOT EXISTS public.gamification_cycle_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_start timestamptz NOT NULL,
  cycle_end timestamptz NOT NULL,
  user_id uuid NOT NULL,
  full_name text,
  negocio text,
  setor text,
  attraction text,
  role public.app_role,
  total_points integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_start, cycle_end, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_cycle_snapshots TO authenticated;
GRANT ALL ON public.gamification_cycle_snapshots TO service_role;

ALTER TABLE public.gamification_cycle_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read snapshots"
  ON public.gamification_cycle_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write snapshots"
  ON public.gamification_cycle_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_snapshots_cycle ON public.gamification_cycle_snapshots(cycle_start, cycle_end);
CREATE INDEX IF NOT EXISTS idx_snapshots_negocio ON public.gamification_cycle_snapshots(negocio);
CREATE INDEX IF NOT EXISTS idx_snapshots_role ON public.gamification_cycle_snapshots(role);

-- Function to snapshot a cycle window (admin-only via security check in caller)
CREATE OR REPLACE FUNCTION public.snapshot_gamification_cycle(_cycle_start timestamptz, _cycle_end timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH agg AS (
    SELECT
      pe.user_id,
      SUM(pe.points)::int AS total_points,
      jsonb_object_agg(pe.kind, pe.kind_points) AS breakdown
    FROM (
      SELECT user_id, kind, SUM(points)::int AS kind_points, SUM(points)::int AS points
      FROM public.point_events
      WHERE created_at >= _cycle_start AND created_at < _cycle_end
      GROUP BY user_id, kind
    ) pe
    GROUP BY pe.user_id
  ),
  rows AS (
    SELECT
      _cycle_start AS cycle_start,
      _cycle_end AS cycle_end,
      a.user_id,
      p.full_name,
      p.negocio,
      p.setor,
      p.attraction,
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = a.user_id ORDER BY ur.role LIMIT 1) AS role,
      a.total_points,
      a.breakdown
    FROM agg a
    LEFT JOIN public.profiles p ON p.id = a.user_id
  )
  INSERT INTO public.gamification_cycle_snapshots
    (cycle_start, cycle_end, user_id, full_name, negocio, setor, attraction, role, total_points, breakdown)
  SELECT cycle_start, cycle_end, user_id, full_name, negocio, setor, attraction, role, total_points, breakdown
  FROM rows
  ON CONFLICT (cycle_start, cycle_end, user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        negocio = EXCLUDED.negocio,
        setor = EXCLUDED.setor,
        attraction = EXCLUDED.attraction,
        role = EXCLUDED.role,
        total_points = EXCLUDED.total_points,
        breakdown = EXCLUDED.breakdown;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;
