import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// -------- Metadata --------

export const listPillarsAndCompetencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pillars, error: e1 } = await context.supabase
      .from("evaluation_pillars")
      .select("*")
      .order("sort_order");
    if (e1) throw new Error(e1.message);
    const { data: comps, error: e2 } = await context.supabase
      .from("evaluation_competencies")
      .select("*")
      .order("sort_order");
    if (e2) throw new Error(e2.message);
    return { pillars: pillars ?? [], competencies: comps ?? [] };
  });

// -------- Cycles --------

export const listCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("evaluation_cycles")
      .select("*")
      .order("starts_on", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(2),
        starts_on: z.string(),
        ends_on: z.string(),
        status: z.enum(["rascunho", "aberto", "em_andamento", "encerrado"]).default("rascunho"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { data: cycle, error } = await context.supabase
      .from("evaluation_cycles")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return cycle;
  });


export const openCycleAndGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cycle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    await context.supabase
      .from("evaluation_cycles")
      .update({ status: "aberto" })
      .eq("id", data.cycle_id);
    const { data: n, error } = await context.supabase.rpc("generate_evaluations_for_cycle", {
      _cycle_id: data.cycle_id,
    });
    if (error) throw new Error(error.message);
    return { generated: n as number };
  });

export const createTestEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cycle_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");

    // Pega ciclo indicado ou o mais recente
    let cycleId = data.cycle_id;
    if (!cycleId) {
      const { data: c } = await context.supabase
        .from("evaluation_cycles")
        .select("id")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!c) throw new Error("Nenhum ciclo cadastrado — crie um antes.");
      cycleId = c.id;
    }

    // Cria (ou reutiliza) uma avaliação de teste com o próprio admin como avaliado
    const { data: existing } = await context.supabase
      .from("evaluations")
      .select("id")
      .eq("cycle_id", cycleId!)
      .eq("evaluatee_id", context.userId)
      .maybeSingle();

    let evalId = existing?.id as string | undefined;
    if (!evalId) {
      const { data: ins, error } = await context.supabase
        .from("evaluations")
        .insert({
          cycle_id: cycleId!,
          evaluatee_id: context.userId,
          status: "em_andamento",
          notes: "[TESTE] Avaliação criada pelo próprio admin para testes.",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      evalId = ins.id;
    }

    // Garante o próprio admin como avaliador para conseguir editar
    const { data: ev } = await context.supabase
      .from("evaluation_evaluators")
      .select("id")
      .eq("evaluation_id", evalId!)
      .eq("evaluator_id", context.userId)
      .maybeSingle();
    if (!ev) {
      await context.supabase.from("evaluation_evaluators").insert({
        evaluation_id: evalId!,
        evaluator_id: context.userId,
        role: "leader",
      });
    }

    return { id: evalId!, cycle_id: cycleId! };
  });

// Lista membros que o usuário atual pode avaliar (admin = todos ativos; líder = seus liderados diretos/co-liderados).
export const listEvaluableMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("profiles")
      .select("id, full_name, attraction, negocio")
      .eq("active", true)
      .order("full_name");
    if (!admin) {
      q = q.or(`manager_id.eq.${context.userId},co_leader_id.eq.${context.userId}`);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).filter((p: any) => p.id !== context.userId);
  });

// Cria (ou reaproveita) avaliação para o membro escolhido no ciclo indicado, vinculando o usuário atual como avaliador.
export const createEvaluationForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ cycle_id: z.string().uuid(), evaluatee_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.supabase, context.userId);

    // Se não é admin, valida que o alvo é liderado direto ou co-liderado
    if (!admin) {
      const { data: target } = await context.supabase
        .from("profiles")
        .select("manager_id, co_leader_id")
        .eq("id", data.evaluatee_id)
        .maybeSingle();
      if (
        !target ||
        (target.manager_id !== context.userId && target.co_leader_id !== context.userId)
      ) {
        throw new Error("Você não é líder desse membro.");
      }
    }

    // Reaproveita se já existir
    const { data: existing } = await context.supabase
      .from("evaluations")
      .select("id")
      .eq("cycle_id", data.cycle_id)
      .eq("evaluatee_id", data.evaluatee_id)
      .maybeSingle();

    let evalId = existing?.id as string | undefined;
    if (!evalId) {
      const { data: ins, error } = await context.supabase
        .from("evaluations")
        .insert({
          cycle_id: data.cycle_id,
          evaluatee_id: data.evaluatee_id,
          status: "em_andamento",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      evalId = ins.id;
    }

    // Garante o usuário atual como avaliador
    const { data: ev } = await context.supabase
      .from("evaluation_evaluators")
      .select("id")
      .eq("evaluation_id", evalId!)
      .eq("evaluator_id", context.userId)
      .maybeSingle();
    if (!ev) {
      await context.supabase.from("evaluation_evaluators").insert({
        evaluation_id: evalId!,
        evaluator_id: context.userId,
        role: "leader",
      });
    }

    return { id: evalId! };
  });




// -------- Evaluations --------

export const listMyEvaluations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("evaluations")
      .select("*, evaluation_cycles(name,starts_on,ends_on,status)")
      .eq("evaluatee_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Ranking hierárquico: admin/direção avaliam gerentes; gerentes avaliam líderes; líderes avaliam elenco.
const ROLE_RANK: Record<string, number> = {
  elenco: 1,
  messenger: 1,
  lider: 2,
  leader: 2,
  gerente: 3,
  direcao: 4,
  admin: 5,
};

function topRank(roles: string[]): number {
  return roles.reduce((m, r) => Math.max(m, ROLE_RANK[r] ?? 0), 0);
}

export const listTeamEvaluations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cycle_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    // Papel do avaliador (atual)
    const { data: myRolesRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const myRank = topRank((myRolesRows ?? []).map((r: any) => r.role));
    if (myRank < 2) return []; // elenco não avalia ninguém

    let q = context.supabase
      .from("evaluations")
      .select("*, evaluation_cycles(name,starts_on,ends_on,status)")
      .order("created_at", { ascending: false });
    if (data.cycle_id) q = q.eq("cycle_id", data.cycle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.evaluatee_id)));
    if (!ids.length) return [];

    // Papéis dos avaliados
    const { data: allRoles } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const rankById = new Map<string, number>();
    (allRoles ?? []).forEach((r: any) => {
      const cur = rankById.get(r.user_id) ?? 0;
      const rk = ROLE_RANK[r.role] ?? 0;
      if (rk > cur) rankById.set(r.user_id, rk);
    });

    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id,full_name,attraction,role_title")
      .in("id", ids);
    const profileMap = new Map<string, any>();
    (profs ?? []).forEach((p: any) => profileMap.set(p.id, p));

    // Regra: avaliador só vê avaliados exatamente 1 nível abaixo.
    // Admin (5) e direção (4) enxergam gerentes; direção também vê líderes se não houver gerentes acima?
    // Mantemos regra estrita "um nível abaixo" para respeitar a cadeia.
    // Exceção: admin também enxerga tudo (visão global).
    const isGlobalAdmin = myRank >= 5;
    const filtered = (rows ?? []).filter((r: any) => {
      if (r.evaluatee_id === context.userId) return false;
      const targetRank = rankById.get(r.evaluatee_id) ?? 1; // sem papel = elenco
      if (isGlobalAdmin) return true;
      return targetRank === myRank - 1;
    });

    return filtered.map((r: any) => ({ ...r, profiles: profileMap.get(r.evaluatee_id) }));
  });

export const getEvaluationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ evaluation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ev, error } = await context.supabase
      .from("evaluations")
      .select("*, evaluation_cycles(*)")
      .eq("id", data.evaluation_id)
      .single();
    if (error) throw new Error(error.message);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name,attraction,role_title,email")
      .eq("id", ev.evaluatee_id)
      .maybeSingle();
    const { data: scores } = await context.supabase
      .from("evaluation_scores")
      .select("*")
      .eq("evaluation_id", data.evaluation_id);
    const { data: pdis } = await context.supabase
      .from("evaluation_pdis")
      .select("*")
      .eq("evaluation_id", data.evaluation_id)
      .order("created_at");
    const { data: evaluators } = await context.supabase
      .from("evaluation_evaluators")
      .select("*")
      .eq("evaluation_id", data.evaluation_id);
    return {
      evaluation: { ...ev, profiles: profile },
      scores: scores ?? [],
      pdis: pdis ?? [],
      evaluators: evaluators ?? [],
    };
  });

export const saveScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        evaluation_id: z.string().uuid(),
        competency_id: z.string().uuid(),
        score: z.number().min(1).max(5),
        note: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("evaluation_scores")
      .upsert(
        {
          evaluation_id: data.evaluation_id,
          competency_id: data.competency_id,
          score: data.score,
          comment: data.note ?? null,
          scored_by: context.userId,
        },
        { onConflict: "evaluation_id,competency_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePdi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        evaluation_id: z.string().uuid(),
        competency_id: z.string().uuid().optional(),
        objective: z.string().min(3),
        actions: z.string().optional(),
        due_on: z.string().optional(),
        status: z.enum(["aberto", "em_andamento", "concluido", "cancelado"]).default("aberto"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("evaluation_pdis")
        .update({
          objective: data.objective,
          actions: data.actions ?? null,
          due_on: data.due_on ?? null,
          status: data.status,
          competency_id: data.competency_id ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("evaluation_pdis")
      .insert({
        evaluation_id: data.evaluation_id,
        competency_id: data.competency_id ?? null,
        objective: data.objective,
        actions: data.actions ?? null,
        due_on: data.due_on ?? null,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateEvaluationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        evaluation_id: z.string().uuid(),
        status: z.enum([
          "nao_iniciada",
          "em_andamento",
          "pendente_lancamento",
          "pendente_documento",
          "concluida",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { status: typeof data.status; completed_at?: string } = { status: data.status };
    if (data.status === "concluida") patch.completed_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("evaluations")
      .update(patch)
      .eq("id", data.evaluation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const spiritLevel = z.enum(["abaixo", "no_esperado", "acima"]);

export const saveEvaluationSpirits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        evaluation_id: z.string().uuid(),
        spirit_amar: spiritLevel.optional(),
        spirit_honrar: spiritLevel.optional(),
        spirit_verdadeiro: spiritLevel.optional(),
        spirit_justo: spiritLevel.optional(),
        spirit_servir: spiritLevel.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { evaluation_id, ...patch } = data;
    const { error } = await context.supabase
      .from("evaluations")
      .update(patch)
      .eq("id", evaluation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Indicadores / Dashboard ----------

export const getEvaluationDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ cycle_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Ciclo alvo (o mais recente aberto/andamento se não informado)
    let cycleId = data.cycle_id;
    if (!cycleId) {
      const { data: c } = await context.supabase
        .from("evaluation_cycles")
        .select("id,name,status,starts_on,ends_on")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      cycleId = c?.id;
    }
    const cyclesOverview = await (async () => {
      const { data: allCycles } = await context.supabase
        .from("evaluation_cycles")
        .select("status");
      const counts = { rascunho: 0, aberto: 0, em_andamento: 0, encerrado: 0 };
      for (const c of allCycles ?? []) {
        const k = c.status as keyof typeof counts;
        if (k in counts) counts[k]++;
      }
      return { ...counts, total: allCycles?.length ?? 0 };
    })();

    if (!cycleId) {
      return {
        cycle: null,
        overall: { total: 0, done: 0, pct: 0 },
        byAttraction: [],
        byLeader: [],
        byEvaluator: [],
        byCompetency: [],
        spirits: [],
        cyclesOverview,
      };
    }

    const { data: cycle } = await context.supabase
      .from("evaluation_cycles")
      .select("id,name,status,starts_on,ends_on")
      .eq("id", cycleId)
      .maybeSingle();

    const { data: evals } = await context.supabase
      .from("evaluations")
      .select(
        "id,evaluatee_id,status,overall_score,spirit_amar,spirit_honrar,spirit_verdadeiro,spirit_justo,spirit_servir",
      )
      .eq("cycle_id", cycleId);

    const evalRows = evals ?? [];
    const evaluateeIds = Array.from(new Set(evalRows.map((e: any) => e.evaluatee_id)));

    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id,full_name,attraction,negocio,manager_id")
      .in("id", evaluateeIds.length ? evaluateeIds : ["00000000-0000-0000-0000-000000000000"]);
    const profById = new Map<string, any>();
    (profs ?? []).forEach((p: any) => profById.set(p.id, p));

    const leaderIds = Array.from(
      new Set((profs ?? []).map((p: any) => p.manager_id).filter(Boolean)),
    );
    const { data: leaders } = leaderIds.length
      ? await context.supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", leaderIds)
      : { data: [] as any[] };
    const leaderName = new Map<string, string>(
      (leaders ?? []).map((l: any) => [l.id, l.full_name]),
    );

    const isDone = (s: string) => s === "concluida";

    // Overall
    const total = evalRows.length;
    const done = evalRows.filter((e: any) => isDone(e.status)).length;

    // By attraction (negocio)
    const attMap = new Map<string, { total: number; done: number }>();
    // By leader (manager_id)
    const ldMap = new Map<string, { total: number; done: number }>();

    for (const e of evalRows) {
      const p = profById.get(e.evaluatee_id);
      const att = p?.negocio ?? p?.attraction ?? "Sem negócio";
      const attRow = attMap.get(att) ?? { total: 0, done: 0 };
      attRow.total++;
      if (isDone(e.status)) attRow.done++;
      attMap.set(att, attRow);

      const ld = p?.manager_id ?? "__unassigned__";
      const ldRow = ldMap.get(ld) ?? { total: 0, done: 0 };
      ldRow.total++;
      if (isDone(e.status)) ldRow.done++;
      ldMap.set(ld, ldRow);
    }

    const byAttraction = Array.from(attMap.entries())
      .map(([name, r]) => ({
        name,
        total: r.total,
        done: r.done,
        pct: r.total ? Math.round((r.done / r.total) * 100) : 0,
      }))
      .sort((a, b) => a.pct - b.pct);

    const byLeader = Array.from(ldMap.entries())
      .map(([id, r]) => ({
        leader_id: id,
        name: id === "__unassigned__" ? "Sem líder atribuído" : leaderName.get(id) ?? "Líder",
        total: r.total,
        done: r.done,
        pct: r.total ? Math.round((r.done / r.total) * 100) : 0,
      }))
      .sort((a, b) => a.pct - b.pct);

    // Por avaliador: quantas avaliações foram atribuídas a cada um vs. quantas
    // já foram concluídas (via evaluation_evaluators, que é quem de fato avalia —
    // diferente de byLeader, que agrupa pelo gestor do avaliado).
    const statusByEvalId = new Map<string, string>(evalRows.map((e: any) => [e.id, e.status]));
    const evalIdsForEvaluators = evalRows.map((e: any) => e.id);
    const { data: assignments } = evalIdsForEvaluators.length
      ? await context.supabase
          .from("evaluation_evaluators")
          .select("evaluator_id,evaluation_id")
          .in("evaluation_id", evalIdsForEvaluators)
      : { data: [] as any[] };

    const evMap = new Map<string, { total: number; done: number }>();
    for (const a of assignments ?? []) {
      const row = evMap.get(a.evaluator_id) ?? { total: 0, done: 0 };
      row.total++;
      if (isDone(statusByEvalId.get(a.evaluation_id) ?? "")) row.done++;
      evMap.set(a.evaluator_id, row);
    }
    const evaluatorIds = Array.from(evMap.keys());
    const { data: evaluatorProfs } = evaluatorIds.length
      ? await context.supabase.from("profiles").select("id,full_name").in("id", evaluatorIds)
      : { data: [] as any[] };
    const evaluatorName = new Map<string, string>(
      (evaluatorProfs ?? []).map((p: any) => [p.id, p.full_name]),
    );
    const byEvaluator = Array.from(evMap.entries())
      .map(([id, r]) => ({
        evaluator_id: id,
        name: evaluatorName.get(id) ?? "Avaliador",
        total: r.total,
        done: r.done,
        pct: r.total ? Math.round((r.done / r.total) * 100) : 0,
      }))
      .sort((a, b) => a.pct - b.pct);

    // Competências: média das notas para avaliações desse ciclo
    const evalIds = evalRows.map((e: any) => e.id);
    const { data: scores } = evalIds.length
      ? await context.supabase
          .from("evaluation_scores")
          .select("competency_id,score")
          .in("evaluation_id", evalIds)
      : { data: [] as any[] };

    const compAgg = new Map<string, { sum: number; count: number }>();
    (scores ?? []).forEach((s: any) => {
      if (typeof s.score !== "number") return;
      const cur = compAgg.get(s.competency_id) ?? { sum: 0, count: 0 };
      cur.sum += s.score;
      cur.count++;
      compAgg.set(s.competency_id, cur);
    });

    const { data: comps } = await context.supabase
      .from("evaluation_competencies")
      .select("id,name,expected_score,pillar_id");
    const { data: pillars } = await context.supabase
      .from("evaluation_pillars")
      .select("id,name");
    const pillarName = new Map<string, string>(
      (pillars ?? []).map((p: any) => [p.id, p.name]),
    );

    const byCompetency = (comps ?? [])
      .map((c: any) => {
        const agg = compAgg.get(c.id);
        return {
          id: c.id,
          name: c.name,
          pillar: pillarName.get(c.pillar_id) ?? "",
          expected: Number(c.expected_score ?? 4),
          avg: agg ? +(agg.sum / agg.count).toFixed(2) : null,
          count: agg?.count ?? 0,
        };
      })
      .filter((c: any) => c.count > 0)
      .sort((a: any, b: any) => (a.avg ?? 999) - (b.avg ?? 999));

    // Espírito mágico: abaixo=1, no_esperado=2, acima=3 — média geral do ciclo
    const SPIRIT_LEVEL: Record<string, number> = { abaixo: 1, no_esperado: 2, acima: 3 };
    const SPIRITS = [
      { key: "spirit_amar", label: "Amar" },
      { key: "spirit_honrar", label: "Honrar" },
      { key: "spirit_verdadeiro", label: "Ser verdadeiro" },
      { key: "spirit_justo", label: "Ser justo" },
      { key: "spirit_servir", label: "Servir" },
    ];
    const spirits = SPIRITS.map(({ key, label }) => {
      const values = evalRows
        .map((e: any) => SPIRIT_LEVEL[e[key] as string])
        .filter((v: number | undefined): v is number => typeof v === "number");
      return {
        key,
        label,
        avg: values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : null,
        count: values.length,
      };
    });

    return {
      cycle,
      overall: { total, done, pct: total ? Math.round((done / total) * 100) : 0 },
      byAttraction,
      byLeader,
      byEvaluator,
      byCompetency,
      spirits,
      cyclesOverview,
    };
  });

// ---------- Documentos assinados ----------

export const listEvaluationDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ evaluation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: docs, error } = await context.supabase
      .from("evaluation_documents")
      .select("*")
      .eq("evaluation_id", data.evaluation_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Gera URLs assinadas (bucket privado)
    const withUrls = await Promise.all(
      (docs ?? []).map(async (d: any) => {
        const { data: signed } = await context.supabase.storage
          .from("evaluation-documents")
          .createSignedUrl(d.storage_path, 60 * 30);
        return { ...d, url: signed?.signedUrl ?? null };
      }),
    );
    return withUrls;
  });

export const attachEvaluationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        evaluation_id: z.string().uuid(),
        storage_path: z.string().min(3),
        mime_type: z.string().default("application/pdf"),
        kind: z.string().default("assinada"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("evaluation_documents")
      .insert({
        evaluation_id: data.evaluation_id,
        storage_path: data.storage_path,
        mime_type: data.mime_type,
        kind: data.kind,
        uploaded_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // marca avaliação como concluída quando doc anexado
    await context.supabase
      .from("evaluations")
      .update({ status: "concluida", completed_at: new Date().toISOString() })
      .eq("id", data.evaluation_id);
    return row;
  });

// ---------- Minha Magia (jornada pessoal) ----------

export const getMyMagicJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: evals } = await context.supabase
      .from("evaluations")
      .select("id,status,overall_score,completed_at,cycle_id,evaluation_cycles(name,quarter,starts_on,ends_on)")
      .eq("evaluatee_id", context.userId)
      .order("created_at", { ascending: false });

    const evalRows = evals ?? [];
    const evalIds = evalRows.map((e: any) => e.id);

    const { data: scores } = evalIds.length
      ? await context.supabase
          .from("evaluation_scores")
          .select("evaluation_id,competency_id,score")
          .in("evaluation_id", evalIds)
      : { data: [] as any[] };

    const { data: pdis } = evalIds.length
      ? await context.supabase
          .from("evaluation_pdis")
          .select("id,evaluation_id,objective,actions,due_on,status,competency_id,created_at")
          .in("evaluation_id", evalIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

    // Média por avaliação
    const avgByEval = new Map<string, { sum: number; count: number }>();
    (scores ?? []).forEach((s: any) => {
      const cur = avgByEval.get(s.evaluation_id) ?? { sum: 0, count: 0 };
      cur.sum += Number(s.score) || 0;
      cur.count++;
      avgByEval.set(s.evaluation_id, cur);
    });

    const timeline = evalRows.map((e: any) => {
      const agg = avgByEval.get(e.id);
      return {
        evaluation_id: e.id,
        cycle_name: e.evaluation_cycles?.name ?? "Ciclo",
        quarter: e.evaluation_cycles?.quarter ?? null,
        starts_on: e.evaluation_cycles?.starts_on ?? null,
        status: e.status,
        overall: e.overall_score ?? (agg ? +(agg.sum / agg.count).toFixed(2) : null),
        completed_at: e.completed_at,
      };
    });

    return {
      timeline,
      pdis: pdis ?? [],
      totals: {
        cycles: evalRows.length,
        completed: evalRows.filter((e: any) => e.status === "concluida").length,
        pdis_open: (pdis ?? []).filter((p: any) => p.status !== "concluido" && p.status !== "cancelado").length,
        pdis_done: (pdis ?? []).filter((p: any) => p.status === "concluido").length,
      },
    };
  });

// ---------- Notificar pendentes (admin) ----------

export const notifyPendingEvaluators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cycle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");

    const { data: cycle } = await context.supabase
      .from("evaluation_cycles")
      .select("name")
      .eq("id", data.cycle_id)
      .maybeSingle();

    const { data: pending } = await context.supabase
      .from("evaluations")
      .select("id")
      .eq("cycle_id", data.cycle_id)
      .neq("status", "concluida");

    const pendingIds = (pending ?? []).map((e: any) => e.id);
    if (!pendingIds.length) return { notified: 0 };

    const { data: evrs } = await context.supabase
      .from("evaluation_evaluators")
      .select("evaluator_id")
      .in("evaluation_id", pendingIds);

    const uniqueEvaluators = Array.from(
      new Set((evrs ?? []).map((r: any) => r.evaluator_id)),
    );
    if (!uniqueEvaluators.length) return { notified: 0 };

    // Uma notificação global mencionando ciclo (visível a todos, mas foco nos avaliadores).
    // Como notifications não é por usuário, mandamos um broadcast único.
    const { error } = await context.supabase.from("notifications").insert({
      title: `Avaliações pendentes — ${cycle?.name ?? "Ciclo atual"}`,
      body: `Existem ${pendingIds.length} avaliação(ões) pendente(s). Se você é líder ou co-líder, entre em Avaliações e conclua as suas.`,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { notified: uniqueEvaluators.length, pending: pendingIds.length };
  });
