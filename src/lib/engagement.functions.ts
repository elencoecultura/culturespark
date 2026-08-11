import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      throw new Error("Você não pode mandar kudos pra você mesmo.");
    }
    const { error } = await context.supabase.from("kudos").insert({
      from_user: context.userId,
      to_user: data.to_user,
      message: data.message,
      category: data.category ?? null,
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
      title: "Você recebeu um toque! 💫",
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
