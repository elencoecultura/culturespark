
CREATE OR REPLACE FUNCTION public.current_season(_at timestamptz DEFAULT now())
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT EXTRACT(YEAR FROM _at)::int || '-Q' || (((EXTRACT(MONTH FROM _at)::int - 1) / 3) + 1)::text
$$;

REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_badges(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_award_checkin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_award_kudos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_award_journey() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_award_schedule() FROM PUBLIC, anon, authenticated;
