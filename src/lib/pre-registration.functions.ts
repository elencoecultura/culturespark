import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERFIS = ["ELENCO", "LÍDER", "LIDER", "GERENTE", "DIREÇÃO", "DIRECAO", "ADMIN"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida")
  .refine((v) => {
    const y = Number(v.slice(0, 4));
    return y >= 1900 && y <= 2100 && !Number.isNaN(Date.parse(v));
  }, "data inválida");

const rowSchema = z.object({
  birth_date: isoDate.optional().nullable(),
  admission_date: isoDate.optional().nullable(),
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
      // Cadastro manual: é intenção explícita (ex.: recontratação), então
      // passa por cima da lista de excluídos e tira a pessoa dela.
      manual: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Quem foi excluído do pré-cadastro não volta pela planilha. Tabela pode
    // ainda não existir (migration pendente): aí não filtra nada.
    const { data: exclRows } = await supabaseAdmin
      .from("pre_registration_exclusions")
      .select("name_normalized, email");
    const excludedNames = new Set((exclRows ?? []).map((r) => r.name_normalized));
    const excludedEmails = new Set((exclRows ?? []).map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));
    let excluded = 0;

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
      const isExcluded =
        (nameKey && excludedNames.has(nameKey)) ||
        (!!row.email && excludedEmails.has(row.email.toLowerCase().trim()));
      if (isExcluded) {
        if (!data.manual) { excluded++; continue; }
        await supabaseAdmin.from("pre_registration_exclusions").delete().eq("name_normalized", nameKey);
        if (row.email) await supabaseAdmin.from("pre_registration_exclusions").delete().ilike("email", row.email.trim());
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
        birth_date: string | null;
        admission_date: string | null;
      };
      let existing: ExistingRow | null = null;

      if (row.email) {
        const { data: ex } = await supabaseAdmin
          .from("pre_registrations")
          .select("id, full_name, email, cargo, setor, perfil, negocio, claimed_by, birth_date, admission_date")
          .ilike("email", row.email)
          .maybeSingle();
        existing = (ex as ExistingRow | null) ?? null;
      }
      if (!existing && nameKey) {
        // prefer claimed > oldest
        const { data: candidates } = await supabaseAdmin
          .from("pre_registrations")
          .select("id, full_name, email, cargo, setor, perfil, negocio, claimed_by, birth_date, admission_date, created_at")
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
          // Datas: planilha sem a coluna não apaga o que já estava salvo.
          birth_date: row.birth_date ?? existing.birth_date,
          admission_date: row.admission_date ?? existing.admission_date,
        };
        const changed =
          next.full_name !== existing.full_name ||
          (next.email ?? null) !== (existing.email ?? null) ||
          (next.cargo ?? null) !== (existing.cargo ?? null) ||
          (next.setor ?? null) !== (existing.setor ?? null) ||
          next.perfil !== existing.perfil ||
          next.negocio !== existing.negocio ||
          next.birth_date !== existing.birth_date ||
          next.admission_date !== existing.admission_date;

        if (!changed) { unchanged++; continue; }

        const { error } = await (supabaseAdmin.from("pre_registrations") as any)
          .update(next).eq("id", existing.id);
        if (error) throw new Error(error.message);
        if (isClaimed) await syncProfileDates(existing.claimed_by!, next.birth_date, next.admission_date);
        updated++;
      } else {
        const { error } = await supabaseAdmin.from("pre_registrations").insert({
          full_name: row.full_name,
          email: row.email || null,
          cargo: row.cargo || null,
          setor: row.setor || null,
          perfil: row.perfil,
          negocio: row.negocio,
          birth_date: row.birth_date ?? null,
          admission_date: row.admission_date ?? null,
        });
        if (error) {
          // Race against unique indexes → treat as duplicate, skip instead of failing the batch
          if (/duplicate key|unique/i.test(error.message)) { skipped++; continue; }
          throw new Error(error.message);
        }
        inserted++;
      }
    }
    return { inserted, updated, unchanged, skipped, excluded, total: data.rows.length };
  });


// Quem já criou conta: as datas valem no perfil (aniversário e tempo de
// empresa leem de lá), então mudança no pré-cadastro desce pro perfil.
async function syncProfileDates(userId: string, birth: string | null, admission: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patch: Record<string, string> = {};
  if (birth) patch.birth_date = birth;
  if (admission) patch.admission_date = admission;
  if (!Object.keys(patch).length) return;
  const { error } = await (supabaseAdmin.from("profiles") as any).update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

export const updatePreRegistrationDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        birth_date: isoDate.nullable(),
        admission_date: isoDate.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pre, error } = await supabaseAdmin
      .from("pre_registrations")
      .update({ birth_date: data.birth_date, admission_date: data.admission_date })
      .eq("id", data.id)
      .select("claimed_by")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pre) throw new Error("Pré-cadastro não encontrado.");
    if (pre.claimed_by) await syncProfileDates(pre.claimed_by, data.birth_date, data.admission_date);
    return { ok: true, synced: !!pre.claimed_by };
  });

export const listPreRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pre_registrations")
      .select("id, full_name, email, cargo, setor, perfil, negocio, claimed_by, claimed_at, created_at, birth_date, admission_date")
      .order("negocio")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Admin: cria a conta manualmente (email + senha escolhidos pelo admin) já
// linkada a um pré-cadastro específico. Usa o mesmo mecanismo do cadastro
// normal (trigger handle_new_user casa por nome normalizado e reivindica o
// pré-cadastro), só que o admin escolhe explicitamente qual linha linkar em
// vez de depender do que a pessoa digitar.
export const createAccountForPreRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      pre_registration_id: z.string().uuid(),
      email: z.string().trim().toLowerCase().email("Email inválido").max(255),
      password: z.string().min(6, "Senha precisa ter 6+ caracteres").max(72),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pre, error: preErr } = await supabaseAdmin
      .from("pre_registrations")
      .select("id, full_name, cargo, negocio, claimed_by")
      .eq("id", data.pre_registration_id)
      .maybeSingle();
    if (preErr) throw new Error(preErr.message);
    if (!pre) throw new Error("Pré-cadastro não encontrado.");
    if (pre.claimed_by) throw new Error("Esse pré-cadastro já tem conta.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: pre.full_name },
      app_metadata: { pre_registration_id: pre.id },
    });
    if (error || !created.user) {
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Este email já está cadastrado.");
      }
      throw new Error(error?.message || "Falha ao criar conta");
    }

    // Vínculo feito pelo servidor com o pré-cadastro escolhido pelo admin
    // (o trigger não confia mais em nome/atração vindos do metadata).
    const { applyPreRegistration } = await import("@/lib/pre-registration.server");
    await applyPreRegistration(created.user.id, pre.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("hero_id")
      .eq("id", created.user.id)
      .maybeSingle();

    return { hero_id: (profile?.hero_id as string | undefined) ?? null, full_name: pre.full_name };
  });

export const deletePreRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pre } = await supabaseAdmin
      .from("pre_registrations")
      .select("full_name, name_normalized, email")
      .eq("id", data.id)
      .maybeSingle();
    // Guarda na lista de excluídos antes de apagar, pra planilha não trazer de volta.
    let remembered = false;
    if (pre?.name_normalized) {
      const { error: exErr } = await supabaseAdmin.from("pre_registration_exclusions").upsert({
        name_normalized: pre.name_normalized,
        full_name: pre.full_name,
        email: pre.email ? pre.email.toLowerCase() : null,
        excluded_by: context.userId,
        excluded_at: new Date().toISOString(),
      });
      remembered = !exErr;
    }
    const { error } = await supabaseAdmin.from("pre_registrations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, remembered };
  });

export const listPreRegistrationExclusions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pre_registration_exclusions")
      .select("name_normalized, full_name, email, excluded_at")
      .order("excluded_at", { ascending: false });
    if (error) return { rows: [], setupMissing: true as const };
    return { rows: data ?? [], setupMissing: false as const };
  });

export const restorePreRegistrationExclusion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name_normalized: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pre_registration_exclusions")
      .delete()
      .eq("name_normalized", data.name_normalized);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: called from /cadastro before account creation
export const lookupPreRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email().optional(),
      full_name: z.string().trim().min(2).max(120).optional(),
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
      q: z.string().trim().min(3).max(120),
      limit: z.number().int().min(1).max(5).optional(),
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

