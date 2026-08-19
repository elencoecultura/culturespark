import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Moderação leve do Elogio Rápido: não bloqueia o envio, só sinaliza pra
// revisão de gestão/RH quando a mensagem tem termo sensível. Lista curta
// de propósito — é um ponto de partida, fácil de estender depois.
const SENSITIVE_TERMS = [
  "idiota", "imbecil", "burro", "burra", "estúpido", "estúpida", "otário", "otária",
  "vagabundo", "vagabunda", "vadia", "safada", "safado",
  "gostosa", "gostoso", "delícia", "peguete",
  "assédio", "assediar",
  "racista", "racismo", "macaco", "macaca",
  "viado", "bicha", "sapatão",
  "ameaça", "ameaçar", "matar", "morrer",
  "gorda", "gordo", "baleia", "aleijado", "aleijada", "retardado", "retardada",
];

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function flagMessage(text: string): string | null {
  const normalized = stripAccents(text).toLowerCase();
  const hits = SENSITIVE_TERMS.filter((term) => normalized.includes(stripAccents(term).toLowerCase()));
  return hits.length ? hits.join(", ") : null;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin");
}

export const submitMood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ mood: z.number().int().min(1).max(5), note: z.string().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mood_checkins")
      .insert({ user_id: context.userId, mood: data.mood, note: data.note ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyMoods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mood_checkins")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(14);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sendKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        to_user: z.string().uuid(),
        message: z.string().min(2).max(500),
        category: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.to_user === context.userId) {
      throw new Error("Você não pode mandar um elogio pra você mesmo.");
    }
    const flagReason = flagMessage(data.message);
    const { error } = await context.supabase.from("kudos").insert({
      from_user: context.userId,
      to_user: data.to_user,
      message: data.message,
      category: data.category ?? null,
      flagged: !!flagReason,
      flag_reason: flagReason,
    });
    if (error) throw new Error(error.message);

    const { data: sender } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      user_id: data.to_user,
      title: "Você recebeu um elogio! 💫",
      body: `${sender?.full_name ?? "Alguém"}: ${data.message}`,
      created_by: context.userId,
    });

    return { ok: true };
  });

export const listKudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kudos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Admin/RH: elogios sinalizados pela moderação leve, pra revisão.
export const listFlaggedKudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("kudos")
      .select("id, from_user, to_user, message, flag_reason, created_at")
      .eq("flagged", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).flatMap((r) => [r.from_user, r.to_user])));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string }> };
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

    return (rows ?? []).map((r) => ({
      ...r,
      from_name: nameById.get(r.from_user) ?? "Alguém",
      to_name: nameById.get(r.to_user) ?? "Alguém",
    }));
  });

export const resolveFlaggedKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("kudos").update({ flagged: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaderOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isLeader } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "leader",
    });
    if (!isAdmin && !isLeader) throw new Error("Forbidden");
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: moods } = await context.supabase
      .from("mood_checkins")
      .select("user_id, mood, created_at")
      .gte("created_at", since.toISOString());
    const avg =
      moods && moods.length
        ? moods.reduce((s, m) => s + (m.mood as number), 0) / moods.length
        : 0;
    return { sampleSize: moods?.length ?? 0, avgMood: Math.round(avg * 10) / 10 };
  });
