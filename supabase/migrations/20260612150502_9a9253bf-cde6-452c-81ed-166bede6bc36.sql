
REVOKE EXECUTE ON FUNCTION public.copy_previous_week(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.copy_previous_week(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.copy_previous_week(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.copy_previous_week(date) TO service_role;
