-- Permite notificações pessoais (ex.: "você recebeu um toque"), além dos
-- recados gerais existentes. user_id NULL = recado pra todo mundo (comportamento
-- atual, sem mudança); user_id preenchido = notificação só pra essa pessoa.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id);

COMMENT ON COLUMN public.notifications.user_id IS 'NULL = recado geral (broadcast); preenchido = notificação pessoal (ex: toque recebido)';

DROP POLICY IF EXISTS "authenticated can read notifications" ON public.notifications;
CREATE POLICY "authenticated can read notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());
