import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findBlockedTerm } from "@/lib/engagement.functions";
import { companyAnniversaryThisWeek, weekRangeSP } from "@/lib/celebration-rules";

// Celebração da Magia: quem completa anos de empresa (data de admissão) na
// semana atual, seg -> dom, fuso America/Sao_Paulo. Só entra quem completa 1
// ano ou mais. Felicitação: 1 por remetente, por aniversariante, por
// aniversário de empresa; ninguém felicita a si mesmo; 3 pontos para quem envia.

const CELEBRATION_POINTS = 3;

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

async function weekRows() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, attraction, negocio, role_title, admission_date")
    .eq("active", true)
    .not("admission_date", "is", null);
  if (error) throw new Error(error.message);
  const week = weekRangeSP(new Date());
  return (data ?? [])
    .map((p) => {
      const a = companyAnniversaryThisWeek(p.admission_date as string, week);
      return a ? { ...p, ...a } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const listWeekCompanyAnniversaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = await weekRows();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = rows.map((r) => r.id);
    const { data: wishes } = ids.length
      ? await supabaseAdmin
          .from("company_anniversary_wishes")
          .select("from_user, to_user, anniversary_year")
          .in("to_user", ids)
      : { data: [] as { from_user: string; to_user: string; anniversary_year: number }[] };
    return {
      rows: rows.map((r) => {
        const mine = (wishes ?? []).filter(
          (w) => w.to_user === r.id && w.anniversary_year === r.anniversaryYear,
        );
        return {
          id: r.id,
          full_name: r.full_name,
          attraction: r.attraction ?? r.negocio,
          role_title: r.role_title,
          years: r.years,
          date: r.date,
          weekday: r.weekday,
          is_today: r.isToday,
          anniversary_year: r.anniversaryYear,
          received_count: mine.length,
          sent_by_me: mine.some((w) => w.from_user === context.userId),
        };
      }),
    };
  });

export const sendCompanyAnniversaryWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ to_user: z.string().uuid(), message: z.string().trim().min(2).max(280) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    {
      const { assertAction } = await import("@/lib/permissions.server");
      await assertAction(context.userId, "celebrar");
    }
    if (data.to_user === context.userId) throw new Error("Você não pode felicitar a si mesmo.");
    if (findBlockedTerm(data.message)) {
      throw new Error(
        "Essa mensagem não é apropriada pro ambiente corporativo — revise o texto e tente de novo.",
      );
    }
    // Só vale para quem realmente completa anos de casa nesta semana.
    const target = (await weekRows()).find((r) => r.id === data.to_user);
    if (!target) throw new Error("Essa pessoa não completa aniversário de empresa nesta semana.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("company_anniversary_wishes")
      .insert({
        from_user: context.userId,
        to_user: data.to_user,
        anniversary_year: target.anniversaryYear,
        years: target.years,
        message: data.message,
      })
      .select("id")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("Você já felicitou essa pessoa por este aniversário de empresa.");
      throw new Error("Não consegui enviar a felicitação. Tente de novo.");
    }

    // Pontos de quem enviou: histórico com o tipo "celebracao_magia" (Celebração da Magia)
    await supabaseAdmin.rpc("award_points", {
      _user_id: context.userId,
      _kind: "celebracao_magia",
      _points: CELEBRATION_POINTS,
      _ref_id: row.id,
    });

    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const anos = `${target.years} ${target.years === 1 ? "ano" : "anos"} de magia`;
    await supabaseAdmin.from("notifications").insert({
      user_id: data.to_user,
      title: `Celebração da Magia: ${anos}!`,
      body: `${sender?.full_name ?? "Alguém"}: ${data.message}`,
      created_by: context.userId,
      category: "celebracao_magia",
    });
    return { ok: true };
  });

// Felicitações que eu recebi (todas as celebrações, mais recentes primeiro).
export const listMyAnniversaryWishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("company_anniversary_wishes")
      .select("id, from_user, years, anniversary_year, message, created_at")
      .eq("to_user", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const fromIds = Array.from(new Set((data ?? []).map((w) => w.from_user)));
    const { data: names } = fromIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", fromIds)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((names ?? []).map((n) => [n.id, n.full_name]));
    return (data ?? []).map((w) => ({ ...w, from_name: nameById.get(w.from_user) ?? "Alguém" }));
  });

// Moderação (admin): todas as felicitações, com remoção.
export const listAllAnniversaryWishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Apenas admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("company_anniversary_wishes")
      .select("id, from_user, to_user, years, message, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).flatMap((w) => [w.from_user, w.to_user])));
    const { data: names } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((names ?? []).map((n) => [n.id, n.full_name]));
    return (data ?? []).map((w) => ({
      ...w,
      from_name: nameById.get(w.from_user) ?? "?",
      to_name: nameById.get(w.to_user) ?? "?",
    }));
  });

export const deleteAnniversaryWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Apenas admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: w } = await supabaseAdmin
      .from("company_anniversary_wishes")
      .select("id, from_user")
      .eq("id", data.id)
      .maybeSingle();
    if (!w) return { ok: true };
    // Mensagem removida pela moderação não vale ponto.
    await supabaseAdmin
      .from("point_events")
      .delete()
      .eq("user_id", w.from_user)
      .eq("kind", "celebracao_magia")
      .eq("ref_id", w.id);
    const { error } = await supabaseAdmin
      .from("company_anniversary_wishes")
      .delete()
      .eq("id", w.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
