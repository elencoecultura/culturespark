
-- Gamification: point events, badges, triggers

-- Helpers
CREATE OR REPLACE FUNCTION public.current_season(_at timestamptz DEFAULT now())
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(YEAR FROM _at)::int || '-Q' || (((EXTRACT(MONTH FROM _at)::int - 1) / 3) + 1)::text
$$;

-- 1. point_events
CREATE TABLE public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('checkin','kudos_sent','kudos_received','schedule_completed','journey_step')),
  points integer NOT NULL,
  season text NOT NULL,
  ref_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref_id)
);
GRANT SELECT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or leader/admin point events"
  ON public.point_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'leader') OR has_role(auth.uid(),'admin'));

CREATE INDEX point_events_user_season_idx ON public.point_events(user_id, season);

-- 2. badges_awarded
CREATE TABLE public.badges_awarded (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);
GRANT SELECT ON public.badges_awarded TO authenticated;
GRANT ALL ON public.badges_awarded TO service_role;
ALTER TABLE public.badges_awarded ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all badges"
  ON public.badges_awarded FOR SELECT TO authenticated USING (true);

-- 3. weekly_schedules.completed_full
ALTER TABLE public.weekly_schedules
  ADD COLUMN IF NOT EXISTS completed_full boolean NOT NULL DEFAULT false;

-- 4. award_points
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _kind text, _points int, _ref_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.point_events(user_id, kind, points, season, ref_id)
  VALUES (_user_id, _kind, _points, current_season(), _ref_id)
  ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
  PERFORM public.recompute_badges(_user_id);
END $$;

-- 5. recompute_badges
CREATE OR REPLACE FUNCTION public.recompute_badges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_xp int;
  streak int;
  weeks_full int;
BEGIN
  -- Total XP
  SELECT COALESCE(SUM(points),0) INTO total_xp FROM public.point_events WHERE user_id = _user_id;

  IF total_xp >= 100 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'veteran_100') ON CONFLICT DO NOTHING; END IF;
  IF total_xp >= 500 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'veteran_500') ON CONFLICT DO NOTHING; END IF;
  IF total_xp >= 1000 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'veteran_1000') ON CONFLICT DO NOTHING; END IF;

  -- Check-in streak (consecutive days up to today)
  WITH days AS (
    SELECT DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.mood_checkins WHERE user_id = _user_id
  ),
  ranked AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM days
  ),
  groups AS (
    SELECT grp, COUNT(*)::int AS len, MAX(d) AS last_d FROM ranked GROUP BY grp
  )
  SELECT COALESCE(MAX(len),0) INTO streak
  FROM groups
  WHERE last_d >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '1 day';

  IF streak >= 7 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'streak_7') ON CONFLICT DO NOTHING; END IF;
  IF streak >= 30 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'streak_30') ON CONFLICT DO NOTHING; END IF;
  IF streak >= 100 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'streak_100') ON CONFLICT DO NOTHING; END IF;

  -- Weeks with full schedule completed
  SELECT COUNT(*)::int INTO weeks_full FROM public.weekly_schedules
    WHERE user_id = _user_id AND completed_full = true;

  IF weeks_full >= 1 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'always_present_1') ON CONFLICT DO NOTHING; END IF;
  IF weeks_full >= 4 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'always_present_4') ON CONFLICT DO NOTHING; END IF;
  IF weeks_full >= 12 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'always_present_12') ON CONFLICT DO NOTHING; END IF;
END $$;

-- 6. Triggers on existing tables

-- mood_checkins → 5 pts per day
CREATE OR REPLACE FUNCTION public.trg_award_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE day_key text;
BEGIN
  day_key := 'day:' || ((NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::date)::text;
  PERFORM public.award_points(NEW.user_id, 'checkin', 5, day_key);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS award_checkin_points ON public.mood_checkins;
CREATE TRIGGER award_checkin_points AFTER INSERT ON public.mood_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_checkin();

-- kudos → 3 sender / 5 receiver
CREATE OR REPLACE FUNCTION public.trg_award_kudos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.from_user, 'kudos_sent', 3, NEW.id::text);
  PERFORM public.award_points(NEW.to_user, 'kudos_received', 5, NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS award_kudos_points ON public.kudos;
CREATE TRIGGER award_kudos_points AFTER INSERT ON public.kudos
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_kudos();

-- journey_progress → 10 pts per step
CREATE OR REPLACE FUNCTION public.trg_award_journey()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 'journey_step', 10, NEW.step_key);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS award_journey_points ON public.journey_progress;
CREATE TRIGGER award_journey_points AFTER INSERT ON public.journey_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_journey();

-- weekly_schedules completed → 20 pts
CREATE OR REPLACE FUNCTION public.trg_award_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed_full = true AND (OLD.completed_full IS DISTINCT FROM true) THEN
    PERFORM public.award_points(NEW.user_id, 'schedule_completed', 20, NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS award_schedule_points ON public.weekly_schedules;
CREATE TRIGGER award_schedule_points AFTER UPDATE ON public.weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_schedule();
