import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REPORTS, type ReportKey } from "@/lib/reports/report-defs";

// Relatórios: SOMENTE Administrador (não se libera por pessoa). Gerar e
// exportar ficam registrados em report_audit.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const paramsSchema = z
  .object({
    report: z.enum(REPORTS.map((r) => r.key) as [ReportKey, ...ReportKey[]]),
    filters: z.object({
      from: isoDate,
      to: isoDate,
      empresa: z.string().max(60).nullable().optional(),
      setor: z.string().max(60).nullable().optional(),
      cargo: z.string().max(80).nullable().optional(),
      lider: z.string().uuid().nullable().optional(),
      person: z.string().uuid().nullable().optional(),
    }),
  })
  .refine((p) => p.filters.from <= p.filters.to, "Data inicial depois da final")
  .refine(
    (p) => Date.parse(p.filters.to) - Date.parse(p.filters.from) <= 3 * 366 * 86400000,
    "Período máximo de 3 anos",
  );

async function adminCtx(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Relatórios são exclusivos de Administrador.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(
  sb: any,
  userId: string,
  report: string,
  action: "gerar" | "pdf" | "excel",
  filters: unknown,
) {
  await sb.from("report_audit").insert({ user_id: userId, report, action, filters });
}

export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => paramsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = await adminCtx(context);
    const { buildReport } = await import("@/lib/reports/build.server");
    const result = await buildReport(sb, data.report, data.filters);
    await log(sb, context.userId, data.report, "gerar", data.filters);
    return result;
  });

export const exportReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ format: z.enum(["pdf", "excel"]) })
      .and(paramsSchema)
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await adminCtx(context);
    const { buildReport } = await import("@/lib/reports/build.server");
    const { renderPdf, renderXlsx } = await import("@/lib/reports/render.server");
    const result = await buildReport(sb, data.report, data.filters);
    const { data: me } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const meta = { generatedBy: me?.full_name ?? "Administrador", generatedAt: new Date() };
    const bytes =
      data.format === "pdf" ? await renderPdf(result, meta) : await renderXlsx(result, meta);
    await log(sb, context.userId, data.report, data.format, data.filters);
    const b64 = Buffer.from(bytes).toString("base64");
    const mime =
      data.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const ext = data.format === "pdf" ? "pdf" : "xlsx";
    return {
      dataUrl: `data:${mime};base64,${b64}`,
      filename: `relatorio-${data.report}-${data.filters.from}_a_${data.filters.to}.${ext}`,
    };
  });

// Opções dos filtros (setores, cargos, líderes, pessoas).
export const reportFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await adminCtx(context);
    const { data: people } = await sb
      .from("profiles")
      .select("id, full_name, attraction, setor, role_title, active")
      .eq("active", true)
      .order("full_name");
    const { data: leaders } = await sb
      .from("user_roles")
      .select("user_id")
      .in("role", ["lider", "gerente", "direcao"]);
    const leaderIds = new Set((leaders ?? []).map((l: any) => l.user_id));
    const uniq = (xs: (string | null)[]) =>
      Array.from(new Set(xs.filter(Boolean) as string[])).sort();
    return {
      setores: uniq((people ?? []).map((p: any) => p.setor)),
      cargos: uniq((people ?? []).map((p: any) => p.role_title)),
      lideres: (people ?? [])
        .filter((p: any) => leaderIds.has(p.id))
        .map((p: any) => ({ id: p.id, full_name: p.full_name })),
      pessoas: (people ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        attraction: p.attraction,
      })),
    };
  });
