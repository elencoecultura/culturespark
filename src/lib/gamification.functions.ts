import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const POINT_RULES = [
  { kind: "checkin", label: "Check-in de humor", points: 5, hint: "1x por dia" },
  { kind: "kudos_sent", label: "Elogio enviado", points: 3, hint: "" },
  { kind: "kudos_received", label: "Elogio recebido", points: 5, hint: "" },
  { kind: "journey_step", label: "Passo da jornada", points: 10, hint: "" },
  { kind: "schedule_completed", label: "Semana cumprida", points: 20, hint: "marcada pelo líder" },
] as const;

export const BADGES = [
  { key: "streak_7", label: "Semana firme", desc: "6 check-ins na semana (escala 6x1)", group: "streak", goal: 6 },
  { key: "streak_30", label: "Mês inteiro", desc: "30 check-ins seguidos", group: "streak", goal: 30 },
  { key: "streak_100", label: "Lenda diária", desc: "100 check-ins seguidos", group: "streak", goal: 100 },
  { key: "always_present_1", label: "Presença ouro", desc: "1 semana 100% cumprida", group: "present", goal: 1 },
  { key: "always_present_4", label: "Mês perfeito", desc: "4 semanas cumpridas", group: "present", goal: 4 },
  { key: "always_present_12", label: "Trimestre ninja", desc: "12 semanas cumpridas", group: "present", goal: 12 },
  { key: "veteran_100", label: "Veterano I", desc: "100 XP acumulados", group: "veteran", goal: 100 },
  { key: "veteran_500", label: "Veterano II", desc: "500 XP acumulados", group: "veteran", goal: 500 },
  { key: "veteran_1000", label: "Lenda Hector", desc: "1000 XP acumulados", group: "veteran", goal: 1000 },
] as const;

function currentSeason(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function seasonEnd(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 1);
}

type CycleWindow = { start: string | null; end: string | null; cycleDays: number };

async function getCycleWindow(
  supabase: { rpc: typeof globalThis.fetch extends never ? never : unknown } & {
    rpc(name: "current_cycle_start"): Promise<{ data: string | null }>;
    from(t: "app_settings"): unknown;
  },
): Promise<CycleWindow> {
  // Fetch the configured cycle length and the current window's start.
  const startTsRes = await supabase.rpc("current_cycle_start");
  const settingRes = await (supabase.from("app_settings") as unknown as {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: { value: { cycle_days?: number } | null } | null }>;
      };
    };
  })
    .select("value")
    .eq("key", "gamification_cycle")
    .maybeSingle();
  const cycleDays = settingRes.data?.value?.cycle_days ?? 60;
  const start = (startTsRes.data as string | null) ?? null;
  let end: string | null = null;
  if (start) {
    const d = new Date(start);
    d.setDate(d.getDate() + cycleDays);
    end = d.toISOString();
  }
  return { start, end, cycleDays };
}

export const getMyGamification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cycle = await getCycleWindow(
      context.supabase as unknown as Parameters<typeof getCycleWindow>[0],
    );

    let seasonQuery = context.supabase
      .from("point_events")
      .select("points,kind,created_at")
      .eq("user_id", context.userId);
    if (cycle.start) seasonQuery = seasonQuery.gte("created_at", cycle.start);
    if (cycle.end) seasonQuery = seasonQuery.lt("created_at", cycle.end);

    const [allPoints, seasonPoints, myBadges, myProfile] = await Promise.all([
      context.supabase.from("point_events").select("points").eq("user_id", context.userId),
      seasonQuery,
      context.supabase.from("badges_awarded").select("badge_key, awarded_at").eq("user_id", context.userId),
      context.supabase
        .from("profiles")
        .select("attraction, full_name")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const totalXp = (allPoints.data ?? []).reduce((s, r) => s + (r.points as number), 0);
    const seasonXp = (seasonPoints.data ?? []).reduce((s, r) => s + (r.points as number), 0);

    // Check-in streak (dias com check-in, America/Sao_Paulo). Escala é 6x1
    // (1 folga por semana) — um único dia isolado sem check-in é tratado
    // como folga e não quebra a sequência (só não soma naquele dia). Dois
    // dias seguidos sem check-in aí sim quebra, porque não é compatível
    // com folga de 1 dia só.
    const { data: moods } = await context.supabase
      .from("mood_checkins")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);

    const tz = "America/Sao_Paulo";
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const days = new Set((moods ?? []).map((m) => fmt.format(new Date(m.created_at as string))));
    let streak = 0;
    let consecutiveMisses = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = fmt.format(d);
      if (days.has(key)) {
        streak++;
        consecutiveMisses = 0;
      } else if (i === 0) {
        // allow streak to count from yesterday if no check-in today yet
        continue;
      } else {
        consecutiveMisses++;
        if (consecutiveMisses > 1) break;
        // 1 dia isolado sem check-in = folga da escala 6x1, não quebra a sequência
      }
    }

    const { data: weeksFullRows } = await context.supabase
      .from("weekly_schedules")
      .select("id")
      .eq("user_id", context.userId)
      .eq("completed_full", true);
    const weeksFull = weeksFullRows?.length ?? 0;

    return {
      season: cycle.start ? `Ciclo desde ${cycle.start.slice(0, 10)}` : currentSeason(),
      seasonEnd: cycle.end ?? seasonEnd().toISOString(),
      cycleDays: cycle.cycleDays,
      totalXp,
      seasonXp,
      streak,
      weeksFull,
      attraction: myProfile.data?.attraction ?? null,
      fullName: myProfile.data?.full_name ?? "",
      badges: (myBadges.data ?? []).map((b) => b.badge_key as string),
    };
  });

export const getAttractionLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attraction: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const cycle = await getCycleWindow(
      context.supabase as unknown as Parameters<typeof getCycleWindow>[0],
    );
    const season = cycle.start ? `Ciclo desde ${cycle.start.slice(0, 10)}` : currentSeason();
    const { data: me } = await context.supabase
      .from("profiles")
      .select("attraction, negocio")
      .eq("id", context.userId)
      .maybeSingle();
    // Só quem enxerga tudo (TODOS) ou admin pode pedir a atração de outra
    // pessoa — todo mundo mais sempre vê a própria, mesmo que peça outra.
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const hasTodosScope = me?.attraction === "TODOS" || me?.negocio === "TODOS";
    const attraction = (isAdmin || hasTodosScope ? data.attraction : null) ?? me?.attraction ?? null;
    if (!attraction) return { attraction: null, season, rows: [] };

    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, attraction")
      .eq("attraction", attraction)
      .eq("active", true);
    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return { attraction, season, rows: [] };

    let evQuery = context.supabase
      .from("point_events")
      .select("user_id, points")
      .in("user_id", ids);
    if (cycle.start) evQuery = evQuery.gte("created_at", cycle.start);
    if (cycle.end) evQuery = evQuery.lt("created_at", cycle.end);
    const { data: events } = await evQuery;

    const sums = new Map<string, number>();
    (events ?? []).forEach((e) => {
      sums.set(e.user_id as string, (sums.get(e.user_id as string) ?? 0) + (e.points as number));
    });
    const rows = (profiles ?? [])
      .map((p) => ({ user_id: p.id, name: p.full_name, points: sums.get(p.id) ?? 0 }))
      .sort((a, b) => b.points - a.points);
    return { attraction, season, rows };
  });

export const markScheduleCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // "leader" não existe mais como papel (virou "lider"/"gerente"/"direcao").
    const checks = await Promise.all(
      (["admin", "lider", "leader", "gerente", "direcao"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("weekly_schedules")
      .update({ completed_full: data.completed })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
