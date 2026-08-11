import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const pad = (n: number) => String(n).padStart(2, "0");

// Lista quem faz aniversário na semana atual (seg → dom), no fuso America/Sao_Paulo.
// Compara apenas dia/mês, então o ano de nascimento pode ser aproximado.
export const listWeekBirthdays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    type Prof = {
      id: string;
      full_name: string;
      attraction: string | null;
      negocio: string | null;
      birth_date: string;
    };
    // birth_date foi adicionada por migration nova; os tipos gerados ainda não a conhecem, então tipamos manualmente.
    const res = (await context.supabase
      .from("profiles")
      .select("id, full_name, attraction, negocio, birth_date")
      .eq("active", true)
      .not("birth_date", "is", null)) as unknown as {
      data: Prof[] | null;
      error: { message: string } | null;
    };
    if (res.error) throw new Error(res.error.message);
    const profs = res.data ?? [];

    const tz = "America/Sao_Paulo";
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = fmt.format(new Date()); // YYYY-MM-DD no fuso SP
    const today = new Date(todayStr + "T00:00:00");
    const dow = (today.getDay() + 6) % 7; // 0 = segunda
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);

    // 7 dias da semana, indexados por "MM-DD"
    const dayByMd = new Map<string, Date>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dayByMd.set(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, d);
    }
    const todayMd = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const rows = (profs ?? [])
      .map(
        (p: {
          id: string;
          full_name: string;
          attraction: string | null;
          negocio: string | null;
          birth_date: string;
        }) => {
          const [by, bm, bd] = String(p.birth_date).split("-");
          const md = `${bm}-${bd}`;
          const day = dayByMd.get(md);
          if (!day) return null;
          const year = Number(by);
          const turns = year > 1901 ? day.getFullYear() - year : null;
          return {
            id: p.id,
            full_name: p.full_name,
            attraction: p.attraction,
            negocio: p.negocio,
            month_day: md,
            is_today: md === todayMd,
            weekday: WEEKDAYS[day.getDay()],
            turns,
          };
        },
      )
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.month_day.localeCompare(b.month_day));

    return { rows, todayMd, week_start: fmt.format(weekStart) };
  });
