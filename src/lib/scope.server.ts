// Server-only. Regra única de "quem esta pessoa vê" para as telas de
// liderança: a mesma função do banco que a RLS usa (can_view_user_data via
// visible_user_ids). Líder com lista em leader_access (planilha oficial) vê
// exatamente a lista; Trupe/Hector Studios seguem a regra de hierarquia/casa;
// admin vê todos. Não recalcular escopo à mão nas server functions.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function visibleUserIds(viewerId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.rpc("visible_user_ids", { _viewer_id: viewerId });
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as unknown as string[]).map(String));
}
