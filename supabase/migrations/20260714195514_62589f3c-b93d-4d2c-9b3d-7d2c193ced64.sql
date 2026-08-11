
DROP POLICY IF EXISTS "eval_docs_bucket_write" ON storage.objects;
DROP POLICY IF EXISTS "eval_docs_bucket_delete" ON storage.objects;

CREATE POLICY "eval_docs_bucket_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evaluation-documents' AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE storage.objects.name LIKE e.id::text || '/%'
        AND (
          public.is_evaluator_of(e.id, auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = e.evaluatee_id
              AND (p.manager_id = auth.uid() OR p.co_leader_id = auth.uid()))
        )
    )
  )
);

CREATE POLICY "eval_docs_bucket_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'evaluation-documents' AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.evaluation_documents d
      WHERE d.storage_path = storage.objects.name
        AND d.uploaded_by = auth.uid()
    )
  )
);
