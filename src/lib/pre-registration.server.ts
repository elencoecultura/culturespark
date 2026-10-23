// Server-only: vincula uma conta recém-criada ao pré-cadastro escolhido pelo
// servidor. Antes isso dependia só do trigger handle_new_user, que casava por
// nome/e-mail vindos do cliente; agora quem decide o pré-cadastro é sempre o
// código do servidor, e o trigger só reconhece o id passado em app_metadata.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { isPrivilegedPerfil } from "@/lib/security-rules";

export async function applyPreRegistration(userId: string, preId: string) {
  const { data: pre, error } = await supabaseAdmin
    .from("pre_registrations")
    .select("id, cargo, setor, perfil, negocio, claimed_by")
    .eq("id", preId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pre) throw new Error("Pré-cadastro não encontrado.");
  if (pre.claimed_by && pre.claimed_by !== userId)
    throw new Error("Esse pré-cadastro já foi usado.");

  const { data: role, error: roleErr } = await supabaseAdmin.rpc("map_perfil_to_role", {
    _perfil: pre.perfil,
  });
  if (roleErr || !role) throw new Error(roleErr?.message ?? "Falha ao definir o papel.");

  const { error: pErr } = await supabaseAdmin
    .from("profiles")
    .update({
      attraction: pre.negocio,
      negocio: pre.negocio,
      setor: pre.setor,
      role_title: pre.cargo,
    })
    .eq("id", userId);
  if (pErr) throw new Error(pErr.message);

  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
  if (rErr) throw new Error(rErr.message);

  const { error: cErr } = await supabaseAdmin
    .from("pre_registrations")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("id", pre.id);
  if (cErr) throw new Error(cErr.message);
}
