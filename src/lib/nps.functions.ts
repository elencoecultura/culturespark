import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAllRows } from "@/lib/db-pagination";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// Resultado de NPS é sensível (pode conter comentário livre da pessoa) e o
// pedido original só citava gerente/direção/admin como público — líder comum
// FICA DE FORA aqui (mesmo sendo "isLeader" pro resto do app), porque um
// líder normalmente reporta pra um gerente e não pode ver os dados que são do
// escopo do próprio gerente dele. Gerente/direção vê a atração inteira, admin
// (ou attraction/negocio="TODOS") vê tudo. Retorna `null` quando o escopo é
// "vê tudo" — quem chama trata isso como "sem filtro".
const NPS_VISIBLE_ROLES = ["admin", "gerente", "direcao"] as const;
async function scopedRespondentIds(supabase: any, userId: string): Promise<string[] | null> {
  const checks = await Promise.all(
    NPS_VISIBLE_ROLES.map((role) => supabase.rpc("has_role", { _user_id: userId, _role: role })),
  );
  const [isAdminRole, isGerente, isDirecao] = checks.map((c: any) => c.data);
  if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: myProfile } = await supabaseAdmin
    .from("profiles")
    .select("attraction, negocio")
    .eq("id", userId)
    .maybeSingle();
  const hasTodosScope = myProfile?.attraction === "TODOS" || myProfile?.negocio === "TODOS";
  if (isAdminRole || hasTodosScope) return null;

  // gerente/direção: a atração/casa inteira (inclui a si mesmo, se responder)
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("attraction", myProfile?.attraction ?? "__none__");
  return (profiles ?? []).map((p: { id: string }) => p.id);
}

const NPS_WINDOW_DAYS = 3;

// Perguntas extras da pesquisa (cada uma nota de 0 a 10), guardadas em
// nps_surveys.extra_questions como [{id, text}]. A pergunta principal segue em
// nps_surveys.question e é a única que alimenta o NPS/histórico. Tolerante a
// coluna ausente/valor estranho: sem a migration aplicada vira lista vazia.
type ExtraQuestion = { id: string; text: string };
function parseExtraQuestions(raw: unknown): ExtraQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is ExtraQuestion => !!q && typeof (q as any).id === "string" && typeof (q as any).text === "string",
  );
}

function scoreStats(scores: number[]) {
  const n = scores.length;
  const histogram = Array.from({ length: 11 }, (_, i) => scores.filter((v) => v === i).length);
  const avg = n ? Math.round((scores.reduce((a, b) => a + b, 0) / n) * 10) / 10 : null;
  return { total: n, avg, histogram };
}

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
    // Cadência automática mensal desligada — pesquisa de NPS surgindo sozinha
    // todo dia 1 pegava o elenco de surpresa. Quem cria uma pesquisa agora é
    // sempre uma pessoa, explicitamente (ver createNpsSurvey mais abaixo).
    // A função ensureMonthlyNpsCadence continua no arquivo, só não é chamada.
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
    return {
      survey: { ...survey, extra_questions: parseExtraQuestions((survey as any).extra_questions) },
      answered: !!mine,
      myScore: mine?.score ?? null,
    };
  });

export const submitNpsResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        survey_id: z.string().uuid(),
        score: z.number().int().min(0).max(10),
        extra_scores: z.record(z.string(), z.number().int().min(0).max(10)).optional(),
        comment: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Pesquisa com várias perguntas: todas precisam de nota de 0 a 10 (o
    // comentário continua opcional) e não aceita nota pra pergunta que não
    // existe nessa pesquisa.
    const { data: survey } = await context.supabase
      .from("nps_surveys")
      .select("*")
      .eq("id", data.survey_id)
      .maybeSingle();
    if (!survey) throw new Error("Pesquisa não encontrada.");
    const extras = parseExtraQuestions((survey as any).extra_questions);
    const given = data.extra_scores ?? {};
    if (extras.some((q) => given[q.id] === undefined)) {
      throw new Error("Responda todas as perguntas da pesquisa.");
    }
    const knownIds = new Set(extras.map((q) => q.id));
    if (Object.keys(given).some((k) => !knownIds.has(k))) throw new Error("Resposta inválida.");

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
      // só manda a coluna quando há pergunta extra: pesquisa de pergunta
      // única segue funcionando mesmo antes da migration ser aplicada
      ...(extras.length ? { extra_scores: given } : {}),
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
        extra_questions: z.array(z.string().trim().min(3).max(300)).max(15).optional(),
        kind: z.enum(["nps", "quiz"]).optional(),
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
        ...(data.extra_questions?.length
          ? { extra_questions: data.extra_questions.map((text, i) => ({ id: `q${i + 2}`, text })) }
          : {}),
        // só manda a coluna no questionário: NPS é o padrão do banco
        ...(data.kind === "quiz" ? { kind: "quiz" } : {}),
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
    const { data: survey } = await context.supabase
      .from("nps_surveys")
      .select("*")
      .eq("id", data.survey_id)
      .maybeSingle();
    const extras = parseExtraQuestions((survey as any)?.extra_questions);
    // select("*") (e não a lista de colunas) pra continuar funcionando antes
    // da migration das perguntas extras ser aplicada
    let q = context.supabase.from("nps_responses").select("*").eq("survey_id", data.survey_id);
    if (scope) q = scope.length ? q.in("user_id", scope) : q.eq("user_id", "__none__");
    const { data: rows } = await q;
    const r = rows ?? [];
    const total = r.length;
    const promoters = r.filter((x: any) => x.score >= 9).length;
    const passives = r.filter((x: any) => x.score >= 7 && x.score <= 8).length;
    const detractors = r.filter((x: any) => x.score <= 6).length;
    const nps = total ? Math.round(((promoters - detractors) / total) * 100) : 0;

    // Estatística por pergunta: a principal (a do NPS) + as extras. Só a
    // principal tem NPS; as extras são nota média e distribuição de 0 a 10.
    const questions = [
      { id: "main", text: (survey?.question as string | undefined) ?? "", ...scoreStats(r.map((x: any) => x.score as number)) },
      ...extras.map((e) => ({
        id: e.id,
        text: e.text,
        ...scoreStats(
          r
            .map((x: any) => (x.extra_scores as Record<string, number> | null | undefined)?.[e.id])
            .filter((v): v is number => typeof v === "number"),
        ),
      })),
    ];

    const comments = r.map((x: any) => ({
      score: x.score as number,
      comment: x.comment as string | null,
      created_at: x.created_at as string,
      user_id: x.user_id as string,
    }));
    const kind = (survey as any)?.kind === "quiz" ? ("quiz" as const) : ("nps" as const);
    return { kind, total, promoters, passives, detractors, nps, comments, questions };
  });

export const getNpsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await scopedRespondentIds(context.supabase, context.userId);
    const { data: allSurveys, error } = await context.supabase
      .from("nps_surveys")
      .select("*")
      .order("opens_at", { ascending: true });
    if (error) throw new Error(error.message);
    // questionário (kind "quiz") não tem NPS — fica fora da evolução
    const surveys = (allSurveys ?? []).filter((s) => (s as any).kind !== "quiz");

    const ids = surveys.map((s) => s.id);
    const emptyScope = scope !== null && scope.length === 0;
    // Paginado de verdade (teto de 1000 linhas por requisição no servidor)
    const rows =
      ids.length && !emptyScope
        ? await fetchAllRows<{ survey_id: string; score: number; user_id: string }>((from, to) => {
            let rq = context.supabase.from("nps_responses").select("survey_id, score, user_id").in("survey_id", ids);
            if (scope) rq = rq.in("user_id", scope);
            return rq.range(from, to);
          })
        : [];

    const bySurvey = new Map<string, number[]>();
    for (const r of rows) {
      const arr = bySurvey.get(r.survey_id) ?? [];
      arr.push(r.score);
      bySurvey.set(r.survey_id, arr);
    }

    const history = surveys.map((s) => {
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

// Visão geral pra tela de Pesquisas: cada pesquisa (NPS ou questionário) com
// quantas pessoas responderam, de quantas no escopo de quem está vendo.
export const listNpsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await scopedRespondentIds(context.supabase, context.userId);
    const { data: surveys, error } = await context.supabase
      .from("nps_surveys")
      .select("*")
      .order("opens_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = surveys ?? [];
    const ids = list.map((s) => s.id);
    const emptyScope = scope !== null && scope.length === 0;

    const rows =
      ids.length && !emptyScope
        ? await fetchAllRows<{ survey_id: string; score: number }>((from, to) => {
            let rq = context.supabase.from("nps_responses").select("survey_id, score").in("survey_id", ids);
            if (scope) rq = rq.in("user_id", scope);
            return rq.range(from, to);
          })
        : [];
    const bySurvey = new Map<string, number[]>();
    for (const r of rows) {
      const arr = bySurvey.get(r.survey_id) ?? [];
      arr.push(r.score);
      bySurvey.set(r.survey_id, arr);
    }

    let eligible = 0;
    if (!emptyScope) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let pq = supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("active", true);
      if (scope) pq = pq.in("id", scope);
      const { count } = await pq;
      eligible = count ?? 0;
    }

    return {
      eligible,
      surveys: list.map((s) => {
        const scores = bySurvey.get(s.id) ?? [];
        const total = scores.length;
        const kind = (s as any).kind === "quiz" ? ("quiz" as const) : ("nps" as const);
        const promoters = scores.filter((v) => v >= 9).length;
        const detractors = scores.filter((v) => v <= 6).length;
        return {
          id: s.id,
          title: s.title,
          question: s.question,
          kind,
          extra_questions: parseExtraQuestions((s as any).extra_questions),
          opens_at: s.opens_at,
          closes_at: s.closes_at,
          active: s.active,
          total,
          nps: kind === "nps" && total ? Math.round(((promoters - detractors) / total) * 100) : null,
        };
      }),
    };
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

export const deleteNpsSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    // Service role: o papel authenticated só tem SELECT em nps_surveys. As
    // respostas saem junto (nps_responses.survey_id é ON DELETE CASCADE).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("nps_surveys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
