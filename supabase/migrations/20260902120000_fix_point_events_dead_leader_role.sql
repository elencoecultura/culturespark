-- A policy de point_events checava has_role(auth.uid(),'leader') — papel
-- "leader" nunca existiu em nenhuma conta real (virou "lider"). Na prática
-- a policy só liberava ver os PRÓPRIOS eventos (fora admin), o que quebrou
-- o ranking/gamificação pra qualquer líder/gerente que dependesse de RLS
-- pra ver pontos de outras pessoas. O app já busca esses dados com o client
-- de service role nas rotas que precisam, mas a policy também fica correta
-- aqui pra qualquer leitura direta futura.

drop policy if exists "read own or leader/admin point events" on public.point_events;

create policy "read own or leadership/admin point events"
  on public.point_events for select to authenticated
  using (
    user_id = auth.uid()
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'lider')
    or has_role(auth.uid(), 'gerente')
    or has_role(auth.uid(), 'direcao')
  );
