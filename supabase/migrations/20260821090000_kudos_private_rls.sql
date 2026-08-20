-- Elogio Rápido é privado: só quem mandou ou recebeu pode ler.
-- Antes a policy era "USING (true)" — qualquer pessoa logada lia o elogio
-- de qualquer outra dupla, mesmo sem aparecer no feed do app.
drop policy if exists "read kudos" on public.kudos;

create policy "read own kudos"
  on public.kudos for select
  to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
