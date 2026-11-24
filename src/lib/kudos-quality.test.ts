import { describe, expect, test } from "bun:test";
import { assessKudosText, evaluateKudos, kudosSimilarity, tokenize } from "./kudos-quality";

const reason = (text: string, previous: string[] = []) => {
  const v = evaluateKudos(text, previous);
  return v.ok ? "ok" : v.reason;
};

describe("qualidade do elogio", () => {
  test("aceita os exemplos da especificação", () => {
    expect(reason("Quero reconhecer sua dedicação ao ajudar nossa equipe durante o movimento de ontem.")).toBe("ok");
    expect(reason("Sua atenção aos detalhes fez toda a diferença na experiência dos nossos convidados.")).toBe("ok");
    expect(reason("Admiro sua iniciativa em ajudar um colega mesmo com tantas demandas.")).toBe("ok");
  });

  test("recusa os exemplos da especificação", () => {
    expect(reason("Parabéns parabéns parabéns parabéns parabéns.")).not.toBe("ok");
    expect(reason("Você é incrível incrível incrível incrível.")).toBe("repeated_words");
    expect(reason("Obrigado pelo trabalho obrigado pelo trabalho.")).toBe("repeated_words");
  });

  test("exige 6 palavras (emoji não conta)", () => {
    expect(reason("Bom trabalho 👏🏻👏🏻👏🏻")).toBe("too_short");
    expect(reason("Você é incrível 🤍✨")).toBe("too_short");
  });

  test("recusa letras aleatórias e palavras soltas", () => {
    expect(reason("asdf qwer zxcv kkkkk hjkl pqrs")).toBe("gibberish");
    expect(reason("cadeira azul feliz rapido mesa sol")).toBe("gibberish");
  });

  test("recusa elogio genérico sem contexto", () => {
    expect(reason("Que você tenha um ótimo dia de trabalho")).toBe("no_context");
    expect(reason("Parabéns pelo seu trabalho, você é muito incrível mesmo")).toBe("no_context");
  });

  test("aceita linguagem informal do dia a dia", () => {
    expect(reason("Valeu demais por segurar o caixa pra mim ontem, salvou meu turno tmj")).toBe("ok");
  });

  test("recusa elogio repetido, mesmo com pequenas trocas", () => {
    const anterior = ["Obrigado por me ajudar a organizar o salão no movimento de sábado!"];
    expect(reason("Obrigado por me ajudar a organizar o salão no movimento de sábado!", anterior)).toBe("duplicate");
    expect(reason("Obrigada por me ajudar a organizar o salão no movimento do domingo 🙏", anterior)).toBe("duplicate");
    expect(reason("Obrigado por me ajudar a organizar o salão no movimento de sábado! Valeu", anterior)).toBe("duplicate");
  });

  test("elogio parecido mas com outro contexto passa", () => {
    const anterior = ["Obrigado por me ajudar a organizar o salão no movimento de sábado!"];
    expect(reason("Obrigado por cobrir meu horário na cozinha quando precisei sair mais cedo.", anterior)).toBe("ok");
  });

  test("aniversário não exige contexto", () => {
    const v = assessKudosText("Feliz aniversário! Que seu dia seja mágico e cheio de brilho. 🎉", { requireContext: false });
    expect(v.ok).toBe(true);
  });

  test("tokenize normaliza acento e letra esticada", () => {
    expect(tokenize("Trabalhooo ÓTIMO!")).toEqual(["trabalho", "otimo"]);
    expect(kudosSimilarity("a b c", "")).toBe(0);
  });
});
