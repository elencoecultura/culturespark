import { describe, expect, test } from "bun:test";
import { can, mainProfile } from "./permissions-catalog";

describe("permissões por perfil", () => {
  test("colaborador vê Celebração e não vê Liderados", () => {
    expect(can("module", "celebracao", ["elenco"])).toBe(true);
    expect(can("module", "team", ["elenco"])).toBe(false);
  });
  test("líder avalia e vê Liderança", () => {
    expect(can("action", "avaliar", ["lider"])).toBe(true);
    expect(can("module", "leader", ["lider"])).toBe(true);
  });
  test("bloqueio individual vence o padrão", () => {
    expect(can("action", "avaliar", ["lider"], { "action:avaliar": false })).toBe(false);
  });
  test("liberação individual vence o padrão", () => {
    expect(can("module", "team", ["elenco"], { "module:team": true })).toBe(true);
  });
  test("admin tem tudo, mesmo com bloqueio", () => {
    expect(can("action", "avaliar", ["admin"], { "action:avaliar": false })).toBe(true);
  });
  test("Relatórios não se libera por pessoa (só admin)", () => {
    expect(can("module", "relatorios", ["direcao"])).toBe(false);
    expect(can("module", "relatorios", ["direcao"], { "module:relatorios": true })).toBe(false);
    expect(can("module", "relatorios", ["admin"])).toBe(true);
  });
  test("perfil principal", () => {
    expect(mainProfile(["elenco", "lider"])).toBe("lider");
    expect(mainProfile(["leader"])).toBe("lider");
    expect(mainProfile([])).toBe("elenco");
  });
});
