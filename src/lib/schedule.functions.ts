import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ATTRACTIONS = [
  "Hector Studios",
  "Pizzaria",
  "Ferrovia",
  "Era do Fogo",
  "Clicks Mágicos",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// Liderança só mexe na escala de quem está no próprio escopo (time direto ou
// casa, conforme can_view_user_data); a própria só quando allowSelf (lançar a
// própria escala pode; apagar não, porque recriar gerava +20 pts de novo).
// Admin mexe em todas.
async function assertScheduleScope(supabase: any, me: string, target: string, isAdmin: boolean, allowSelf = false) {
  if (isAdmin) return;
  if (target === me) {
    if (allowSelf) return;
    throw new Error("Forbidden");
  }
  const { data: inScope } = await supabase.rpc("can_view_user_data", { _target_user_id: target, _viewer_id: me });
  if (!inScope) throw new Error("Forbidden");
}

export const listWeekSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week_start: isoDate }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("weekly_schedules")
      .select("*")
      .eq("week_start", data.week_start);
    if (error) throw new Error(error.message);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, attraction, weekly_hours, days_off");
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  });

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        week_start: isoDate,
        user_id: z.string().uuid(),
        attraction: z.string().min(1).max(80),
        days_off: z.array(z.string().max(20)).max(7).default([]),
        weekly_hours: z.number().int().min(0).max(80),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    {
      const { assertAction } = await import("@/lib/permissions.server");
      await assertAction(context.userId, "editar_escala");
    }
    // "leader" não existe mais como papel (virou "lider"/"gerente"/"direcao").
    const checks = await Promise.all(
      (["admin", "lider", "leader", "gerente", "direcao"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
    await assertScheduleScope(context.supabase, context.userId, data.user_id, !!checks[0]?.data, true);
    const { error } = await context.supabase
      .from("weekly_schedules")
      .upsert(
        { ...data, created_by: context.userId },
        { onConflict: "week_start,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    {
      const { assertAction } = await import("@/lib/permissions.server");
      await assertAction(context.userId, "editar_escala");
    }
    // Antes não checava nada no servidor (só RLS): apagar e recriar a escala
    // gerava um id novo e +20 pts de novo. Agora exige liderança e escopo.
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("weekly_schedules").select("user_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Escala não encontrada");
    if (!isAdmin) {
      const leader = await Promise.all(
        (["lider", "gerente", "direcao"] as const).map((role) =>
          context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
        ),
      );
      if (!leader.some((c: any) => c.data)) throw new Error("Forbidden");
    }
    await assertScheduleScope(context.supabase, context.userId, row.user_id, !!isAdmin);
    const { error } = await context.supabase.from("weekly_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
