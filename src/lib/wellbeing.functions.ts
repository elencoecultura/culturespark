import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Dado sensível de bem-estar — visível só pro admin supremo (Chauny e Lucas),
// não pra qualquer admin. Ajuste esta lista se a liderança mudar.
export const SUPREME_EMAILS = ["lucas@hectorstudios.com.br", "chauny@hectorstudios.com.br"];

const LOW_MOOD_THRESHOLD = 2;
const WINDOW_DAYS = 60;

export const getMoodConcerns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.email || !SUPREME_EMAILS.includes(me.email.toLowerCase())) {
      throw new Error("Forbidden");
    }

    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);

    const { data: moods, error } = await context.supabase
      .from("mood_checkins")
      .select("user_id, mood, note, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const byUser = new Map<string, { mood: number; note: string | null; created_at: string }[]>();
    for (const m of moods ?? []) {
      const list = byUser.get(m.user_id) ?? [];
      list.push({ mood: m.mood, note: m.note, created_at: m.created_at });
      byUser.set(m.user_id, list);
    }

    const userIds = Array.from(byUser.keys());
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, attraction, negocio")
          .in("id", userIds)
      : { data: [] as Array<{ id: string; full_name: string; attraction: string | null; negocio: string | null }> };
    const profById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows = userIds.map((userId) => {
      // já vem ordenado por created_at desc
      const entries = byUser.get(userId)!;
      const lowCount = entries.filter((e) => e.mood <= LOW_MOOD_THRESHOLD).length;
      const avg = entries.reduce((s, e) => s + e.mood, 0) / entries.length;

      let streak = 0;
      for (const e of entries) {
        if (e.mood <= LOW_MOOD_THRESHOLD) streak++;
        else break;
      }

      const p = profById.get(userId);
      return {
        user_id: userId,
        name: p?.full_name ?? "Elenco",
        attraction: p?.attraction ?? p?.negocio ?? null,
        checkins: entries.length,
        lowCount,
        avgMood: Math.round(avg * 10) / 10,
        streak,
        lastMood: entries[0]?.mood ?? null,
        lastNote: entries[0]?.note ?? null,
        lastAt: entries[0]?.created_at ?? null,
      };
    });

    rows.sort((a, b) => b.streak - a.streak || b.lowCount - a.lowCount || a.avgMood - b.avgMood);

    return { windowDays: WINDOW_DAYS, lowThreshold: LOW_MOOD_THRESHOLD, rows };
  });
