import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPREME_EMAILS } from "@/lib/wellbeing.functions";
import { PERIODS, resolveDateBuckets } from "@/lib/date-buckets";
import { fetchAllRows } from "@/lib/db-pagination";

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
// Período: um preset (dia/mês/ano, sempre até hoje) ou uma janela
// personalizada (from/to, "YYYY-MM-DD") — a janela personalizada tem
// prioridade quando os dois vêm preenchidos.
export const getWellbeingTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        period: z.enum(PERIODS).default("mes"),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        mode: z.enum(["individual", "department"]).default("department"),
        user_id: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bucketKeys, sinceIso, untilIso, keyFor } = resolveDateBuckets(data);

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
        .gte("created_at", sinceIso)
        .lt("created_at", untilIso);
      if (error) throw new Error(error.message);
      const entries = (moods ?? []).map((m) => ({ key: keyFor(m.created_at as string), mood: m.mood as number }));
      return { buckets: bucketKeys, series: [{ label: "Você", values: avgSeries(bucketKeys, entries) }] };
    }

    // department mode
    const checks = await Promise.all(
      (["admin", "gerente", "direcao", "lider"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
    const [isAdminRole, , , isLiderOnlyCheck] = checks.map((c: any) => c.data);
    const hasTodosScope = me?.attraction === "TODOS" || me?.negocio === "TODOS";
    const seesAll = isAdminRole || hasTodosScope;
    // líder comum (sem gerente/direção) só vê o próprio time — mesma regra
    // usada na Bússola/check-in do time: só quem lidera direto (manager_id/
    // co_leader_id), agrupado por pessoa em vez de setor/casa inteira.
    const isLiderOnly = isLiderOnlyCheck && !seesAll && !checks[1]?.data && !checks[2]?.data;

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, attraction, setor, manager_id, co_leader_id")
      .eq("active", true)
      .not("attraction", "is", null)
      .neq("attraction", "TODOS");
    const scoped = seesAll
      ? (profiles ?? [])
      : isLiderOnly
        ? (profiles ?? []).filter((p) => p.manager_id === context.userId || p.co_leader_id === context.userId)
        : (profiles ?? []).filter((p) => p.attraction === me?.attraction);
    if (isLiderOnly && scoped.length === 0) return { buckets: bucketKeys, series: [] };
    // grupo: casa a casa (visão geral), setor a setor (uma casa só) ou
    // pessoa a pessoa (líder comum, time pequeno e já é o escopo final)
    const groupKey = (p: { attraction: string | null; setor: string | null; full_name?: string | null }) =>
      seesAll ? (p.attraction as string) : isLiderOnly ? ((p.full_name as string | null) ?? "Sem nome") : ((p.setor as string | null) ?? "Sem setor");
    const groupById = new Map(scoped.map((p) => [p.id as string, groupKey(p as any)]));
    const ids = scoped.map((p) => p.id as string);
    if (ids.length === 0) return { buckets: bucketKeys, series: [] };

    // Paginado de verdade: o Supabase tem um teto de 1000 linhas por
    // requisição no servidor — .limit() no cliente só pede MENOS, nunca
    // mais. "Ano" com todo mundo passa fácil disso e a média saía
    // incompleta sem nenhum erro aparecer.
    const moods = await fetchAllRows<{ user_id: string; mood: number; created_at: string }>((from, to) =>
      context.supabase
        .from("mood_checkins")
        .select("user_id, mood, created_at")
        .in("user_id", ids)
        .gte("created_at", sinceIso)
        .lt("created_at", untilIso)
        .range(from, to),
    );

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
