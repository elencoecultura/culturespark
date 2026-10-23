// Testes de regressão das regras da auditoria de 23/10/2026. Rodar: bun test
import { describe, expect, test } from "bun:test";
import {
  isBirthdayNear,
  isOwnAttachmentPath,
  isPrivilegedPerfil,
  pickClientIp,
} from "./security-rules";
import { resolveDateBuckets } from "./date-buckets";

const UID = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("pickClientIp (trava de Wi-Fi)", () => {
  test("ignora cf-connecting-ip forjado quando a Vercel informa o IP real", () => {
    const h: Record<string, string> = {
      "cf-connecting-ip": "200.1.1.1",
      "x-vercel-forwarded-for": "189.5.5.5",
      "x-forwarded-for": "189.5.5.5",
    };
    expect(pickClientIp((n) => h[n])).toBe("189.5.5.5");
  });
  test("usa o primeiro IP da lista", () => {
    expect(pickClientIp((n) => (n === "x-forwarded-for" ? "10.0.0.1, 10.0.0.2" : undefined))).toBe(
      "10.0.0.1",
    );
  });
  test("cf-connecting-ip só quando não há header da Vercel", () => {
    expect(pickClientIp((n) => (n === "cf-connecting-ip" ? "1.2.3.4" : undefined))).toBe("1.2.3.4");
  });
  test("sem header nenhum devolve vazio (nunca casa com a allowlist)", () => {
    expect(pickClientIp(() => undefined)).toBe("");
  });
});

describe("isOwnAttachmentPath (atestados)", () => {
  test("aceita arquivo na pasta do dono", () =>
    expect(isOwnAttachmentPath(`${UID}/123-atestado.pdf`, UID)).toBe(true));
  test("recusa pasta de outra pessoa", () =>
    expect(isOwnAttachmentPath(`${OTHER}/atestado.pdf`, UID)).toBe(false));
  test("recusa path traversal", () =>
    expect(isOwnAttachmentPath(`${UID}/../${OTHER}/a.pdf`, UID)).toBe(false));
  test("recusa barra dupla e prefixo parecido", () => {
    expect(isOwnAttachmentPath(`${UID}//a.pdf`, UID)).toBe(false);
    expect(isOwnAttachmentPath(`${UID}x/a.pdf`, UID)).toBe(false);
  });
});

describe("isPrivilegedPerfil (cadastro público)", () => {
  test.each(["GERENTE", "gerente", " Líder ", "LIDER", "DIREÇÃO", "DIRECAO", "ADMIN"])(
    "%s é liderança",
    (p) => expect(isPrivilegedPerfil(p)).toBe(true),
  );
  test.each(["ELENCO", "", null, undefined, "Mensageiro"])("%s não é liderança", (p) =>
    expect(isPrivilegedPerfil(p as any)).toBe(false),
  );
});

describe("isBirthdayNear (elogio de aniversário)", () => {
  const now = new Date("2026-10-23T15:00:00Z");
  test("dia do aniversário", () => expect(isBirthdayNear("1990-10-23", now)).toBe(true));
  test("semana do aniversário", () => {
    expect(isBirthdayNear("1990-10-17", now)).toBe(true);
    expect(isBirthdayNear("1990-10-30", now)).toBe(true);
  });
  test("fora da semana", () => expect(isBirthdayNear("1990-11-05", now)).toBe(false));
  test("virada de ano", () =>
    expect(isBirthdayNear("1990-01-02", new Date("2026-12-29T15:00:00Z"))).toBe(true));
  test("sem data", () => {
    expect(isBirthdayNear(null, now)).toBe(false);
    expect(isBirthdayNear("lixo", now)).toBe(false);
  });
});

describe("resolveDateBuckets (DoS por intervalo enorme)", () => {
  test("intervalo de séculos é cortado em ~13 meses", () => {
    const r = resolveDateBuckets({ from: "0100-01-01", to: "2026-10-23" } as any);
    expect(r.dayKeys.length).toBeLessThanOrEqual(401);
  });
  test("intervalo normal não muda", () => {
    const r = resolveDateBuckets({ from: "2026-10-01", to: "2026-10-10" } as any);
    expect(r.dayKeys.length).toBe(10);
  });
});
