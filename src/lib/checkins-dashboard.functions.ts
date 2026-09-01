import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin.");
}

function moodBucket(mood: number): "baixo" | "medio" | "alto" {
  if (mood <= 2) return "baixo";
  if (mood === 3) return "medio";
  return "alto";
}

function emptyDist() {
  return { baixo: 0, medio: 0, alto: 0, total: 0 };
}

function distToPct(d: { baixo: number; medio: number; alto: number; total: number }) {
  if (!d.total) return { baixoPct: 0, medioPct: 0, altoPct: 0, total: 0 };
  return {
    baixoPct: Math.round((d.baixo / d.total) * 100),
    medioPct: Math.round((d.medio / d.total) * 100),
    altoPct: Math.round((d.alto / d.total) * 100),
    total: d.total,
  };
}

// dia = só hoje; mês = mês corrente (dia 1 até hoje); ano = ano corrente
// (1º de janeiro até hoje). O período escolhido vale pra TODOS os
// indicadores do painel (antes só mexia na janela do check-in — humor,
// elogios e alertas ficavam presos em 30 dias fixos, incoerente com o
// filtro escolhido).
const PERIODS = ["dia", "mes", "ano"] as const;
type Period = (typeof PERIODS)[number];

function periodStart(period: Period, now: Date): Date {
  if (period === "dia") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

// Painel principal de casas: pra cada atração, junta check-in (hoje e no
// período escolhido), humor médio + distribuição de energia, elogios
// enviados/recebidos, alertas de energia baixa, e a divisão por setor
// (Cozinha/Salão/etc dentro da mesma casa) — tudo num lugar só.
export const getCheckinsByHouse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ period: z.enum(PERIODS).default("mes") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tz = "America/Sao_Paulo";
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

    const now = new Date();
    const start = periodStart(data.period, now);
    // Matriz interna sempre por dia (pra média/percentuais ficarem exatos);
    // "ano" só agrupa em mês na hora de montar a série do gráfico.
    const dayKeys: string[] = [];
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      dayKeys.push(fmt.format(d));
    }
    const todayKey = fmt.format(now);
    const sinceIso = start.toISOString();
    const chartKeys = data.period === "ano" ? Array.from(new Set(dayKeys.map((k) => k.slice(0, 7)))) : dayKeys;

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, attraction, setor")
      .eq("active", true)
      .not("attraction", "is", null)
      .neq("attraction", "TODOS");
    const attractionById = new Map((profiles ?? []).map((p) => [p.id, p.attraction as string]));
    const setorById = new Map((profiles ?? []).map((p) => [p.id, (p.setor as string | null) ?? "Sem setor"]));

    const headcount: Record<string, number> = {};
    const setorHeadcount: Record<string, Record<string, number>> = {};
    (profiles ?? []).forEach((p) => {
      const a = p.attraction as string;
      const s = (p.setor as string | null) ?? "Sem setor";
      headcount[a] = (headcount[a] ?? 0) + 1;
      setorHeadcount[a] ??= {};
      setorHeadcount[a][s] = (setorHeadcount[a][s] ?? 0) + 1;
    });
    const houses = Object.keys(headcount).sort();

    const [{ data: checkins, error: cErr }, { data: moodsInPeriod, error: mErr }, { data: kudosInPeriod, error: kErr }, { data: lowEnergyInPeriod }] =
      await Promise.all([
        supabaseAdmin.from("mood_checkins").select("user_id, mood, created_at").gte("created_at", sinceIso),
        supabaseAdmin.from("mood_checkins").select("user_id, mood").gte("created_at", sinceIso),
        supabaseAdmin.from("kudos").select("from_user, to_user").gte("created_at", sinceIso),
        supabaseAdmin.from("low_energy_alerts").select("user_id").gte("triggered_at", sinceIso),
      ]);
    if (cErr) throw new Error(cErr.message);
    if (mErr) throw new Error(mErr.message);
    if (kErr) throw new Error(kErr.message);

    // matriz casa x dia = quem fez check-in (deduplicado por pessoa/dia) +
    // matriz casa x setor x dia (pro detalhe por setor)
    const matrix: Record<string, Record<string, Set<string>>> = {};
    const setorMatrix: Record<string, Record<string, Record<string, Set<string>>>> = {};
    houses.forEach((h) => {
      matrix[h] = {};
      setorMatrix[h] = {};
      Object.keys(setorHeadcount[h] ?? {}).forEach((s) => {
        setorMatrix[h][s] = {};
        dayKeys.forEach((day) => (setorMatrix[h][s][day] = new Set()));
      });
      dayKeys.forEach((day) => (matrix[h][day] = new Set()));
    });
    (checkins ?? []).forEach((c) => {
      const uid = c.user_id as string;
      const house = attractionById.get(uid);
      if (!house || !matrix[house]) return;
      const day = fmt.format(new Date(c.created_at as string));
      if (matrix[house][day]) matrix[house][day].add(uid);
      const setor = setorById.get(uid) ?? "Sem setor";
      if (setorMatrix[house][setor]?.[day]) setorMatrix[house][setor][day].add(uid);
    });

    // humor médio + distribuição no período por casa, e distribuição geral
    const moodSum: Record<string, number> = {};
    const moodCount: Record<string, number> = {};
    const moodDist: Record<string, ReturnType<typeof emptyDist>> = {};
    const moodDistOverall = emptyDist();
    (moodsInPeriod ?? []).forEach((m) => {
      const house = attractionById.get(m.user_id as string);
      const mood = m.mood as number;
      const bucket = moodBucket(mood);
      moodDistOverall[bucket]++;
      moodDistOverall.total++;
      if (!house) return;
      moodSum[house] = (moodSum[house] ?? 0) + mood;
      moodCount[house] = (moodCount[house] ?? 0) + 1;
      moodDist[house] ??= emptyDist();
      moodDist[house][bucket]++;
      moodDist[house].total++;
    });

    // elogios enviados/recebidos no período por casa
    const kudosSent: Record<string, number> = {};
    const kudosReceived: Record<string, number> = {};
    (kudosInPeriod ?? []).forEach((k) => {
      const fromHouse = attractionById.get(k.from_user as string);
      const toHouse = attractionById.get(k.to_user as string);
      if (fromHouse) kudosSent[fromHouse] = (kudosSent[fromHouse] ?? 0) + 1;
      if (toHouse) kudosReceived[toHouse] = (kudosReceived[toHouse] ?? 0) + 1;
    });

    // alertas de energia baixa no período por casa
    const alerts: Record<string, number> = {};
    (lowEnergyInPeriod ?? []).forEach((a) => {
      const house = attractionById.get(a.user_id as string);
      if (house) alerts[house] = (alerts[house] ?? 0) + 1;
    });

    const rows = houses.map((house) => {
      const dailyCounts = dayKeys.map((day) => matrix[house][day].size);
      // Série do gráfico: por dia (dia/mês) ou somada por mês (ano) — mas a
      // média/percentual sempre usa a granularidade diária real, senão o
      // "ano" ficaria com base 12 (meses) em vez de ~365 (dias).
      const byDay =
        data.period === "ano"
          ? chartKeys.map((month) => dayKeys.reduce((s, day, i) => (day.startsWith(month) ? s + dailyCounts[i] : s), 0))
          : dailyCounts;
      const todayCount = matrix[house][todayKey]?.size ?? 0;
      const windowDays = dayKeys.length;
      const avgRate = headcount[house]
        ? Math.round((dailyCounts.reduce((s, n) => s + n, 0) / (headcount[house] * windowDays)) * 100)
        : 0;

      const bySetor = Object.keys(setorHeadcount[house] ?? {})
        .sort()
        .map((setor) => {
          const sHeadcount = setorHeadcount[house][setor];
          const sTodayCount = setorMatrix[house][setor]?.[todayKey]?.size ?? 0;
          return {
            setor,
            headcount: sHeadcount,
            todayCount: sTodayCount,
            todayPct: sHeadcount ? Math.round((sTodayCount / sHeadcount) * 100) : 0,
          };
        });

      return {
        house,
        headcount: headcount[house],
        byDay,
        todayCount,
        todayPct: headcount[house] ? Math.round((todayCount / headcount[house]) * 100) : 0,
        avgPct: avgRate,
        avgMood: moodCount[house] ? +(moodSum[house] / moodCount[house]).toFixed(1) : null,
        moodDist: distToPct(moodDist[house] ?? emptyDist()),
        kudosSent: kudosSent[house] ?? 0,
        kudosReceived: kudosReceived[house] ?? 0,
        lowEnergyAlerts: alerts[house] ?? 0,
        bySetor,
      };
    });

    return { days: chartKeys, period: data.period, rows, moodDistOverall: distToPct(moodDistOverall) };
  });
