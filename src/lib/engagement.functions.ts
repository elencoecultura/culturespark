import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Moderação do Elogio Rápido: bloqueia o envio na hora (não deixa nem
// registrar) quando a mensagem tem ofensa, discriminação, ameaça ou
// conteúdo de segunda intenção/não-corporativo.
const BLOCKED_TERMS = [
  // ofensas, discriminação, ameaças
  "idiota", "imbecil", "burro", "burra", "estúpido", "estúpida", "otário", "otária",
  "vagabundo", "vagabunda", "vadia", "safada", "safado",
  "assédio", "assediar",
  "racista", "racismo", "macaco", "macaca",
  "viado", "bicha", "sapatão",
  "ameaça", "ameaçar", "matar", "morrer",
  "gorda", "gordo", "baleia", "aleijado", "aleijada", "retardado", "retardada",
  // segunda intenção / conteúdo não-corporativo
  "gostosa", "gostoso", "gostosão", "gostosona", "gostosinho", "gostosinha",
  "delícia", "delicioso", "deliciosa", "peguete",
  "lindo", "linda", "fofo", "fofa", "fofinho", "fofinha",
  "gato", "gata", "gatinho", "gatinha",
  "benzinho", "xuxu", "docinho", "gracinha",
  "cheiroso", "cheirosa", "sexy", "sensual", "tesão", "tesudo", "tesuda",
  "sarado", "sarada", "corpão", "beldade", "princesa",
  "meu amor", "paixão", "apaixonado", "apaixonada", "apaixonei",
  "flerte", "flertar", "crush", "cantada", "dar em cima",
  "namorar", "namorado", "namorada", "ficante",
];

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function findBlockedTerm(text: string): string | null {
  const normalized = stripAccents(text).toLowerCase();
  for (const term of BLOCKED_TERMS) {
    const normTerm = stripAccents(term).toLowerCase();
    const pattern = new RegExp(`(^|[^a-z0-9à-ú])${normTerm}([^a-z0-9à-ú]|$)`, "i");
    if (pattern.test(normalized)) return term;
  }
  return null;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin");
}

const LOW_MOOD_THRESHOLD = 2;
const LOW_MOOD_STREAK = 3;

// Alerta de energia baixa: dispara pra liderança inteira (líder direto +
// gerente da casa + admin/RH), não só pro painel restrito de 2 admins.
// Dedupe via low_energy_alerts: só notifica de novo se a sequência tiver
// recomeçado (checkin mais alto no meio) desde o último alerta.
async function checkLowEnergyEscalation(context: { supabase: any; userId: string }) {
  const { data: recent } = await context.supabase
    .from("mood_checkins")
    .select("mood, created_at")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(LOW_MOOD_STREAK);
  const rows = recent ?? [];
  if (rows.length < LOW_MOOD_STREAK) return;
  if (!rows.every((r: any) => r.mood <= LOW_MOOD_THRESHOLD)) return;

  const streakStart = rows[rows.length - 1].created_at;
  const { data: already } = await context.supabase
    .from("low_energy_alerts")
    .select("id")
    .eq("user_id", context.userId)
    .gte("triggered_at", streakStart)
    .limit(1)
    .maybeSingle();
  if (already) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("full_name, manager_id, negocio, attraction")
    .eq("id", context.userId)
    .maybeSingle();
  if (!prof) return;

  const recipientIds = new Set<string>();
  if (prof.manager_id) recipientIds.add(prof.manager_id);

  const negocio = prof.negocio ?? prof.attraction;
  if (negocio) {
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "gerente");
    const gerenteIds = (roleRows ?? []).map((r: any) => r.user_id);
    if (gerenteIds.length) {
      const { data: gerentes } = await supabaseAdmin
        .from("profiles")
        .select("id, negocio, attraction")
        .in("id", gerenteIds);
      for (const g of gerentes ?? []) {
        if (g.negocio === negocio || g.attraction === negocio) recipientIds.add(g.id);
      }
    }
  }

  const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  for (const a of admins ?? []) recipientIds.add(a.user_id);

  recipientIds.delete(context.userId);
  if (recipientIds.size === 0) return;

  const title = "Alerta de energia baixa 💛";
  const body = `${prof.full_name ?? "Uma pessoa do elenco"} teve ${LOW_MOOD_STREAK} check-ins seguidos de energia baixa. Vale um cuidado próximo.`;
  await supabaseAdmin.from("notifications").insert(
    Array.from(recipientIds).map((uid) => ({
      user_id: uid,
      category: "low_energy_alert",
      title,
      body,
    })),
  );
  await supabaseAdmin
    .from("low_energy_alerts")
    .insert({ user_id: context.userId, streak_len: LOW_MOOD_STREAK });
}

export const submitMood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ mood: z.number().int().min(1).max(5), note: z.string().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Só 1 check-in por dia (fuso America/Sao_Paulo, mesmo usado no streak).
    const { data: recent } = await context.supabase
      .from("mood_checkins")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const tz = "America/Sao_Paulo";
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const last = recent?.[0]?.created_at;
    if (last && fmt.format(new Date(last as string)) === fmt.format(new Date())) {
      throw new Error("Você já fez seu check-in hoje. Até amanhã!");
    }

    const { error } = await context.supabase
      .from("mood_checkins")
      .insert({ user_id: context.userId, mood: data.mood, note: data.note ?? null });
    if (error) throw new Error(error.message);
    await checkLowEnergyEscalation(context);
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

// Lista leve de colegas (só id + nome), acessível pra qualquer pessoa logada —
// usada no seletor "pra quem" do Elogio Rápido. listUsers (admin.functions.ts)
// exige líder/admin e devolve dado sensível demais pra esse uso.
export const listColleagues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name");
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
    if (findBlockedTerm(data.message)) {
      throw new Error("Essa mensagem não é apropriada pro ambiente corporativo — revise o texto e tente de novo.");
    }

    // Máximo 4 elogios "normais" por dia (fuso America/Sao_Paulo) — evita
    // gente mandando vários só pra pontuar no ranking. Elogio de aniversário
    // (category "aniversario") não entra nessa conta nem é bloqueado por
    // ela — é celebração, não é o elogio que a gente quer limitar.
    const KUDOS_PER_DAY_LIMIT = 4;
    const isBirthdayKudos = data.category === "aniversario";
    if (!isBirthdayKudos) {
      // filtra "aniversario" em JS (não no banco): .neq() no Postgres exclui
      // category NULL também (comparação com NULL vira desconhecido), o que
      // ia derrubar a contagem pra quase todo mundo, já que elogio normal
      // sempre tem category null.
      const { data: recentSent } = await context.supabase
        .from("kudos")
        .select("created_at, category")
        .eq("from_user", context.userId)
        .order("created_at", { ascending: false })
        .limit(40);
      const tz = "America/Sao_Paulo";
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      const todayKey = fmt.format(new Date());
      const sentToday = (recentSent ?? []).filter(
        (r) => r.category !== "aniversario" && fmt.format(new Date(r.created_at as string)) === todayKey,
      ).length;
      if (sentToday >= KUDOS_PER_DAY_LIMIT) {
        throw new Error(`Você já mandou ${KUDOS_PER_DAY_LIMIT} elogios hoje — volta amanhã pra mandar mais.`);
      }
    }

    const { error } = await context.supabase.from("kudos").insert({
      from_user: context.userId,
      to_user: data.to_user,
      message: data.message,
      category: data.category ?? null,
      flagged: false,
      flag_reason: null,
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
    // Privado: só quem mandou ou recebeu vê o elogio — nunca um feed público.
    const { data, error } = await context.supabase
      .from("kudos")
      .select("*")
      .or(`from_user.eq.${context.userId},to_user.eq.${context.userId}`)
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

// Admin/RH: ver TODOS os elogios (não só os sinalizados por palavra) — bullying
// e assédio quase nunca usam os termos bloqueados, então revisão de conteúdo
// livre é a única forma real de pegar isso.
export const listAllKudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Busca (quando houver) bate tanto no texto da mensagem quanto no nome de
    // quem manda/recebe — por isso filtra em memória depois de resolver os
    // nomes, em vez de filtrar já na query (não dá pra fazer ILIKE em nome
    // de outra tabela numa query só).
    const fetchLimit = data.search ? 500 : data.limit;
    const { data: rows, error } = await supabaseAdmin
      .from("kudos")
      .select("id, from_user, to_user, message, category, flagged, flag_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).flatMap((r) => [r.from_user, r.to_user])));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string }> };
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

    let result = (rows ?? []).map((r) => ({
      ...r,
      from_name: nameById.get(r.from_user) ?? "Alguém",
      to_name: nameById.get(r.to_user) ?? "Alguém",
    }));

    if (data.search) {
      const term = data.search.toLowerCase();
      result = result
        .filter(
          (r) =>
            r.message.toLowerCase().includes(term) ||
            r.from_name.toLowerCase().includes(term) ||
            r.to_name.toLowerCase().includes(term),
        )
        .slice(0, data.limit);
    }

    return result;
  });

// Admin/RH: remove um elogio identificado como abusivo/bullying na revisão manual.
export const deleteKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("kudos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaderOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // "leader" não existe mais como papel (virou "lider"/"gerente"/"direcao").
    const checks = await Promise.all(
      (["admin", "lider", "leader", "gerente", "direcao"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
    const since = new Date();
    since.setDate(since.getDate() - 7);
    // RLS (scoped read mood) já limita as linhas ao próprio time do chamador
    // (manager_id pra líder, atração pra gerente/direção) — não precisa
    // filtrar de novo aqui.
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
