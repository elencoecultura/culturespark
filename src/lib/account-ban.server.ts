// Server-only. Desativar alguém (profiles.active=false) só filtrava listas:
// senha e sessão continuavam valendo. Agora bloqueia a conta no Auth (não
// renova token nem aceita login) e libera de novo ao reativar.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function syncAccountBan(userId: string, active: boolean) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (error) {
    throw new Error(
      `Perfil salvo, mas falhou ao ${active ? "liberar" : "bloquear"} o acesso: ${error.message}`,
    );
  }
}
