import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERFIS = ["ELENCO", "LÍDER", "LIDER", "GERENTE", "DIREÇÃO", "DIRECAO", "ADMIN"] as const;

const rowSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().optional().nullable(),
  cargo: z.string().trim().max(120).optional().nullable(),
  setor: z.string().trim().max(60).optional().nullable(),
  perfil: z.string().trim().transform((s) => s.toUpperCase()).refine((s) => PERFIS.includes(s as any), "perfil inválido"),
  negocio: z.string().trim().min(1).max(80),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin");
}

export const importPreRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rows: z.array(rowSchema).min(1).max(2000),
      replaceAll: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.replaceAll) {
      // Only delete unclaimed rows so we don't lose link to existing users
      await supabaseAdmin.from("pre_registrations").delete().is("claimed_by", null);
    }

    // Dedupe within the incoming payload (last write wins per email / per normalized name)
    const seenEmail = new Map<string, number>();
    const seenName = new Map<string, number>();
    let skipped = 0;
    const cleanedRows = data.rows.filter((row, idx) => {
      const e = row.email?.toLowerCase().trim() ?? "";
      if (e) {
        if (seenEmail.has(e)) { skipped++; return false; }
        seenEmail.set(e, idx);
      }
      return true;
    });

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of cleanedRows) {
      const { data: normName } = await supabaseAdmin
        .rpc("normalize_name", { _s: row.full_name });
      const nameKey = (normName as string | null) ?? "";
      if (nameKey) {
        if (seenName.has(nameKey)) { skipped++; continue; }
        seenName.set(nameKey, 1);
      }

      // 1) Find existing row: by email first, then by normalized name (any negocio)
      type ExistingRow = {
        id: string;
        full_name: string;
        email: string | null;
        cargo: string | null;
        setor: string | null;
        perfil: string;
        negocio: string;
        claimed_by: string | null;
      };
      let existing: ExistingRow | null = null;

      if (row.email) {
        const { data: ex } = await supabaseAdmin
          .from("pre_registrations")
          .select("id, full_name, email, cargo, setor, perfil, negocio, claimed_by")
          .ilike("email", row.email)
          .maybeSingle();
        existing = (ex as ExistingRow | null) ?? null;
      }
      if (!existing && nameKey) {
        // prefer claimed > oldest
        const { data: candidates } = await supabaseAdmin
          .from("pre_registrations")
          .select("id, full_name, email, cargo, setor, perfil, negocio, claimed_by, created_at")
          .eq("name_normalized", nameKey)
          .order("claimed_by", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: true })
          .limit(1);
        existing = ((candidates ?? [])[0] as ExistingRow | undefined) ?? null;
      }

      if (existing) {
        // Claimed rows: preserve full_name + email so the auth link stays intact.
        const isClaimed = !!existing.claimed_by;
        const next = {
          full_name: isClaimed ? existing.full_name : row.full_name,
          email: isClaimed ? existing.email : (row.email || null),
          cargo: row.cargo || null,
          setor: row.setor || null,
          perfil: row.perfil,
          negocio: row.negocio,
        };
        const changed =
          next.full_name !== existing.full_name ||
          (next.email ?? null) !== (existing.email ?? null) ||
          (next.cargo ?? null) !== (existing.cargo ?? null) ||
          (next.setor ?? null) !== (existing.setor ?? null) ||
          next.perfil !== existing.perfil ||
          next.negocio !== existing.negocio;

        if (!changed) { unchanged++; continue; }

        const { error } = await (supabaseAdmin.from("pre_registrations") as any)
          .update(next).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabaseAdmin.from("pre_registrations").insert({
          full_name: row.full_name,
          email: row.email || null,
          cargo: row.cargo || null,
          setor: row.setor || null,
          perfil: row.perfil,
          negocio: row.negocio,
        });
        if (error) {
          // Race against unique indexes → treat as duplicate, skip instead of failing the batch
          if (/duplicate key|unique/i.test(error.message)) { skipped++; continue; }
          throw new Error(error.message);
        }
        inserted++;
      }
    }
    return { inserted, updated, unchanged, skipped, total: data.rows.length };
  });


export const listPreRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pre_registrations")
      .select("id, full_name, email, cargo, setor, perfil, negocio, claimed_by, claimed_at, created_at")
      .order("negocio")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deletePreRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pre_registrations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: called from /cadastro before account creation
export const lookupPreRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email().optional(),
      full_name: z.string().trim().min(2).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_pre_registration", {
      _email: data.email ?? "",
      _full_name: data.full_name ?? "",
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { found: false as const };
    return {
      found: true as const,
      id: row.id as string,
      full_name: row.full_name as string,
      already_claimed: row.already_claimed as boolean,
    };

  });

// Public: fuzzy search by name (returns top suggestions for the cadastro UI)
export const searchPreRegistrations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      q: z.string().trim().min(2).max(120),
      limit: z.number().int().min(1).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("search_pre_registrations", {
      _q: data.q,
      _limit: data.limit ?? 5,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      full_name: string;
      already_claimed: boolean;
      similarity: number;
    }>;

  });

