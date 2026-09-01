import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// Mesmo escopo usado no resto do app (listUsers/listTodayCheckins): líder
// comum só vê quem reporta direto pra ele, gerente/direção vê a atração
// inteira, admin (ou attraction/negocio="TODOS") vê tudo. Retorna `null`
// quando o escopo é "vê tudo" — quem chama trata isso como "sem filtro".
const LEADERSHIP_ROLES = ["admin", "lider", "leader", "gerente", "direcao"] as const;
async function scopedRespondentIds(supabase: any, userId: string): Promise<string[] | null> {
  const checks = await Promise.all(
    LEADERSHIP_ROLES.map((role) => supabase.rpc("has_role", { _user_id: userId, _role: role })),
  );
  const [isAdminRole, , , isGerente, isDirecao] = checks.map((c: any) => c.data);
  if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: myProfile } = await supabaseAdmin
    .from("profiles")
    .select("attraction, negocio")
    .eq("id", userId)
    .maybeSingle();
  const hasTodosScope = myProfile?.attraction === "TODOS" || myProfile?.negocio === "TODOS";
  if (isAdminRole || hasTodosScope) return null;

  let q = supabaseAdmin.from("profiles").select("id");
  q = isGerente || isDirecao
    ? q.eq("attraction", myProfile?.attraction ?? "__none__")
    : q.or(`manager_id.eq.${userId},co_leader_id.eq.${userId}`);
  const { data: profiles } = await q;
  return (profiles ?? []).map((p: { id: string }) => p.id);
}

const NPS_WINDOW_DAYS = 3;

// Cadência automática do NPS: cria a pesquisa do mês no dia 1 (se ainda não
// existir) e manda um reforço (broadcast) nos dias 2 e 3 pra quem ainda não
// respondeu. Sem cron externo — roda de carona em toda checagem de pesquisa
// ativa (toda vez que alguém abre a Home), então é best-effort e não pode
// derrubar a tela se algo falhar.
async function ensureMonthlyNpsCadence(context: { supabase: any }) {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: thisMonth } = await context.supabase
      .from("nps_surveys")
      .select("id, opens_at")
      .gte("opens_at", monthStart.toISOString())
      .order("opens_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!thisMonth) {
      const closes = new Date(now.getTime() + NPS_WINDOW_DAYS * 86_400_000);
      await supabaseAdmin.from("nps_surveys").insert({
        title: "Como está sua experiência este mês?",
        question: "De 0 a 10, o quanto você recomendaria a Hector Studios pra um amigo trabalhar aqui?",
        opens_at: now.toISOString(),
        closes_at: closes.toISOString(),
        active: true,
      });
      return;
    }

    const daysSinceOpen = Math.floor((now.getTime() - new Date(thisMonth.opens_at).getTime()) / 86_400_000);
    if (daysSinceOpen !== 1 && daysSinceOpen !== 2) return; // só reforça nos dias 2 e 3

    const category = `nps_reminder_day${daysSinceOpen + 1}`;
    const { data: already } = await context.supabase
      .from("notifications")
      .select("id")
      .eq("category", category)
      .gte("created_at", thisMonth.opens_at)
      .limit(1)
      .maybeSingle();
    if (already) return;

    await supabaseAdmin.from("notifications").insert({
      user_id: null,
      category,
      title: "Ainda dá tempo de responder a pesquisa NPS! ⭐",
      body: "Sua opinião ajuda a gente a cuidar melhor da experiência do elenco. Leva menos de 1 minuto.",
    });
  } catch {
    // best-effort — nunca deve quebrar a tela por causa disso
  }
}

export const getActiveNpsSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMonthlyNpsCadence(context);
    const nowIso = new Date().toISOString();
    const { data: survey } = await context.supabase
      .from("nps_surveys")
      .select("*")
      .eq("active", true)
      .lte("opens_at", nowIso)
      .gte("closes_at", nowIso)
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!survey) return { survey: null, answered: false };
    const { data: mine } = await context.supabase
      .from("nps_responses")
      .select("id, score")
      .eq("survey_id", survey.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { survey, answered: !!mine, myScore: mine?.score ?? null };
  });

export const submitNpsResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        survey_id: z.string().uuid(),
        score: z.number().int().min(0).max(10),
        comment: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Só 1 resposta por pessoa por pesquisa — a tabela já tem
    // UNIQUE(survey_id, user_id), então um insert simples falha sozinho se
    // a pessoa tentar de novo; a checagem explícita aqui só é pra dar uma
    // mensagem clara em vez do erro cru do Postgres.
    const { data: existing } = await context.supabase
      .from("nps_responses")
      .select("id")
      .eq("survey_id", data.survey_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      throw new Error("Você já respondeu essa pesquisa.");
    }
    const { error } = await context.supabase.from("nps_responses").insert({
      survey_id: data.survey_id,
      user_id: context.userId,
      score: data.score,
      comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listNpsSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Só valida que a pessoa tem algum papel de liderança — o conteúdo em si
    // (resultados por pesquisa) é escopado à parte em getNpsResults/getNpsHistory.
    await scopedRespondentIds(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("nps_surveys")
      .select("*")
      .order("opens_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createNpsSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(3).max(160).optional(),
        question: z.string().min(5).max(500).optional(),
        opens_at: z.string(),
        closes_at: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("nps_surveys")
      .insert({
        title: data.title,
        question: data.question,
        opens_at: data.opens_at,
        closes_at: data.closes_at,
        active: true,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getNpsResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ survey_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const scope = await scopedRespondentIds(context.supabase, context.userId);
    let q = context.supabase
      .from("nps_responses")
      .select("score, comment, created_at, user_id")
      .eq("survey_id", data.survey_id);
    if (scope) q = scope.length ? q.in("user_id", scope) : q.eq("user_id", "__none__");
    const { data: rows } = await q;
    const r = rows ?? [];
    const total = r.length;
    const promoters = r.filter((x: any) => x.score >= 9).length;
    const passives = r.filter((x: any) => x.score >= 7 && x.score <= 8).length;
    const detractors = r.filter((x: any) => x.score <= 6).length;
    const nps = total ? Math.round(((promoters - detractors) / total) * 100) : 0;
    return { total, promoters, passives, detractors, nps, comments: r };
  });

export const getNpsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await scopedRespondentIds(context.supabase, context.userId);
    const { data: surveys, error } = await context.supabase
      .from("nps_surveys")
      .select("id, title, opens_at, closes_at")
      .order("opens_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (surveys ?? []).map((s) => s.id);
    let rq = ids.length
      ? context.supabase.from("nps_responses").select("survey_id, score, user_id").in("survey_id", ids)
      : null;
    if (rq && scope) rq = scope.length ? rq.in("user_id", scope) : rq.eq("user_id", "__none__");
    const { data: rows } = rq ? await rq : { data: [] as Array<{ survey_id: string; score: number }> };

    const bySurvey = new Map<string, number[]>();
    for (const r of rows ?? []) {
      const arr = bySurvey.get(r.survey_id) ?? [];
      arr.push(r.score);
      bySurvey.set(r.survey_id, arr);
    }

    const history = (surveys ?? []).map((s) => {
      const scores = bySurvey.get(s.id) ?? [];
      const total = scores.length;
      const promoters = scores.filter((v) => v >= 9).length;
      const detractors = scores.filter((v) => v <= 6).length;
      const nps = total ? Math.round(((promoters - detractors) / total) * 100) : null;
      return {
        survey_id: s.id,
        title: s.title,
        opens_at: s.opens_at,
        month: new Date(s.opens_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        total,
        nps,
      };
    });

    return { history };
  });

export const closeNpsSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("nps_surveys")
      .update({ active: false, closes_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
