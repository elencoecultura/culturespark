-- 1. Prevent self-kudos (point farming)
ALTER TABLE public.kudos
  ADD CONSTRAINT kudos_no_self CHECK (from_user <> to_user);

-- 2. Restrict journey_progress to an allow-list of real step keys (prevent arbitrary step farming)
ALTER TABLE public.journey_progress
  ADD CONSTRAINT journey_progress_step_key_allowed
  CHECK (step_key IN (
    'opening',
    'climate',
    'peak',
    'closing'
  ));