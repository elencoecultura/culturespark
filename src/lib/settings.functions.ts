import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CycleCfg = { start_date: string; cycle_days: number };

export const getGamificationCycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: setting }, { data: startTs }] = await Promise.all([
      context.supabase
        .from("app_settings")
        .select("value, updated_at")
        .eq("key", "gamification_cycle")
        .maybeSingle(),
      context.supabase.rpc("current_cycle_start"),
    ]);
    const cfg = (setting?.value ?? { start_date: "", cycle_days: 60 }) as CycleCfg;
    const cycleStart = (startTs as unknown as string | null) ?? null;
    let cycleEnd: string | null = null;
    let daysLeft: number | null = null;
    if (cycleStart) {
      const end = new Date(cycleStart);
      end.setDate(end.getDate() + (cfg.cycle_days || 60));
      cycleEnd = end.toISOString();
      daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
    }
    return {
      startDate: cfg.start_date || null,
      cycleDays: cfg.cycle_days || 60,
      currentCycleStart: cycleStart,
      currentCycleEnd: cycleEnd,
      daysLeft,
      updatedAt: setting?.updated_at ?? null,
    };
  });

export const setGamificationCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD"),
        cycleDays: z.number().int().min(1).max(365).default(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admins podem alterar o ciclo.");
    const { error } = await context.supabase.from("app_settings").upsert(
      {
        key: "gamification_cycle",
        value: { start_date: data.startDate, cycle_days: data.cycleDays },
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
