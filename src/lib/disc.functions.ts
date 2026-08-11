import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUESTIONS, comboFor, type Essence } from "@/lib/disc-content";

const DAY = 86_400_000;
const UNLOCK_DAYS = 7; // disponível 1 semana após o primeiro login
const COOLDOWN_DAYS = 365; // 1x por ano

export const getDiscStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const prof = await context.supabase
      .from("profiles")
      .select("first_login_at, created_at")
      .eq("id", context.userId)
      .maybeSingle();

    const last = await context.supabase
      .from("behavioral_tests")
      .select("*")
      .eq("user_id", context.userId)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = Date.now();
    const firstLogin = prof.data?.first_login_at ?? prof.data?.created_at ?? null;
    const daysSinceLogin = firstLogin
      ? Math.floor((now - new Date(firstLogin).getTime()) / DAY)
      : 0;
    const unlockInDays = Math.max(0, UNLOCK_DAYS - daysSinceLogin);

    const lastTaken = last.data?.taken_at ? new Date(last.data.taken_at).getTime() : null;
    const daysSinceTest = lastTaken != null ? Math.floor((now - lastTaken) / DAY) : null;
    const cooldownDays = daysSinceTest == null ? 0 : Math.max(0, COOLDOWN_DAYS - daysSinceTest);

    return {
      eligible: unlockInDays === 0 && cooldownDays === 0,
      unlockInDays,
      cooldownDays,
      hasEver: !!last.data,
      last: last.data
        ? {
            taken_at: last.data.taken_at,
            scores: {
              D: last.data.score_d,
              I: last.data.score_i,
              S: last.data.score_s,
              C: last.data.score_c,
            },
            primary: last.data.primary_essence,
            secondary: last.data.secondary_essence,
            combination: last.data.combination,
            profile_type: last.data.profile_type,
            share_with_leadership: last.data.share_with_leadership,
          }
        : null,
    };
  });

export const submitDiscTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        answers: z
          .array(
            z.object({ n: z.number().int().min(1).max(24), label: z.enum(["A", "B", "C", "D"]) }),
          )
          .length(24),
        share_with_leadership: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Pontuação a partir do mapeamento oficial (fonte de verdade no servidor).
    const scores: Record<Essence, number> = { D: 0, I: 0, S: 0, C: 0 };
    for (const a of data.answers) {
      const q = QUESTIONS.find((x) => x.n === a.n);
      const opt = q?.options.find((o) => o.label === a.label);
      if (opt) scores[opt.key] += 1;
    }

    const order = (["D", "I", "S", "C"] as const)
      .map((k) => ({ k, v: scores[k] }))
      .sort((a, b) => b.v - a.v);
    const primary = order[0].k;
    const secondary = order[1].k;
    const spread = order[0].v - order[3].v;
    const gapTop = order[0].v - order[1].v;
    const profile_type = spread <= 2 ? "versatil" : gapTop <= 2 ? "dupla" : "single";
    const combo = comboFor(primary, secondary);

    const ins = await context.supabase
      .from("behavioral_tests")
      .insert({
        user_id: context.userId,
        score_d: scores.D,
        score_i: scores.I,
        score_s: scores.S,
        score_c: scores.C,
        primary_essence: primary,
        secondary_essence: secondary,
        combination: combo?.name ?? null,
        profile_type,
        answers: data.answers,
        share_with_leadership: data.share_with_leadership ?? false,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);

    return {
      id: ins.data?.id ?? null,
      scores,
      primary,
      secondary,
      combination: combo?.name ?? null,
      profile_type,
    };
  });

// Admin: resultados de quem consentiu compartilhar + distribuição do time.
export const listTeamDiscResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const res = await context.supabase
      .from("behavioral_tests")
      .select("user_id, taken_at, primary_essence, secondary_essence, combination, profile_type")
      .eq("share_with_leadership", true)
      .order("taken_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);

    // Mantém apenas o resultado mais recente de cada pessoa.
    const latest = new Map<string, NonNullable<typeof res.data>[number]>();
    for (const r of res.data ?? []) if (!latest.has(r.user_id)) latest.set(r.user_id, r);
    const base = Array.from(latest.values());

    const ids = base.map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, attraction, negocio")
          .in("id", ids)
      : {
          data: [] as Array<{
            id: string;
            full_name: string;
            attraction: string | null;
            negocio: string | null;
          }>,
        };
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));

    const distribution: Record<Essence, number> = { D: 0, I: 0, S: 0, C: 0 };
    let versatile = 0;
    const rows = base
      .map((r) => {
        const primary = r.primary_essence as Essence;
        distribution[primary] = (distribution[primary] ?? 0) + 1;
        if (r.profile_type === "versatil") versatile += 1;
        const p = profById.get(r.user_id);
        return {
          user_id: r.user_id,
          name: p?.full_name ?? "Elenco",
          attraction: p?.attraction ?? p?.negocio ?? null,
          primary,
          secondary: r.secondary_essence as Essence | null,
          combination: r.combination,
          profile_type: r.profile_type,
          taken_at: r.taken_at,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { rows, distribution, total: rows.length, versatile };
  });
