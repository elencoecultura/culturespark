
REVOKE EXECUTE ON FUNCTION public.snapshot_gamification_cycle(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_gamification_cycle(timestamptz, timestamptz) TO service_role;
