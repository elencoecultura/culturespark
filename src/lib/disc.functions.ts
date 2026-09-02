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
    const eligible = unlockInDays === 0 && cooldownDays === 0;

    if (eligible) {
      // Notifica só na primeira checagem depois de liberar (dedupe por categoria +
      // janela desde a última liberação: testes anteriores viram a régua pra trás).
      const since = lastTaken ? new Date(lastTaken).toISOString() : "1970-01-01T00:00:00Z";
      const already = await context.supabase
        .from("notifications")
        .select("id")
        .eq("user_id", context.userId)
        .eq("category", "disc_unlocked")
        .gt("created_at", since)
        .limit(1)
        .maybeSingle();
      if (!already.data) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("notifications").insert({
          user_id: context.userId,
          category: "disc_unlocked",
          title: "Sua Bússola das Essências está liberada! 🧭",
          body: "Já dá pra fazer o teste comportamental e descobrir seu personagem-espírito.",
        });
      }
    }

    return {
      eligible,
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

// Gerente/direção/admin: resultados de quem consentiu compartilhar +
// distribuição do time. Mesmo escopo do NPS — gerente/direção só vê a
// própria casa, admin (ou attraction/negocio="TODOS") vê tudo. Líder comum
// fica de fora (mesma razão do NPS: reporta pro gerente, não vê o escopo
// que é dele).
export const listTeamDiscResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const checks = await Promise.all(
      (["admin", "gerente", "direcao"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
    const [isAdmin] = checks.map((c: any) => c.data);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: myProfile } = await supabaseAdmin
      .from("profiles")
      .select("attraction, negocio")
      .eq("id", context.userId)
      .maybeSingle();
    const hasTodosScope = myProfile?.attraction === "TODOS" || myProfile?.negocio === "TODOS";
    const seesAll = isAdmin || hasTodosScope;

    const res = await context.supabase
      .from("behavioral_tests")
      .select(
        "user_id, taken_at, score_d, score_i, score_s, score_c, primary_essence, secondary_essence, combination, profile_type",
      )
      .eq("share_with_leadership", true)
      .order("taken_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);

    // Mantém apenas o resultado mais recente de cada pessoa.
    const latest = new Map<string, NonNullable<typeof res.data>[number]>();
    for (const r of res.data ?? []) if (!latest.has(r.user_id)) latest.set(r.user_id, r);
    const allBase = Array.from(latest.values());

    const allIds = allBase.map((r) => r.user_id);
    const { data: profs } = allIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, attraction, negocio, setor").in("id", allIds)
      : {
          data: [] as Array<{
            id: string;
            full_name: string;
            attraction: string | null;
            negocio: string | null;
            setor: string | null;
          }>,
        };
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));

    // gerente/direção só vê a própria casa (attraction/negocio) — admin/TODOS vê tudo.
    const base = seesAll
      ? allBase
      : allBase.filter((r) => {
          const p = profById.get(r.user_id);
          return (p?.attraction ?? p?.negocio) === myProfile?.attraction;
        });

    type GroupBucket = { distribution: Record<Essence, number>; scoreSum: Record<Essence, number>; total: number };
    const distribution: Record<Essence, number> = { D: 0, I: 0, S: 0, C: 0 };
    let versatile = 0;

    const rows = base
      .map((r) => {
        const primary = r.primary_essence as Essence;
        distribution[primary] = (distribution[primary] ?? 0) + 1;
        if (r.profile_type === "versatil") versatile += 1;
        const p = profById.get(r.user_id);
        const attraction = p?.attraction ?? p?.negocio ?? null;
        const setor = p?.setor ?? null;
        const scores: Record<Essence, number> = {
          D: r.score_d as number,
          I: r.score_i as number,
          S: r.score_s as number,
          C: r.score_c as number,
        };

        return {
          user_id: r.user_id,
          name: p?.full_name ?? "Elenco",
          attraction,
          setor,
          scores,
          primary,
          secondary: r.secondary_essence as Essence | null,
          combination: r.combination,
          profile_type: r.profile_type,
          taken_at: r.taken_at,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const ESSENCE_LABEL: Record<Essence, string> = {
      D: "Dominância",
      I: "Influência",
      S: "Estabilidade",
      C: "Conformidade",
    };

    // Agrupa os resultados por uma chave qualquer (casa ou setor) — usado
    // tanto pra "por casa" quanto pra "por setor" (Cozinha/Salão/etc), que é
    // o corte que faz sentido dentro de uma casa só (ou cruzando casas, pra
    // quem vê tudo — ex: "Cozinha" da Pizzaria + "Cozinha" da Era do Fogo
    // juntas, já que a pergunta normalmente é sobre a função, não a casa).
    function groupBy(keyFor: (row: (typeof rows)[number]) => string | null, fallback: string) {
      const groups = new Map<string, GroupBucket>();
      for (const r of rows) {
        const key = keyFor(r) ?? fallback;
        const bucket = groups.get(key) ?? {
          distribution: { D: 0, I: 0, S: 0, C: 0 },
          scoreSum: { D: 0, I: 0, S: 0, C: 0 },
          total: 0,
        };
        bucket.distribution[r.primary] += 1;
        (["D", "I", "S", "C"] as Essence[]).forEach((k) => (bucket.scoreSum[k] += r.scores[k]));
        bucket.total += 1;
        groups.set(key, bucket);
      }
      return Array.from(groups.entries())
        .map(([label, bucket]) => {
          const predominant = (["D", "I", "S", "C"] as Essence[]).sort(
            (a, b) => bucket.distribution[b] - bucket.distribution[a],
          )[0];
          const avgScore: Record<Essence, number> = { D: 0, I: 0, S: 0, C: 0 };
          (["D", "I", "S", "C"] as Essence[]).forEach(
            (k) => (avgScore[k] = bucket.total ? Math.round((bucket.scoreSum[k] / bucket.total) * 10) / 10 : 0),
          );
          return {
            label,
            distribution: bucket.distribution,
            avgScore,
            total: bucket.total,
            predominant,
            predominantLabel: ESSENCE_LABEL[predominant],
          };
        })
        .sort((a, b) => b.total - a.total);
    }

    const byAttractionList = groupBy((r) => r.attraction, "Sem casa definida").map((g) => ({
      ...g,
      attraction: g.label,
    }));
    const bySetorList = groupBy((r) => r.setor, "Sem setor definido").map((g) => ({ ...g, setor: g.label }));

    return {
      rows,
      distribution,
      total: rows.length,
      versatile,
      byAttraction: byAttractionList,
      bySetor: bySetorList,
      seesAll,
    };
  });
