import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const JOB_STATUSES = [
  "pending",
  "changes_requested",
  "approved",
  "rejected",
  "in_recruitment",
  "finished",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ATTRACTION_OPTIONS = [
  "Hector Pizzaria",
  "Ferrovia Secreta",
  "Era do Fogo",
  "Hector Studios",
  "Castelo de Gelo",
  "Clicks Mágicos",
];
export const DEPARTMENT_OPTIONS = [
  "Operações",
  "Atendimento",
  "Cozinha",
  "Marketing",
  "DHO",
  "Financeiro",
  "Tecnologia",
];
export const LEVEL_OPTIONS = ["Estágio", "Júnior", "Pleno", "Sênior", "Liderança"];
export const TYPE_OPTIONS = ["Nova posição", "Substituição", "Temporária", "Aumento de demanda"];
export const CONTRACT_OPTIONS = ["CLT", "PJ", "Freelancer", "Estágio"];
export const WORKLOAD_OPTIONS = [
  "44h semanais",
  "40h semanais",
  "36h semanais",
  "30h semanais",
  "Escala especial",
];
export const MODEL_OPTIONS = ["Presencial", "Híbrido", "Remoto"];
export const URGENCY_OPTIONS = ["Baixa", "Média", "Alta"];

const jobInput = z.object({
  title: z.string().trim().min(2).max(120),
  attraction: z.string().min(1).max(80),
  department: z.string().min(1).max(80),
  level: z.string().min(1).max(40),
  type: z.string().min(1).max(40),
  contract: z.string().min(1).max(40),
  workload: z.string().min(1).max(40),
  model: z.string().min(1).max(40),
  urgency: z.string().min(1).max(20),
  start_date: z.string().optional().nullable(),
  budget: z.string().max(120).optional().nullable(),
  manager_name: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(5).max(2000),
  activities: z.string().trim().min(5).max(2000),
  requirements: z.string().trim().min(5).max(2000),
});

async function ensureLeaderOrAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return { isAdmin: true, isLeader: true };
  // "leader" não existe mais como papel (virou "lider"/"gerente"/"direcao").
  const checks = await Promise.all(
    ["lider", "leader", "gerente", "direcao"].map((role) => supabase.rpc("has_role", { _user_id: userId, _role: role })),
  );
  if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
  return { isAdmin: false, isLeader: true };
}
async function ensureAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

export const createJobRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => jobInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureLeaderOrAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("job_requests")
      .insert({
        ...data,
        start_date: data.start_date || null,
        budget: data.budget || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const listJobRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureLeaderOrAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("job_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideJobRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject", "request_changes"]),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const status: JobStatus =
      data.action === "approve" ? "approved" : data.action === "reject" ? "rejected" : "changes_requested";
    const { error } = await (context.supabase.from("job_requests") as any)
      .update({
        status,
        decision_note: data.note ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateRecruitmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "in_recruitment", "finished"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase.from("job_requests") as any)
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteJobRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("job_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
