-- Permite responder a mesma pesquisa de NPS de novo (a resposta nova
-- substitui a antiga via upsert). Antes só existia GRANT/policy de INSERT,
-- então um upsert que caísse em conflito (survey_id, user_id) falhava por
-- falta de permissão de UPDATE.

grant update on public.nps_responses to authenticated;

create policy nps_resp_update_own on public.nps_responses for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
