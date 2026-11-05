import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTIONS,
  EMPRESAS,
  MODULES,
  PROFILES,
  mainProfile,
  normalizeRoles,
} from "@/lib/permissions-catalog";

// Permissões de Usuários: somente Administrador.

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores");
}

const PROFILE_KEYS = PROFILES.map((p) => p.key) as [string, ...string[]];
const EMPRESA_KEYS = EMPRESAS.map((e) => e.key) as [string, ...string[]];
const OVERRIDE_KEYS = new Set([
  ...MODULES.map((m) => `module:${m.key}`),
  ...ACTIONS.map((a) => `action:${a.key}`),
]);

const configSchema = z.object({
  user_id: z.string().uuid(),
  profile: z.enum(PROFILE_KEYS),
  scopes: z
    .array(z.object({ empresa: z.enum(EMPRESA_KEYS), setor: z.string().max(60).default("") }))
    .max(40),
  people: z.array(z.string().uuid()).max(500),
  overrides: z.record(z.string(), z.boolean()),
  wifi_bypass: z.boolean(),
});
type Config = z.infer<typeof configSchema>;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// Busca de usuários (nome, casa, perfil).
export const searchUsersForPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(80).default("") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    let q = sb
      .from("profiles")
      .select("id, full_name, attraction, setor, role_title, active")
      .order("full_name")
      .limit(60);
    if (data.q) q = q.ilike("full_name", `%${data.q.replace(/[\\%_]/g, "\\$&")}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const { data: roles } = ids.length
      ? await sb.from("user_roles").select("user_id, role").in("user_id", ids)
      : { data: [] as any[] };
    return (rows ?? []).map((r) => ({
      ...r,
      profile: mainProfile(
        (roles ?? []).filter((x: any) => x.user_id === r.id).map((x: any) => x.role),
      ),
    }));
  });

// Configuração atual de uma pessoa.
export const getUserPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const [prof, roles, scopes, people, defaults, ov, sectors] = await Promise.all([
      sb
        .from("profiles")
        .select("id, full_name, attraction, setor, role_title, wifi_bypass, active")
        .eq("id", data.user_id)
        .single(),
      sb.from("user_roles").select("role").eq("user_id", data.user_id),
      sb.from("access_scopes").select("empresa, setor").eq("user_id", data.user_id),
      sb.from("leader_access").select("member_id, motivo, source").eq("leader_id", data.user_id),
      sb.from("leader_access_default").select("member_id").eq("leader_id", data.user_id),
      sb.from("user_permission_overrides").select("key, allowed").eq("user_id", data.user_id),
      sb.from("profiles").select("attraction, setor").eq("active", true),
    ]);
    if (prof.error) throw new Error(prof.error.message);
    const memberIds = Array.from(
      new Set([
        ...(people.data ?? []).map((p) => p.member_id),
        ...(defaults.data ?? []).map((p) => p.member_id),
      ]),
    );
    const { data: names } = memberIds.length
      ? await sb.from("profiles").select("id, full_name, attraction").in("id", memberIds)
      : { data: [] as any[] };
    const byId = new Map((names ?? []).map((n: any) => [n.id, n]));
    const sectorsByEmpresa: Record<string, string[]> = {};
    for (const s of sectors.data ?? []) {
      if (!s.attraction || !s.setor) continue;
      (sectorsByEmpresa[s.attraction] ??= []).includes(s.setor) ||
        sectorsByEmpresa[s.attraction].push(s.setor);
    }
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const overrides: Record<string, boolean> = {};
    for (const o of ov.data ?? []) overrides[o.key] = o.allowed;
    return {
      user: prof.data,
      roles: roleList,
      profile: mainProfile(roleList),
      scopes: (scopes.data ?? []).map((s) => ({ empresa: s.empresa, setor: s.setor ?? "" })),
      people: (people.data ?? []).map((p) => ({
        id: p.member_id,
        motivo: p.motivo,
        source: p.source,
        ...(byId.get(p.member_id) ?? {}),
      })),
      defaultPeople: (defaults.data ?? []).map((p) => p.member_id),
      overrides,
      sectorsByEmpresa,
      wifiAuto:
        normalizeRoles(roleList).has("admin") ||
        ["direcao", "gerente", "lider"].some((r) => normalizeRoles(roleList).has(r as any)) ||
        prof.data.attraction === "TRUPE",
    };
  });

// Quem a pessoa veria com a configuração proposta (antes de salvar).
async function computeVisible(cfg: Pick<Config, "user_id" | "profile" | "scopes" | "people">) {
  const sb = await admin();
  const { data: all } = await sb
    .from("profiles")
    .select("id, full_name, attraction, setor, manager_id, co_leader_id, active")
    .eq("active", true);
  const others = (all ?? []).filter((p) => p.id !== cfg.user_id);
  if (cfg.profile === "admin") return others;
  if (cfg.people.length || cfg.scopes.length) {
    const people = new Set(cfg.people);
    return others.filter(
      (t) =>
        people.has(t.id) ||
        cfg.scopes.some(
          (s) =>
            s.empresa === "TODAS" ||
            (t.attraction === s.empresa && (!s.setor || t.setor === s.setor)),
        ),
    );
  }
  // Sem lista nem empresa: regra de hierarquia/casa (igual ao banco)
  const me = (all ?? []).find((p) => p.id === cfg.user_id);
  const manager = ["gerente", "direcao"].includes(cfg.profile);
  const leader = ["lider", "gerente", "direcao"].includes(cfg.profile);
  return others.filter(
    (t) =>
      (manager && (me?.attraction === "TODOS" || me?.attraction === t.attraction)) ||
      (leader && (t.manager_id === cfg.user_id || t.co_leader_id === cfg.user_id)),
  );
}

export const previewUserVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    configSchema.pick({ user_id: true, profile: true, scopes: true, people: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const rows = await computeVisible(data);
    return {
      total: rows.length,
      people: rows.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        attraction: r.attraction,
        setor: r.setor,
      })),
    };
  });

async function audit(target: string, by: string, field: string, before: unknown, after: unknown) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const sb = await admin();
  await sb
    .from("permission_audit")
    .insert({
      target_user: target,
      changed_by: by,
      field,
      before: before as any,
      after: after as any,
    });
}

export const saveUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => configSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    for (const k of Object.keys(data.overrides))
      if (!OVERRIDE_KEYS.has(k)) throw new Error(`Permissão desconhecida: ${k}`);

    const [{ data: roles }, { data: prof }, { data: scopes }, { data: people }, { data: ov }] =
      await Promise.all([
        sb.from("user_roles").select("role").eq("user_id", data.user_id),
        sb.from("profiles").select("wifi_bypass").eq("id", data.user_id).single(),
        sb.from("access_scopes").select("empresa, setor").eq("user_id", data.user_id),
        sb.from("leader_access").select("member_id").eq("leader_id", data.user_id),
        sb.from("user_permission_overrides").select("key, allowed").eq("user_id", data.user_id),
      ]);
    const beforeProfile = mainProfile((roles ?? []).map((r) => r.role as string));

    // Perfil: não deixa tirar o próprio admin nem o último admin.
    if (beforeProfile !== data.profile) {
      if (beforeProfile === "admin") {
        if (data.user_id === context.userId)
          throw new Error("Você não pode tirar o seu próprio perfil de Administrador.");
        const { count } = await sb
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) <= 1) throw new Error("Este é o último Administrador.");
      }
      await sb.from("user_roles").delete().eq("user_id", data.user_id);
      const { error } = await sb
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.profile as any });
      if (error) throw new Error(error.message);
      await audit(data.user_id, context.userId, "perfil", beforeProfile, data.profile);
    }

    const normScopes = Array.from(
      new Map(data.scopes.map((s) => [`${s.empresa}|${s.setor}`, s])).values(),
    );
    const beforeScopes = (scopes ?? []).map((s) => `${s.empresa}|${s.setor}`).sort();
    const afterScopes = normScopes.map((s) => `${s.empresa}|${s.setor}`).sort();
    if (JSON.stringify(beforeScopes) !== JSON.stringify(afterScopes)) {
      await sb.from("access_scopes").delete().eq("user_id", data.user_id);
      if (normScopes.length)
        await sb
          .from("access_scopes")
          .insert(
            normScopes.map((s) => ({
              user_id: data.user_id,
              empresa: s.empresa,
              setor: s.setor,
              created_by: context.userId,
            })),
          );
      await audit(data.user_id, context.userId, "empresas e setores", beforeScopes, afterScopes);
    }

    const beforePeople = new Set((people ?? []).map((p) => p.member_id));
    const afterPeople = new Set(data.people.filter((id) => id !== data.user_id));
    const removed = [...beforePeople].filter((id) => !afterPeople.has(id));
    const added = [...afterPeople].filter((id) => !beforePeople.has(id));
    if (removed.length)
      await sb
        .from("leader_access")
        .delete()
        .eq("leader_id", data.user_id)
        .in("member_id", removed);
    if (added.length)
      await sb
        .from("leader_access")
        .insert(
          added.map((id) => ({
            leader_id: data.user_id,
            member_id: id,
            motivo: "Ajuste manual",
            source: "manual",
            created_by: context.userId,
          })),
        );
    if (removed.length || added.length)
      await audit(
        data.user_id,
        context.userId,
        "pessoas",
        { removidas: removed },
        { adicionadas: added },
      );

    const beforeOv: Record<string, boolean> = {};
    for (const o of ov ?? []) beforeOv[o.key] = o.allowed;
    if (
      JSON.stringify(Object.entries(beforeOv).sort()) !==
      JSON.stringify(Object.entries(data.overrides).sort())
    ) {
      await sb.from("user_permission_overrides").delete().eq("user_id", data.user_id);
      const rows = Object.entries(data.overrides).map(([key, allowed]) => ({
        user_id: data.user_id,
        key,
        allowed,
        updated_by: context.userId,
      }));
      if (rows.length) await sb.from("user_permission_overrides").insert(rows);
      await audit(data.user_id, context.userId, "módulos e ações", beforeOv, data.overrides);
    }

    if (!!prof?.wifi_bypass !== data.wifi_bypass) {
      await sb.from("profiles").update({ wifi_bypass: data.wifi_bypass }).eq("id", data.user_id);
      await audit(
        data.user_id,
        context.userId,
        "liberação de rede (manual)",
        !!prof?.wifi_bypass,
        data.wifi_bypass,
      );
    }
    return { ok: true };
  });

// Restaurar padrão: pessoas da planilha base, sem empresa/setor avulso e sem
// liberação/bloqueio individual. O perfil não muda.
export const restoreDefaultPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const [{ data: people }, { data: defaults }, { data: scopes }, { data: ov }] =
      await Promise.all([
        sb.from("leader_access").select("member_id").eq("leader_id", data.user_id),
        sb.from("leader_access_default").select("member_id, motivo").eq("leader_id", data.user_id),
        sb.from("access_scopes").select("empresa, setor").eq("user_id", data.user_id),
        sb.from("user_permission_overrides").select("key, allowed").eq("user_id", data.user_id),
      ]);
    await sb.from("leader_access").delete().eq("leader_id", data.user_id);
    if (defaults?.length)
      await sb
        .from("leader_access")
        .insert(
          defaults.map((d) => ({
            leader_id: data.user_id,
            member_id: d.member_id,
            motivo: d.motivo,
            source: "planilha",
          })),
        );
    await sb.from("access_scopes").delete().eq("user_id", data.user_id);
    await sb.from("user_permission_overrides").delete().eq("user_id", data.user_id);
    await audit(
      data.user_id,
      context.userId,
      "restaurar padrão",
      { pessoas: (people ?? []).length, empresas: scopes ?? [], liberacoes: ov ?? [] },
      { pessoas: (defaults ?? []).length, empresas: [], liberacoes: [] },
    );
    return { ok: true };
  });

export const listPermissionAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("permission_audit")
      .select("id, changed_by, field, before, after, created_at")
      .eq("target_user", data.user_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = Array.from(
      new Set((rows ?? []).map((r) => r.changed_by).filter(Boolean)),
    ) as string[];
    const { data: names } = ids.length
      ? await sb.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((names ?? []).map((n: any) => [n.id, n.full_name]));
    return (rows ?? []).map((r) => ({ ...r, changed_by_name: byId.get(r.changed_by) ?? "—" }));
  });

// Registro de acesso (relatório de engajamento). Fogo-e-esquece no cliente.
export const trackModuleAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        module: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9_-]+$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { trackAccess } = await import("@/lib/permissions.server");
    await trackAccess(context.userId, data.module);
    return { ok: true };
  });
