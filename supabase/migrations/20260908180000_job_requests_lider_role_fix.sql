-- As políticas de job_requests (Vagas) checavam o papel "leader", que não
-- existe mais desde que virou "lider" — nenhuma checagem batia com conta
-- real nenhuma, então todo líder de verdade tomava "new row violates
-- row-level security policy" ao tentar enviar uma vaga pra aprovação.
-- Mesmo bug já corrigido em outros lugares do app (ver admin.functions.ts).

DROP POLICY IF EXISTS "jobs_select_owner_leader" ON public.job_requests;
CREATE POLICY "jobs_select_owner_leader" ON public.job_requests
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'lider'));

DROP POLICY IF EXISTS "jobs_insert_leader_or_admin" ON public.job_requests;
CREATE POLICY "jobs_insert_leader_or_admin" ON public.job_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'lider'))
  );

DROP POLICY IF EXISTS "jobs_update_leader_own_pending" ON public.job_requests;
CREATE POLICY "jobs_update_leader_own_pending" ON public.job_requests
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'lider')
    AND status IN ('pending','changes_requested')
  )
  WITH CHECK (
    created_by = auth.uid()
    AND status IN ('pending','changes_requested')
  );
