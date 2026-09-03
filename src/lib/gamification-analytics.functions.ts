import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const POINT_LABELS: Record<string, string> = {
  checkin: "Check-in de humor",
  kudos_sent: "Elogio enviado",
  kudos_received: "Elogio recebido",
  journey_step: "Passo da jornada",
  schedule_completed: "Semana cumprida",
};



type RolesCtx = {
  userId: string;
  isAdmin: boolean;
  isDirecao: boolean;
  isGerente: boolean;
  isLider: boolean;
  negocio: string | null;
  attraction: string | null;
};

async function resolveScope(context: {
  supabase: { rpc: (n: string, p: Record<string, unknown>) => unknown; from: (t: string) => unknown };
  userId: string;
}): Promise<RolesCtx> {
  const rpc = (role: string) =>
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }) as Promise<{
      data: boolean | null;
    }>;
  const [admin, direcao, gerente, lider] = await Promise.all([
    rpc("admin"),
    rpc("direcao"),
    rpc("gerente"),
    rpc("lider"),
  ]);
  const { data: prof } = await (
    context.supabase.from("profiles") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { negocio: string | null; attraction: string | null } | null }>;
        };
      };
    }
  )
    .select("negocio, attraction")
    .eq("id", context.userId)
    .maybeSingle();
  const isAdmin = !!admin.data;
  const isDirecao = !!direcao.data;
  const isGerente = !!gerente.data;
  const isLider = !!lider.data;
  if (!isAdmin && !isDirecao && !isGerente && !isLider) {
    throw new Error("Acesso restrito a admin, direção, gerente ou líder.");
  }
  return {
    userId: context.userId,
    isAdmin,
    isDirecao,
    isGerente,
    isLider,
    negocio: prof?.negocio ?? null,
    attraction: prof?.attraction ?? null,
  };
}

/**
 * Returns the set of user_ids the caller is allowed to see in analytics.
 * - Admin/Direção: everyone
 * - Gerente: same `negocio` (a atração/casa inteira)
 * - Líder: só quem tem manager_id OU co_leader_id apontando pro próprio
 *   líder (o time direto dele — várias lideranças podem dividir a mesma
 *   atração, então nunca escopa líder por atração, só por manager_id/
 *   co_leader_id, igual ao painel de check-ins).
 * Returns null when there is no restriction.
 */
function allowedIdsFor(
  scope: RolesCtx,
  profiles: ProfileRow[],
): Set<string> | null {
  if (scope.isAdmin || scope.isDirecao) return null;
  const ids = new Set<string>();
  for (const p of profiles) {
    if (scope.isGerente && scope.negocio && p.negocio === scope.negocio) ids.add(p.id);
    else if (scope.isLider && (p.manager_id === scope.userId || p.co_leader_id === scope.userId)) ids.add(p.id);
  }
  return ids;
}

async function assertAdmin(context: { supabase: { rpc: (n: string, p: Record<string, unknown>) => unknown }; userId: string }) {
  const { data } = await (context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  }) as Promise<{ data: boolean | null }>);
  if (!data) throw new Error("Apenas admins.");
}




/**
 * Closes the current cycle by writing a snapshot of every user's points in that window.
 * Safe to call multiple times (upsert by cycle + user).
 */
export const snapshotCurrentCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        cycleStart: z.string().optional(),
        cycleEnd: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Parameters<typeof assertAdmin>[0]);

    let cycleStart = data.cycleStart;
    let cycleEnd = data.cycleEnd;
    if (!cycleStart || !cycleEnd) {
      const { data: startTs } = await context.supabase.rpc("current_cycle_start");
      const { data: setting } = await context.supabase
        .from("app_settings")
        .select("value")
        .eq("key", "gamification_cycle")
        .maybeSingle();
      const days =
        ((setting?.value as { cycle_days?: number } | null)?.cycle_days as number | undefined) ?? 60;
      const s = (startTs as unknown as string | null) ?? null;
      if (!s) throw new Error("Configure a data de início do ciclo antes de fechar.");
      const end = new Date(s);
      end.setDate(end.getDate() + days);
      cycleStart = s;
      cycleEnd = end.toISOString();
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await supabaseAdmin.rpc("snapshot_gamification_cycle", {
      _cycle_start: cycleStart,
      _cycle_end: cycleEnd,
    });
    if (error) throw new Error(error.message);
    return { ok: true, snapshotted: count as number, cycleStart, cycleEnd };
  });

export const listCycleSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Parameters<typeof assertAdmin>[0]);
    const { data, error } = await context.supabase
      .from("gamification_cycle_snapshots")
      .select("cycle_start, cycle_end")
      .order("cycle_start", { ascending: false });
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const cycles: { cycleStart: string; cycleEnd: string }[] = [];
    for (const r of data ?? []) {
      const k = `${r.cycle_start}|${r.cycle_end}`;
      if (seen.has(k)) continue;
      seen.add(k);
      cycles.push({ cycleStart: r.cycle_start as string, cycleEnd: r.cycle_end as string });
    }
    return cycles;
  });

type GroupKey = "negocio" | "kind" | "role" | "user";

type Row = {
  user_id: string;
  points: number;
  kind: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  negocio: string | null;
  setor: string | null;
  attraction: string | null;
  manager_id?: string | null;
  co_leader_id?: string | null;
};

type RoleRow = { user_id: string; role: string };

/**
 * Period filter: either a saved snapshot window or an arbitrary date range.
 * Source: 'live' reads `point_events` (current period). 'snapshot' reads `gamification_cycle_snapshots`.
 */
export const getGamificationAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        source: z.enum(["live", "snapshot"]).default("live"),
        groupBy: z.enum(["negocio", "kind", "role", "user"]).default("negocio"),
        negocio: z.string().optional(),
        role: z.string().optional(),
        kind: z.string().optional(),
        userId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context as unknown as Parameters<typeof resolveScope>[0]);

    // Resolve users + roles up front.
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, negocio, setor, attraction, manager_id, co_leader_id");
    const profById = new Map<string, ProfileRow>(
      (profiles ?? []).map((p) => [p.id as string, p as ProfileRow]),
    );
    const allowed = allowedIdsFor(scope, (profiles ?? []) as ProfileRow[]);

    const { data: rolesRows } = await context.supabase
      .from("user_roles")
      .select("user_id, role");

    const roleById = new Map<string, string>();
    (rolesRows ?? []).forEach((r) => {
      const u = r.user_id as string;
      const cur = roleById.get(u);
      // priority: admin > direcao > gerente > lider > elenco
      const prio: Record<string, number> = { admin: 5, direcao: 4, gerente: 3, lider: 2, elenco: 1 };
      if (!cur || (prio[r.role as string] ?? 0) > (prio[cur] ?? 0)) {
        roleById.set(u, r.role as string);
      }
    });

    let rows: Row[] = [];

    if (data.source === "snapshot") {
      let q = context.supabase
        .from("gamification_cycle_snapshots")
        .select("user_id, total_points, breakdown, cycle_start, cycle_end, negocio, role");
      if (data.from) q = q.gte("cycle_start", data.from);
      if (data.to) q = q.lte("cycle_end", data.to);
      const { data: snaps, error } = await q;
      if (error) throw new Error(error.message);
      for (const s of snaps ?? []) {
        const bd = (s.breakdown as Record<string, number> | null) ?? {};
        const entries = Object.entries(bd);
        if (entries.length === 0) {
          rows.push({
            user_id: s.user_id as string,
            points: (s.total_points as number) ?? 0,
            kind: "all",
            created_at: s.cycle_start as string,
          });
        } else {
          for (const [k, v] of entries) {
            rows.push({
              user_id: s.user_id as string,
              points: Number(v) || 0,
              kind: k,
              created_at: s.cycle_start as string,
            });
          }
        }
      }
    } else {
      // RLS de point_events só libera ver os próprios eventos (fora admin) —
      // aqui o escopo já é aplicado em JS logo abaixo (`allowed`), então
      // usa o client de service role pra não perder os eventos de quem não
      // é o próprio caller.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // .limit() explícito: sem ele o Supabase corta em 1000 linhas por
      // padrão, e a tabela inteira já passa disso — sem filtro de data
      // metade dos eventos some da consulta sem erro nenhum.
      let q = supabaseAdmin.from("point_events").select("user_id, points, kind, created_at").limit(50000);
      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lt("created_at", data.to);
      if (data.kind) q = q.eq("kind", data.kind);
      const { data: evs, error } = await q;
      if (error) throw new Error(error.message);
      rows = (evs ?? []).map((e) => ({
        user_id: e.user_id as string,
        points: (e.points as number) ?? 0,
        kind: e.kind as string,
        created_at: e.created_at as string,
      }));
    }

    // Scope by leader/manager visibility.
    if (allowed) rows = rows.filter((r) => allowed.has(r.user_id));

    // Single member focus.
    if (data.userId) {
      if (allowed && !allowed.has(data.userId)) {
        throw new Error("Sem acesso a este membro.");
      }
      rows = rows.filter((r) => r.user_id === data.userId);
    }

    // Apply post-filters (negocio / role) since they live on profiles/user_roles.
    if (data.negocio) {
      const set = new Set(
        Array.from(profById.values())
          .filter((p) => (p.negocio ?? "") === data.negocio)
          .map((p) => p.id),
      );
      rows = rows.filter((r) => set.has(r.user_id));
    }
    if (data.role) {
      rows = rows.filter((r) => (roleById.get(r.user_id) ?? "elenco") === data.role);
    }
    if (data.source === "snapshot" && data.kind) {
      rows = rows.filter((r) => r.kind === data.kind);
    }


    // Aggregate by groupBy.
    const groupKeyOf = (r: Row, gb: GroupKey): string => {
      const p = profById.get(r.user_id);
      switch (gb) {
        case "negocio":
          return p?.negocio || "Sem empresa";
        case "kind":
          return POINT_LABELS[r.kind] ?? r.kind;
        case "role":
          return roleById.get(r.user_id) || "elenco";
        case "user":
          return p?.full_name || r.user_id;
      }
    };

    const summary = new Map<string, { points: number; users: Set<string>; events: number }>();
    for (const r of rows) {
      const k = groupKeyOf(r, data.groupBy);
      const cur = summary.get(k) ?? { points: 0, users: new Set<string>(), events: 0 };
      cur.points += r.points;
      cur.users.add(r.user_id);
      cur.events += 1;
      summary.set(k, cur);
    }
    const summaryRows = Array.from(summary.entries())
      .map(([key, v]) => ({ key, points: v.points, users: v.users.size, events: v.events }))
      .sort((a, b) => b.points - a.points);

    // Analytical: per-user breakdown.
    const perUser = new Map<
      string,
      { points: number; byKind: Record<string, number> }
    >();
    for (const r of rows) {
      const cur = perUser.get(r.user_id) ?? { points: 0, byKind: {} };
      cur.points += r.points;
      cur.byKind[r.kind] = (cur.byKind[r.kind] ?? 0) + r.points;
      perUser.set(r.user_id, cur);
    }
    const detail = Array.from(perUser.entries())
      .map(([uid, v]) => {
        const p = profById.get(uid);
        return {
          userId: uid,
          name: p?.full_name || "—",
          negocio: p?.negocio || "—",
          setor: p?.setor || "—",
          role: roleById.get(uid) || "elenco",
          points: v.points,
          byKind: v.byKind,
        };
      })
      .sort((a, b) => b.points - a.points);

    const totals = {
      points: rows.reduce((s, r) => s + r.points, 0),
      users: new Set(rows.map((r) => r.user_id)).size,
      events: rows.length,
    };

    return { totals, summary: summaryRows, detail, pointLabels: POINT_LABELS };
  });

/**
 * Returns the list of cast members (NOME) the caller is allowed to filter by.
 * - Admin/Direção: everyone (active)
 * - Gerente: same negocio
 * - Líder: same attraction
 */
export const listAnalyticsMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolveScope(context as unknown as Parameters<typeof resolveScope>[0]);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, negocio, attraction, active, manager_id, co_leader_id")
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    const allowed = allowedIdsFor(scope, (profiles ?? []) as unknown as ProfileRow[]);
    const rows = (profiles ?? [])
      .filter((p) => !allowed || allowed.has(p.id as string))
      .map((p) => ({
        id: p.id as string,
        name: (p.full_name as string) || "—",
        negocio: (p.negocio as string | null) ?? null,
        attraction: (p.attraction as string | null) ?? null,
      }));
    return { scope: { isAdmin: scope.isAdmin, isDirecao: scope.isDirecao, isGerente: scope.isGerente, isLider: scope.isLider }, members: rows };
  });

