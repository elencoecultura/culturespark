import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

export const getActiveNpsSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
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
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { data: rows } = await context.supabase
      .from("nps_responses")
      .select("score, comment, created_at")
      .eq("survey_id", data.survey_id);
    const r = rows ?? [];
    const total = r.length;
    const promoters = r.filter((x: any) => x.score >= 9).length;
    const passives = r.filter((x: any) => x.score >= 7 && x.score <= 8).length;
    const detractors = r.filter((x: any) => x.score <= 6).length;
    const nps = total ? Math.round(((promoters - detractors) / total) * 100) : 0;
    return { total, promoters, passives, detractors, nps, comments: r };
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
