# Encantômetro — Guia de Finalização

Tudo o que falta para colocar o app no ar, mais um roteiro de teste. O código está **completo e com typecheck limpo**; os itens abaixo dependem de você (acesso ao Supabase/Lovable e login).

---

## 1. Aplicar as 3 migrations (obrigatório para as features novas)

As telas **Aniversários** e **Bússola das Essências** só funcionam depois destas migrations. Aplique **nesta ordem**, no editor SQL do Supabase (ou pelo fluxo de migrations do Lovable Cloud):

| Ordem | Arquivo | O que faz |
| --- | --- | --- |
| 1 | `supabase/migrations/20260721120000_add_birth_date.sql` | Adiciona a coluna `profiles.birth_date` |
| 2 | `supabase/migrations/20260721120500_seed_birthdays.sql` | Importa os ~86 aniversários do elenco (casa por nome, usa `unaccent`) |
| 3 | `supabase/migrations/20260721121000_behavioral_tests.sql` | Cria a tabela `behavioral_tests` (Bússola DISC) + RLS |

**Como aplicar (Supabase):** Dashboard → SQL Editor → cole o conteúdo de cada arquivo, execute na ordem. Todas são idempotentes (pode rodar de novo sem quebrar).

**Se aparecer erro em `unaccent`** (migration 2): rode antes `CREATE EXTENSION IF NOT EXISTS unaccent;` — já está no topo do arquivo, mas em alguns projetos precisa de permissão de owner.

**Equipe Studios** (apelidos, só dia/mês) ficou **comentada** no arquivo 2 — preencha manualmente depois, ou me peça pra ligar por nome completo real.

> Depois de aplicar, regenere os tipos do Supabase (`supabase gen types` ou o botão do Lovable) para tirar os `as unknown as` temporários dos server functions novos — opcional, o app roda sem isso.

---

## 2. Rodar localmente

```bash
cd ~/Desktop/Claude/culture-spark
~/.bun/bin/bun install   # só na primeira vez / pasta nova
~/.bun/bin/bun run dev
```
Abre em **http://localhost:8080**.

---

## 3. Publicar no Lovable

- [ ] Suba a pasta / conecte o repo no Lovable.
- [ ] Confirme que as **variáveis do Supabase** estão configuradas no Lovable Cloud (o `.env` local **não** deve ir pro repositório público — confira o `.gitignore`).
- [ ] Aplique as 3 migrations (seção 1).
- [ ] Configure a `SUPABASE_SERVICE_ROLE_KEY` no Cloud (faltava no `.env` local; sem ela, funções admin de servidor falham).
- [ ] Publique e teste o link `.lovable.app` com um usuário real.

---

## 4. Roteiro de teste ponta-a-ponta

Depois de aplicar as migrations, faça login e valide:

### Início
- [ ] Hero **check-in de energia** aparece direto no fundo (sem card). Tocar 1→5 preenche o medidor; botão vira "Registrar check-in"; ao registrar, mostra "Energia registrada!" + anel de dias aumenta.
- [ ] Frase do dia (editorial), banner **Pesquisa rápida** (compacto, expande no "Responder").
- [ ] Se estiver no período (7 dias após 1º login e sem teste no ano): aparece o **banner da Bússola**.
- [ ] Atalhos em **bento** (Iluminari alto, Roteiro/Toque, Avaliações/Recado largos). Barra inferior escura e legível.

### Aniversários (Mais → Aniversários)
- [ ] Lista "É hoje" / "No restante da semana" com avatar de iniciais.
- [ ] Botão **Parabéns** envia um toque; vira "Enviado"; não aparece pra você mesmo.
- [ ] Se estiver vazio, confirme que a migration 1+2 rodou e que há gente com `birth_date` na semana.

### Bússola das Essências (Mais → Bússola das Essências)
- [ ] Intro com as 4 essências + consentimento opcional → "Iniciar minha jornada".
- [ ] 24 perguntas, uma por tela, barra de progresso, avança sozinho.
- [ ] Resultado: 4 barras (peso igual), essência principal, **personagem-espírito**, secundária + combinação, poderes/atenção/missão, mensagem final.
- [ ] Refazer só habilita quando elegível (1x/ano).
- [ ] **Admin** (Mais → Admin → Bússola do time): distribuição + lista de quem consentiu.

### Avaliações (líder/admin)
- [ ] Abas: **Avaliar / Minha evolução / Indicadores / Ciclos**.
- [ ] Avaliar: criar/abrir avaliação → 20 competências em 4 pilares, anel de progresso, médias por pilar, stepper de status, PDI, PDF, documento.

### Jornada / Pontos
- [ ] Jornada: anel de nível + roteiro + faltas + ritual.
- [ ] Pontos: anel de nível, métricas, pódio com **medalha no #1**, selos, regras.

### Gestão / Admin
- [ ] Toques, Roteiro (editar em bottom sheet), Elenco, Líder, Iluminari (texto/áudio/foto).
- [ ] Admin: Enviar recado, Hierarquia, Pré-cadastro (import .xlsx), Ciclo, Wi-Fi.
- [ ] **Confirmações destrutivas** (remover recado/vaga/pré-cadastro/IP) agora aparecem como **toast on-brand** (não mais o popup cinza do navegador).

---

## 5. Pontas conhecidas (opcionais)

- **Fonte Panel**: o app referencia `panel-sans`/`Panel` por nome; onde não estiver carregada, cai pra fallback. (No app real o Lovable carrega a fonte.)
- **Check-in com nota**: a versão inline da Home não tem o campo "nota opcional" que a antiga aba Humor tinha. Fácil de re-adicionar se quiser.
- **Tipos do Supabase**: server functions novos usam `as unknown as` porque os tipos gerados não conhecem as tabelas/colunas novas até você regenerar.

---

## 6. O que foi refinado nesta rodada final

- Removido código morto (`CheckinScreen`, aba Humor).
- Telas admin (`GamificationAnalytics/Cycle`, `PreRegistrations`) e `HomeNotifications` alinhadas ao visual novo (`glass-soft`, cantos 28px).
- 5 `confirm()` nativos → confirmação on-brand via toast (`src/lib/confirm.ts`).
- Typecheck **exit 0** em todo o projeto.
