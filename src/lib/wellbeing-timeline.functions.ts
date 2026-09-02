import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPREME_EMAILS } from "@/lib/wellbeing.functions";

const PERIODS = ["dia", "mes", "ano"] as const;
const tz = "America/Sao_Paulo";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

// Servidor roda em UTC (Vercel) — se o início do período fosse calculado com
// Date.getFullYear/getMonth/getDate (hora local do processo, ou seja, UTC) e
// as chaves formatadas em America/Sao_Paulo (3h atrás de UTC), o balde de
// "hoje" nunca batia com o dia real em São Paulo e a maior parte do check-in
// do dia sumia do gráfico. Por isso tudo aqui é calculado em cima de chaves
// "YYYY-MM-DD" já no fuso de SP, nunca misturando com Date local do processo.
function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function periodStartKey(period: (typeof PERIODS)[number], todayKey: string): string {
  const [y, m] = todayKey.split("-");
  if (period === "dia") return todayKey;
  if (period === "mes") return `${y}-${m}-01`;
  return `${y}-01-01`;
}

function buildBuckets(period: (typeof PERIODS)[number]) {
  const todayKey = fmt.format(new Date());
  const startKey = periodStartKey(period, todayKey);
  const dayKeys: string[] = [];
  for (let k = startKey; k <= todayKey; k = addDaysToKey(k, 1)) dayKeys.push(k);
  const bucketKeys = period === "ano" ? Array.from(new Set(dayKeys.map((k) => k.slice(0, 7)))) : dayKeys;
  const keyFor = (iso: string) => {
    const day = fmt.format(new Date(iso));
    return period === "ano" ? day.slice(0, 7) : day;
  };
  return { sinceIso: `${startKey}T00:00:00-03:00`, bucketKeys, keyFor };
}

function avgSeries(bucketKeys: string[], entries: Array<{ key: string; mood: number }>) {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const e of entries) {
    sums.set(e.key, (sums.get(e.key) ?? 0) + e.mood);
    counts.set(e.key, (counts.get(e.key) ?? 0) + 1);
  }
  return bucketKeys.map((k) => {
    const c = counts.get(k) ?? 0;
    return c ? Math.round((sums.get(k)! / c) * 10) / 10 : null;
  });
}

// Timeline de bem-estar (humor médio ao longo do tempo). Dois modos:
// - individual: histórico de uma pessoa. Ver a própria é sempre permitido;
//   ver a de outra pessoa exige ser admin supremo (mesmo dado sensível do
//   painel "Cuidado com o elenco" — não é qualquer admin/líder que vê).
// - department: comparação por área. Quem enxerga tudo (admin/TODOS) compara
//   casa a casa; gerente/direção (escopo de uma casa só) compara setor a
//   setor dentro da própria casa.
export const getWellbeingTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        period: z.enum(PERIODS).default("mes"),
        mode: z.enum(["individual", "department"]).default("department"),
        user_id: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bucketKeys, sinceIso, keyFor } = buildBuckets(data.period);

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("email, attraction, negocio")
      .eq("id", context.userId)
      .maybeSingle();

    if (data.mode === "individual") {
      const targetId = data.user_id ?? context.userId;
      if (targetId !== context.userId) {
        const email = me?.email?.toLowerCase();
        if (!email || !SUPREME_EMAILS.includes(email)) throw new Error("Forbidden");
      }
      const { data: moods, error } = await context.supabase
        .from("mood_checkins")
        .select("mood, created_at")
        .eq("user_id", targetId)
        .gte("created_at", sinceIso);
      if (error) throw new Error(error.message);
      const entries = (moods ?? []).map((m) => ({ key: keyFor(m.created_at as string), mood: m.mood as number }));
      return { buckets: bucketKeys, series: [{ label: "Você", values: avgSeries(bucketKeys, entries) }] };
    }

    // department mode
    const checks = await Promise.all(
      (["admin", "gerente", "direcao"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
    const [isAdminRole] = checks.map((c: any) => c.data);
    const hasTodosScope = me?.attraction === "TODOS" || me?.negocio === "TODOS";
    const seesAll = isAdminRole || hasTodosScope;

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, attraction, setor")
      .eq("active", true)
      .not("attraction", "is", null)
      .neq("attraction", "TODOS");
    const scoped = seesAll ? (profiles ?? []) : (profiles ?? []).filter((p) => p.attraction === me?.attraction);
    // grupo: casa a casa (visão geral) ou setor a setor (visão de uma casa só)
    const groupKey = (p: { attraction: string | null; setor: string | null }) =>
      seesAll ? (p.attraction as string) : ((p.setor as string | null) ?? "Sem setor");
    const groupById = new Map(scoped.map((p) => [p.id as string, groupKey(p as any)]));
    const ids = scoped.map((p) => p.id as string);
    if (ids.length === 0) return { buckets: bucketKeys, series: [] };

    const { data: moods, error } = await context.supabase
      .from("mood_checkins")
      .select("user_id, mood, created_at")
      .in("user_id", ids)
      .gte("created_at", sinceIso);
    if (error) throw new Error(error.message);

    const byGroup = new Map<string, Array<{ key: string; mood: number }>>();
    for (const m of moods ?? []) {
      const group = groupById.get(m.user_id as string);
      if (!group) continue;
      const list = byGroup.get(group) ?? [];
      list.push({ key: keyFor(m.created_at as string), mood: m.mood as number });
      byGroup.set(group, list);
    }

    const series = Array.from(new Set(scoped.map((p) => groupKey(p as any))))
      .sort()
      .map((label) => ({ label, values: avgSeries(bucketKeys, byGroup.get(label) ?? []) }));

    return { buckets: bucketKeys, series };
  });
