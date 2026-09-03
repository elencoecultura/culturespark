import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: notifs, error } = await context.supabase
      .from("notifications")
      .select("id, title, body, created_at, created_by, category")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const { data: reads } = await context.supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", context.userId);
    const readSet = new Set((reads ?? []).map((r) => r.notification_id));

    // O lembrete de NPS é um recado geral (user_id null, vai pra todo mundo)
    // — mas quem já respondeu a pesquisa ativa não deve continuar vendo
    // "ainda dá tempo de responder". Filtra na leitura em vez de mandar um
    // recado por pessoa.
    const hasNpsReminder = (notifs ?? []).some((n) => (n.category as string | null)?.startsWith("nps_reminder"));
    let hasAnsweredActive = false;
    if (hasNpsReminder) {
      const nowIso = new Date().toISOString();
      const { data: activeSurvey } = await context.supabase
        .from("nps_surveys")
        .select("id")
        .eq("active", true)
        .lte("opens_at", nowIso)
        .gte("closes_at", nowIso)
        .order("opens_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeSurvey) {
        const { data: myResponse } = await context.supabase
          .from("nps_responses")
          .select("id")
          .eq("survey_id", activeSurvey.id)
          .eq("user_id", context.userId)
          .maybeSingle();
        hasAnsweredActive = !!myResponse;
      }
    }

    const items = (notifs ?? [])
      .filter((n) => !(hasAnsweredActive && (n.category as string | null)?.startsWith("nps_reminder")))
      .map((n) => ({ ...n, read: readSet.has(n.id) }));
    const unread = items.filter((n) => !n.read).length;
    return { items, unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notification_reads")
      .upsert({ notification_id: data.id, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: notifs } = await context.supabase
      .from("notifications")
      .select("id");
    const rows = (notifs ?? []).map((n) => ({
      notification_id: n.id,
      user_id: context.userId,
    }));
    if (rows.length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("notification_reads")
      .upsert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(2).max(120),
        body: z.string().min(2).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin pode enviar notificações.");
    const { data: row, error } = await context.supabase
      .from("notifications")
      .insert({ title: data.title, body: data.body, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin.");
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
