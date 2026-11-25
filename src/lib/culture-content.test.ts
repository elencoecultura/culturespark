import { describe, expect, test } from "bun:test";
import { LOW_ENERGY_SUGGESTIONS, PILLARS, pickLowEnergySuggestions } from "./culture-content";

describe("sugestões de energia baixa", () => {
  test("toda sugestão está ligada a um pilar oficial do Espírito Mágico", () => {
    const oficiais = new Set(PILLARS.map((p) => p.key));
    for (const s of LOW_ENERGY_SUGGESTIONS) expect(oficiais.has(s.pillar)).toBe(true);
  });

  test("mostra 4 sugestões diferentes, iguais no mesmo dia", () => {
    const a = pickLowEnergySuggestions("2026-11-25");
    expect(a).toHaveLength(4);
    expect(new Set(a.map((s) => s.text)).size).toBe(4);
    expect(pickLowEnergySuggestions("2026-11-25")).toEqual(a);
    expect(pickLowEnergySuggestions("2026-11-25", 1)).not.toEqual(a);
  });
});
