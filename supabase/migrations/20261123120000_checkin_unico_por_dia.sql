-- Check-in obrigatório: 1 check-in por pessoa por dia (fuso de São Paulo),
-- garantido pelo banco e não só pelo servidor (dois toques seguidos no botão
-- passavam antes da checagem do primeiro terminar).
--
-- O histórico tem 4 dias com check-in duplicado. Em vez de apagar dado antigo,
-- o índice vale só para check-ins a partir de 24/11/2026.

create unique index if not exists mood_checkins_um_por_dia
  on public.mood_checkins (user_id, ((created_at at time zone 'America/Sao_Paulo')::date))
  where created_at >= timestamptz '2026-11-24 00:00:00-03';
