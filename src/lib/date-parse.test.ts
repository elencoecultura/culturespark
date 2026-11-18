import { describe, expect, test } from "bun:test";
import { toIsoDate } from "./date-parse";

describe("toIsoDate (datas da planilha de pré-cadastro)", () => {
  test("dd/mm/aaaa", () => expect(toIsoDate("19/11/2024")).toBe("2024-11-19"));
  test("d/m/aaaa", () => expect(toIsoDate("5/3/1999")).toBe("1999-03-05"));
  test("aaaa-mm-dd", () => expect(toIsoDate("2024-11-19")).toBe("2024-11-19"));
  test("número serial do Excel", () => expect(toIsoDate(45615)).toBe("2024-11-19"));
  test("Date do xlsx (meia-noite local)", () => expect(toIsoDate(new Date(2024, 10, 19))).toBe("2024-11-19"));
  test("vazio e lixo viram null", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("sem data")).toBeNull();
    expect(toIsoDate("31/13/2024")).toBeNull();
  });
});
