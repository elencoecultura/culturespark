import { describe, expect, test } from "bun:test";
import { distanceMeters, evaluateGeo, parseCoordinates } from "./security-rules";

// Pontos de referência em Gramado (aprox.)
const UNIT = { name: "Unidade", lat: -29.3786, lng: -50.8739, radius_m: 200 };
// ~111 m por 0,001° de latitude
const north = (m: number) => ({ lat: UNIT.lat + m / 111_195, lng: UNIT.lng });

describe("distanceMeters", () => {
  test("0,001° de latitude ≈ 111 m", () => {
    expect(Math.round(distanceMeters(UNIT, north(111)))).toBe(111);
  });
});

describe("evaluateGeo (presença na unidade)", () => {
  test("dentro do raio passa", () => {
    expect(evaluateGeo({ ...north(150), accuracy: 10 }, [UNIT]).inside).toBe(true);
  });
  test("fora do raio, mas dentro da folga da precisão, passa", () => {
    expect(evaluateGeo({ ...north(280), accuracy: 100 }, [UNIT]).inside).toBe(true);
  });
  test("folga da precisão tem teto (localização ruim não abre a porta)", () => {
    const v = evaluateGeo({ ...north(600), accuracy: 2000 }, [UNIT]);
    expect(v.inside).toBe(false);
    expect(v.imprecise).toBe(true);
  });
  test("longe e preciso: bloqueia e informa a unidade mais próxima", () => {
    const v = evaluateGeo({ ...north(5000), accuracy: 15 }, [UNIT]);
    expect(v.inside).toBe(false);
    expect(v.imprecise).toBe(false);
    expect(v.nearest?.name).toBe("Unidade");
    expect(v.nearest?.distance).toBeGreaterThan(4900);
  });
  test("sem unidades cadastradas nunca libera", () => {
    expect(evaluateGeo({ ...north(0), accuracy: 5 }, []).inside).toBe(false);
  });
  test("escolhe a unidade em que a pessoa está, não a primeira da lista", () => {
    const far = { name: "Longe", lat: UNIT.lat + 1, lng: UNIT.lng, radius_m: 200 };
    const v = evaluateGeo({ ...north(50), accuracy: 10 }, [far, UNIT]);
    expect(v.inside).toBe(true);
    expect(v.nearest?.name).toBe("Unidade");
  });
});

describe("parseCoordinates (cadastro de unidade)", () => {
  test("par simples", () => {
    expect(parseCoordinates("-29.3786, -50.8739")).toEqual({ lat: -29.3786, lng: -50.8739 });
  });
  test("link do Google Maps", () => {
    expect(parseCoordinates("https://www.google.com/maps/@-29.3786,-50.8739,17z")).toEqual({ lat: -29.3786, lng: -50.8739 });
  });
  test("lixo devolve null", () => {
    expect(parseCoordinates("Rua Coberta, Gramado")).toBeNull();
  });
});
