import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const registerAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        absence_date: isoDate,
        reason: z.string().max(400).optional().nullable(),
        attachment_path: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("journey_absences")
      .upsert(
        {
          user_id: context.userId,
          absence_date: data.absence_date,
          reason: data.reason ?? null,
          attachment_path: data.attachment_path ?? null,
        },
        { onConflict: "user_id,absence_date" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("journey_absences")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyAbsences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("journey_absences")
      .select("*")
      .eq("user_id", context.userId)
      .order("absence_date", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const paths = (rows ?? [])
      .map((r) => r.attachment_path)
      .filter((p): p is string => !!p);
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: signedUrls } = await context.supabase.storage
        .from("journey-absences")
        .createSignedUrls(paths, 60 * 60);
      (signedUrls ?? []).forEach((s) => {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      });
    }

    return (rows ?? []).map((r) => ({
      ...r,
      attachment_url: r.attachment_path ? signed.get(r.attachment_path) ?? null : null,
    }));
  });

export const copyPreviousWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target_week: isoDate }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("weekly_schedules")
      .select("id")
      .eq("user_id", uid)
      .eq("week_start", data.target_week)
      .maybeSingle();
    if (existing) throw new Error("week_already_exists");

    const { data: src } = await supabaseAdmin
      .from("weekly_schedules")
      .select("*")
      .eq("user_id", uid)
      .lt("week_start", data.target_week)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!src) throw new Error("no_previous_week");

    const { data: inserted, error } = await supabaseAdmin
      .from("weekly_schedules")
      .insert({
        user_id: uid,
        week_start: data.target_week,
        attraction: src.attraction,
        days_off: src.days_off,
        weekly_hours: src.weekly_hours,
        notes: src.notes,
        created_by: uid,
        completed_full: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const listTodayCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attraction: z.string().optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    // Qualquer papel de liderança pode ver os check-ins — antes só "admin" e
    // "leader" passavam, deixando gerente/líder ("lider")/direção de fora
    // (era exatamente o caso de um gerente que enxerga várias atrações).
    const LEADERSHIP_ROLES = ["admin", "leader", "lider", "gerente", "direcao"] as const;
    const roleChecks = await Promise.all(
      LEADERSHIP_ROLES.map((role) => context.supabase.rpc("has_role", { _user_id: context.userId, _role: role })),
    );
    const hasLeadershipRole = roleChecks.some((r) => r.data);
    if (!hasLeadershipRole) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, attraction, active")
      .eq("active", true);
    if (data.attraction) q = q.eq("attraction", data.attraction);
    const { data: people, error } = await q;
    if (error) throw new Error(error.message);

    const tz = "America/Sao_Paulo";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const startUtc = new Date(`${today}T00:00:00-03:00`).toISOString();

    const ids = (people ?? []).map((p) => p.id);
    if (!ids.length) return { today, rows: [] };

    const { data: checkins } = await supabaseAdmin
      .from("mood_checkins")
      .select("user_id, created_at, mood")
      .in("user_id", ids)
      .gte("created_at", startUtc);

    const { data: absences } = await supabaseAdmin
      .from("journey_absences")
      .select("user_id, reason, attachment_path, absence_date")
      .in("user_id", ids)
      .eq("absence_date", today);

    const checkinByUser = new Map<string, { created_at: string; mood: number }>();
    (checkins ?? []).forEach((c) => {
      const prev = checkinByUser.get(c.user_id as string);
      if (!prev || new Date(c.created_at as string) > new Date(prev.created_at)) {
        checkinByUser.set(c.user_id as string, {
          created_at: c.created_at as string,
          mood: c.mood as number,
        });
      }
    });
    const absenceByUser = new Map(
      (absences ?? []).map((a) => [a.user_id as string, a]),
    );

    const absencePaths = (absences ?? [])
      .map((a) => a.attachment_path)
      .filter((p): p is string => !!p);
    const signed = new Map<string, string>();
    if (absencePaths.length) {
      const { data: urls } = await supabaseAdmin.storage
        .from("journey-absences")
        .createSignedUrls(absencePaths, 60 * 60);
      (urls ?? []).forEach((s) => {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      });
    }

    const rows = (people ?? [])
      .map((p) => {
        const ci = checkinByUser.get(p.id);
        const ab = absenceByUser.get(p.id);
        return {
          user_id: p.id,
          name: p.full_name || "Sem nome",
          attraction: p.attraction ?? "",
          checked_in: !!ci,
          checked_at: ci?.created_at ?? null,
          mood: ci?.mood ?? null,
          absent: !!ab,
          absence_reason: ab?.reason ?? null,
          absence_url: ab?.attachment_path ? signed.get(ab.attachment_path) ?? null : null,
        };
      })
      .sort((a, b) => {
        if (a.checked_in !== b.checked_in) return a.checked_in ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    return { today, rows };
  });

