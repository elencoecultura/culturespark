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
        attraction: z.string().min(1),
        days_off: z.array(z.string()).default([]),
        weekly_hours: z.number().int().min(0).max(80),
        notes: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isLeader } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "leader",
    });
    if (!isAdmin && !isLeader) throw new Error("Forbidden");
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
    const { error } = await context.supabase.from("weekly_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
