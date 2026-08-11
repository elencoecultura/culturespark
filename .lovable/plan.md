## Verificação do questionário de avaliação vs. planilha de referência

Conferi a planilha `Avaliação_de_Desempenho_Mensal_-_Lider_preenche.xlsx` contra o que está hoje no banco (`evaluation_pillars`, `evaluation_competencies`, `evaluation_scale`). A **estrutura está 100% fiel**:

- 4 pilares na ordem certa: SEGURANÇA → ALEGRIA → IMERSÃO → EFICIÊNCIA
- Taglines dos pilares batem
- 20 competências no total, distribuídas exatamente como a planilha: 5 / 6 / 4 / 5
- Nomes das competências e ordem batem
- Escala 1–5 com labels e descrições idênticas ("A magia não acontece" → "de forma extraordinária")
- Nota esperada = 4 em todas

**Porém encontrei pequenos desvios cosméticos** que preciso corrigir para ficar *exatamente* igual à planilha:

### Diferenças a corrigir

1. **Capitalização de 2 competências (ALEGRIA):**
   - "Empatia e acolhimento" → **"Empatia e Acolhimento"**
   - "Criar memórias mágicas" → **"Criar Memórias Mágicas"**

2. **Descrições paráfraseadas voltar ao texto original da planilha**, por exemplo:
   - Disciplina e cumprimento de padrões: hoje "Respeito às normas…" → deve ser "**Refere-se ao respeito às normas, processos, combinados e padrões operacionais da Hector Studios.**"
   - Segurança do convidado: reincluir o parágrafo completo ("Inclui atenção aos ambientes, alimentos, fluxos, interações, comunicação e qualquer situação que possa gerar risco, desconforto ou quebra de confiança.")
   - Sorrir: "Habilidade de sorrir e criar sorrisos que permanecem por muito tempo depois do momento vivido" (texto original diz "clientes", planilha usa "momento vivido" – mantenho o da planilha)
   - Demais 17 competências: reescrever descrição literal conforme a coluna "Competências Avaliadas" da planilha (várias tinham vírgulas e palavras cortadas).

### Como aplico

Uma única migration `UPDATE public.evaluation_competencies SET name = …, description = … WHERE sort_order = … AND pillar_id = (select id from evaluation_pillars where slug=…)` cobrindo as 20 linhas, sem alterar IDs, ordem, pilares, escala ou notas esperadas. Nada muda no schema — apenas o texto exibido no questionário.

Depois disso o questionário renderizado no app fica caractere-a-caractere idêntico ao documento de referência.

Aprova pra eu aplicar?