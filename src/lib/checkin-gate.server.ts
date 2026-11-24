// Check-in obrigatório: nenhuma ação de participação (elogio, curtida,
// pesquisa, felicitação, Momento Iluminari, teste DISC) passa sem o check-in
// do dia. A checagem é no servidor, então não dá pra contornar pela tela ou
// chamando a API direto. Fuso America/Sao_Paulo, o mesmo do check-in.
//
// A checagem só LÊ mood_checkins; nada da ação fica ligado ao check-in. Numa
// pesquisa anônima, isso mantém a resposta sem vínculo com quem respondeu.

import { CHECKIN_REQUIRED_MESSAGE, saoPauloDayKey } from "@/lib/checkin-rules";

/** Início do dia de hoje em São Paulo (UTC-3, sem horário de verão desde 2019). */
export function startOfTodaySaoPaulo(now = new Date()): string {
  return new Date(`${saoPauloDayKey(now)}T00:00:00-03:00`).toISOString();
}

export async function hasCheckedInToday(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("mood_checkins")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", startOfTodaySaoPaulo())
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function assertCheckedInToday(userId: string): Promise<void> {
  if (!(await hasCheckedInToday(userId))) throw new Error(CHECKIN_REQUIRED_MESSAGE);
}
