
REVOKE ALL ON FUNCTION public.generate_hero_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_hero_id() TO service_role;
