
DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('pending','changes_requested','approved','rejected','in_recruitment','finished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  attraction text NOT NULL,
  department text NOT NULL,
  level text NOT NULL,
  type text NOT NULL,
  contract text NOT NULL,
  workload text NOT NULL,
  model text NOT NULL,
  urgency text NOT NULL,
  start_date date,
  budget text,
  manager_name text NOT NULL,
  reason text NOT NULL,
  activities text NOT NULL,
  requirements text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_requests TO authenticated;
GRANT ALL ON public.job_requests TO service_role;

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: admin all; leader only own
CREATE POLICY "jobs_select_admin" ON public.job_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "jobs_select_owner_leader" ON public.job_requests
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'leader'));

-- INSERT: leader or admin, must be self
CREATE POLICY "jobs_insert_leader_or_admin" ON public.job_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leader'))
  );

-- UPDATE: admin everything; leader only own while pending/changes_requested
CREATE POLICY "jobs_update_admin" ON public.job_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "jobs_update_leader_own_pending" ON public.job_requests
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'leader')
    AND status IN ('pending','changes_requested')
  )
  WITH CHECK (
    created_by = auth.uid()
    AND status IN ('pending','changes_requested')
  );

-- DELETE: admin only
CREATE POLICY "jobs_delete_admin" ON public.job_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger (reuse existing set_updated_at)
CREATE TRIGGER trg_job_requests_updated
  BEFORE UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_job_requests_status ON public.job_requests(status);
CREATE INDEX idx_job_requests_created_by ON public.job_requests(created_by);
