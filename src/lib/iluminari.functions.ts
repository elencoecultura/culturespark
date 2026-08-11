import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createIluminari = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        message: z.string().max(2000).optional().nullable(),
        audio_path: z.string().max(500).optional().nullable(),
        image_paths: z.array(z.string().max(500)).max(8).default([]),
        mentioned_user_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const hasAny =
      (data.message && data.message.trim().length > 0) ||
      !!data.audio_path ||
      (data.image_paths && data.image_paths.length > 0);
    if (!hasAny) throw new Error("Adicione um texto, áudio ou imagem.");

    const { error } = await context.supabase.from("iluminari_moments").insert({
      author_id: context.userId,
      message: data.message?.trim() || null,
      audio_path: data.audio_path || null,
      image_paths: data.image_paths ?? [],
      mentioned_user_id: data.mentioned_user_id || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listIluminari = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("iluminari_moments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    (rows ?? []).forEach((r) => {
      ids.add(r.author_id as string);
      if (r.mentioned_user_id) ids.add(r.mentioned_user_id as string);
    });
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, attraction")
      .in("id", Array.from(ids).length ? Array.from(ids) : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Sign each file path so it can be displayed/played
    const allPaths: string[] = [];
    (rows ?? []).forEach((r) => {
      if (r.audio_path) allPaths.push(r.audio_path);
      (r.image_paths ?? []).forEach((p) => allPaths.push(p));
    });
    const signed = new Map<string, string>();
    if (allPaths.length) {
      const { data: signedUrls } = await context.supabase.storage
        .from("iluminari")
        .createSignedUrls(allPaths, 60 * 60);
      (signedUrls ?? []).forEach((s) => {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      });
    }

    return (rows ?? []).map((r) => ({
      id: r.id as string,
      message: r.message as string | null,
      created_at: r.created_at as string,
      author: byId.get(r.author_id as string) ?? null,
      mentioned: r.mentioned_user_id ? byId.get(r.mentioned_user_id as string) ?? null : null,
      audio_url: r.audio_path ? signed.get(r.audio_path) ?? null : null,
      image_urls: (r.image_paths ?? [])
        .map((p: string) => signed.get(p))
        .filter((u: string | undefined): u is string => !!u),
    }));
  });

export const deleteIluminari = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("iluminari_moments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
