import { describe, expect, test } from "bun:test";
import { companyAnniversaryThisWeek, weekRangeSP } from "./celebration-rules";

describe("Celebração da Magia", () => {
  const week = weekRangeSP(new Date("2026-11-04T15:00:00Z")); // quarta
  test("semana vai de segunda a domingo", () => {
    expect(week.days[0]).toBe("2026-11-02");
    expect(week.days[6]).toBe("2026-11-08");
    expect(week.today).toBe("2026-11-04");
  });
  test("3 anos de casa na semana", () => {
    const r = companyAnniversaryThisWeek("2023-11-06", week);
    expect(r?.years).toBe(3);
    expect(r?.date).toBe("2026-11-06");
    expect(r?.weekday).toBe("sexta");
    expect(r?.isToday).toBe(false);
  });
  test("é hoje", () => expect(companyAnniversaryThisWeek("2020-11-04", week)?.isToday).toBe(true));
  test("menos de 1 ano não entra", () =>
    expect(companyAnniversaryThisWeek("2026-11-03", week)).toBeNull());
  test("fora da semana não entra", () =>
    expect(companyAnniversaryThisWeek("2020-11-10", week)).toBeNull());
  test("sem data não entra", () => expect(companyAnniversaryThisWeek(null, week)).toBeNull());
  test("semana na virada do ano", () => {
    const w = weekRangeSP(new Date("2026-12-31T15:00:00Z"));
    expect(companyAnniversaryThisWeek("2024-01-02", w)?.years).toBe(3);
    expect(companyAnniversaryThisWeek("2024-12-28", w)?.years).toBe(2);
  });
  test("29/02 comemora em 28/02 em ano comum", () => {
    const w = weekRangeSP(new Date("2027-02-28T15:00:00Z"));
    expect(companyAnniversaryThisWeek("2024-02-29", w)?.date).toBe("2027-02-28");
  });
});
