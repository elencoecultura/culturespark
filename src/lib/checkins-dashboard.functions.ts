import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin.");
}

// Painel: quantos check-ins de energia cada casa (atração) teve por dia,
// nos últimos N dias — pra admin enxergar de longe onde o hábito diário
// está caindo, sem precisar abrir casa por casa.
export const getCheckinsByHouse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().int().min(1).max(60).default(14) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tz = "America/Sao_Paulo";
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

    // janela de dias (mais antigo -> mais recente), chave YYYY-MM-DD no fuso de SP
    const dayKeys: string[] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayKeys.push(fmt.format(d));
    }
    const sinceIso = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, attraction")
      .eq("active", true)
      .not("attraction", "is", null)
      .neq("attraction", "TODOS");
    const attractionById = new Map((profiles ?? []).map((p) => [p.id, p.attraction as string]));
    const headcount: Record<string, number> = {};
    (profiles ?? []).forEach((p) => {
      const a = p.attraction as string;
      headcount[a] = (headcount[a] ?? 0) + 1;
    });
    const houses = Object.keys(headcount).sort();

    const { data: checkins, error } = await supabaseAdmin
      .from("mood_checkins")
      .select("user_id, created_at")
      .gte("created_at", sinceIso);
    if (error) throw new Error(error.message);

    // matriz casa x dia = quantidade de check-ins (deduplicado por pessoa/dia,
    // já que a regra do app é 1 check-in por dia — isso é só uma proteção
    // extra contra dado duplicado antigo)
    const matrix: Record<string, Record<string, Set<string>>> = {};
    houses.forEach((h) => {
      matrix[h] = {};
      dayKeys.forEach((day) => (matrix[h][day] = new Set()));
    });

    (checkins ?? []).forEach((c) => {
      const house = attractionById.get(c.user_id as string);
      if (!house || !matrix[house]) return;
      const day = fmt.format(new Date(c.created_at as string));
      if (matrix[house][day]) matrix[house][day].add(c.user_id as string);
    });

    const rows = houses.map((house) => ({
      house,
      headcount: headcount[house],
      byDay: dayKeys.map((day) => matrix[house][day].size),
    }));

    return { days: dayKeys, rows };
  });
