import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// Painel geral: reúne, num único lugar, um resumo de cada indicador de
// cultura que hoje vive espalhado em telas separadas (avaliações, NPS,
// bem-estar, elogios, bússola, vagas) — pra dar uma visão executiva rápida.
export const getCultureOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");

    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cycle } = await context.supabase
      .from("evaluation_cycles")
      .select("id,name,status")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    let evalCompletion: { total: number; done: number; pct: number } | null = null;
    let spiritsAvg: number | null = null;
    if (cycle) {
      const { data: evals } = await context.supabase
        .from("evaluations")
        .select("status,spirit_amar,spirit_honrar,spirit_verdadeiro,spirit_justo,spirit_servir")
        .eq("cycle_id", cycle.id);
      const rows = evals ?? [];
      const total = rows.length;
      const done = rows.filter((e: any) => e.status === "concluida").length;
      evalCompletion = { total, done, pct: total ? Math.round((done / total) * 100) : 0 };

      const LEVEL: Record<string, number> = { abaixo: 1, no_esperado: 2, acima: 3 };
      const keys = ["spirit_amar", "spirit_honrar", "spirit_verdadeiro", "spirit_justo", "spirit_servir"];
      const vals = rows
        .flatMap((e: any) => keys.map((k) => LEVEL[e[k] as string]))
        .filter((v: number | undefined): v is number => typeof v === "number");
      spiritsAvg = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
    }

    const { data: latestSurvey } = await context.supabase
      .from("nps_surveys")
      .select("id,title,opens_at")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nps: { total: number; value: number | null; title: string } | null = null;
    if (latestSurvey) {
      const { data: resp } = await context.supabase
        .from("nps_responses")
        .select("score")
        .eq("survey_id", latestSurvey.id);
      const scores = (resp ?? []).map((r: any) => r.score as number);
      const total = scores.length;
      const promoters = scores.filter((s) => s >= 9).length;
      const detractors = scores.filter((s) => s <= 6).length;
      nps = {
        total,
        value: total ? Math.round(((promoters - detractors) / total) * 100) : null,
        title: latestSurvey.title,
      };
    }

    const { count: lowEnergyCount } = await context.supabase
      .from("low_energy_alerts")
      .select("id", { count: "exact", head: true })
      .gte("triggered_at", since30);

    const { count: kudosCount } = await context.supabase
      .from("kudos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30);

    const { count: discCount } = await supabaseAdmin
      .from("behavioral_tests")
      .select("user_id", { count: "exact", head: true });

    const { count: openJobs } = await context.supabase
      .from("job_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "changes_requested", "approved", "in_recruitment"]);

    return {
      cycle,
      evalCompletion,
      spiritsAvg,
      nps,
      lowEnergyCount: lowEnergyCount ?? 0,
      kudosCount: kudosCount ?? 0,
      discCount: discCount ?? 0,
      openJobs: openJobs ?? 0,
    };
  });
