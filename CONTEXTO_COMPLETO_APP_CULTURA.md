# 📦 Contexto Completo — App de Cultura (Encantômetro / Link Cultura)
### Arquivo de transferência para nova janela de chat

> **Como usar este arquivo:** cole ou anexe este documento na nova conversa e diga *"continue este projeto"*. Ele contém tudo — o que é o app, a stack, onde está o código, o que já foi feito, o que falta e como rodar. O código-fonte está na mesma máquina (Mac), então o novo chat consegue ler os arquivos direto do disco a partir dos caminhos abaixo.

---

## 1. O que é o projeto

**App interno de cultura e gestão de elenco da Hector Studios.** Dois nomes convivem no produto:
- **Encantômetro** — o sistema de avaliação de desempenho (competências, PDI, ciclos).
- **Link Cultura** — o app de cultura/engajamento do elenco (energia, jornada, pontos, aniversários, Bússola das Essências).

Público: colaboradores ("elenco") e lideranças da Hector Studios (parques/atrações: Era do Fogo, Escola de Magia Onyra, Castelo de Gelo, Ferrovia Secreta, Hector Play, etc.).

Papéis (roles): `admin`, `direcao`, `gerente`, `lider`, `elenco` — cada um vê telas e permissões diferentes.

---

## 2. Onde está o código

```
/Users/lucasfreitasdossantos/Desktop/Claude/culture-spark/
```

Estrutura relevante:
```
culture-spark/
├── .env                      # chaves do Supabase (NÃO versionar — ver §8)
├── .claude/                  # config local
├── package.json              # scripts (dev/build) — roda com Bun
├── supabase/
│   └── migrations/           # migrations SQL (3 novas PENDENTES — ver §6)
└── src/
    ├── components/
    │   └── link-cultura/
    │       ├── LinkCulturaApp.tsx      # ★ NÚCLEO — ~2340 linhas, TODAS as telas
    │       ├── Bussola.tsx             # teste DISC (Bússola das Essências)
    │       └── BottomSheetModal.tsx    # modal bottom-sheet acessível reutilizável
    └── lib/
        ├── confirm.ts                  # confirmAction() — toast on-brand no lugar do confirm() nativo
        ├── birthdays.functions.ts      # server fns dos aniversários
        ├── disc-content.ts             # conteúdo/textos das 4 essências + perguntas
        └── disc.functions.ts           # server fns do teste DISC
```

Documentação já existente na raiz do projeto (leia se precisar de detalhe):
| Arquivo | Conteúdo |
| --- | --- |
| `FINALIZACAO.md` | Passo-a-passo pra colocar no ar + roteiro de teste ponta-a-ponta |
| `DESIGN_HANDOFF.md` | Sistema de design completo (tokens, componentes) |
| `DESIGN_SYSTEM_EXPORT.md` | Design system exportável pra outros projetos |
| `COMPONENT_STYLE_GUIDE.md` | Padrões de componente (cards, tiles, rings, chips) |
| `COPYWRITING_GUIDE.md` | Tom de voz e microcopy do app |
| `IMPLEMENTATION_CHECKLIST.md` | Checklist de implementação |

---

## 3. Stack técnica

- **Lovable** (plataforma de origem/deploy) + **Lovable Cloud** (Supabase gerenciado)
- **TanStack Start / Router** + **React 19** + **Vite 7**
- **Supabase** (auth + Postgres + RLS) — server functions via `createServerFn` + `requireSupabaseAuth`
- **Tailwind CSS v4** + **shadcn/ui**
- **Bun** como runtime/gerenciador (binários em `~/.bun/bin`), **dev na porta 8080**
- **sonner** para toasts

Padrão importante: tabelas/colunas novas ainda não estão nos tipos gerados do Supabase, então os server functions novos usam cast `context.supabase as unknown as { from: (t: string) => any }` e tipam o resultado à mão. Depois de regenerar os tipos (`supabase gen types` ou botão do Lovable), dá pra remover esses casts.

### Como rodar localmente
```bash
cd ~/Desktop/Claude/culture-spark
~/.bun/bin/bun install    # só na 1ª vez / pasta nova
~/.bun/bin/bun run dev    # abre em http://localhost:8080
```
> ⚠️ Ambiente do Mac: **não há Node/npm/brew** — use **Bun**. O sandbox de preview do Claude Code **não enxerga a pasta Desktop** (só `/tmp`); pra ver o app no navegador, rode o dev server com Bun e abra `http://localhost:8080` manualmente, ou sirva por fora.

---

## 4. Sistema de design ("Liquid glass sobre aurora noturna")

Estética: vidro fosco translúcido sobre fundo de aurora noturna estrelada. Cantos bem arredondados, rings SVG, layout em bento (mosaico com blocos de tamanhos variados).

**Tokens de marca:**
| Token | Hex | Uso |
| --- | --- | --- |
| papel | `#EFEFEA` | base clara |
| celeste | `#6AD1E3` | destaque ciano |
| blu | `#1A2891` | azul profundo |
| pink | `#E451F5` | acento magenta |
| ink | `#071038` | fundo/nav escuro |
| magic-green | `#24d18b` | positivo |
| magic-amber | `#ffca55` | atenção |
| magic-red | `#ff5c7a` | alerta |

Gradientes: `brand-grad`, `blue-grad`, `pink-grad`, `aurora-bg`.
Utilitários de vidro: `glass-soft`, `glass-strong`, `glass-chip`, `glass-input`.
Raios: cards `rounded-[32px]`, tiles `rounded-[28px]`, nav `rounded-[30px]`.
Fonte display: `Panel` / `panel-sans` (o Lovable carrega; onde não houver, cai no fallback).

Barra inferior de navegação (referência de código):
```tsx
<div className="rounded-[30px] border border-white/15 bg-ink/85 px-2 ... backdrop-blur-2xl">
```

---

## 5. O que já foi feito (histórico das rodadas)

### Redesign visual da Home
- **Check-in de energia** vira o herói da tela, direto sobre o fundo (sem card em volta), com **escala 1→5** interativa que preenche um medidor; botão "Registrar check-in" → "Energia registrada!".
- **Anéis SVG** de streak/nível (`StreakRing`, `LevelRing`) e informativo de dias em destaque maior.
- Atalhos em **bento** (blocos de tamanhos variados, harmônicos — não mais grade de quadrados repetidos).
- Frase editorial do dia + banner **Pesquisa rápida** compacto (expande no "Responder").
- Aba "Humor" separada foi **removida** — virou o check-in inline da Home.
- Barra inferior **escura, translúcida e legível** (corrigido o problema de ilegibilidade).

### Avaliações (Encantômetro) reestruturada
- Abas claras: **Avaliar / Minha evolução / Indicadores / Ciclos**.
- Avaliação: 20 competências em 4 pilares, anel de progresso, médias por pilar, stepper de status, PDI, exportação PDF e documento.

### Jornada / Pontos
- Jornada: anel de nível + roteiro + faltas + ritual.
- Pontos: anel de nível, métricas, pódio com medalha no #1, selos, regras.

### Limpeza e consistência (rodada de finalização)
- Removido código morto (`CheckinScreen`, aba Humor).
- Telas admin (`GamificationAnalytics/Cycle`, `PreRegistrations`) e `HomeNotifications` alinhadas ao visual novo (`glass-soft`, cantos 28px).
- 5 `confirm()` nativos substituídos por confirmação on-brand via toast (`src/lib/confirm.ts`).
- **Typecheck exit 0** em todo o projeto.

### Feature nova — Aniversários
- Aba (Mais → Aniversários) com "É hoje" / "No restante da semana", avatar de iniciais.
- Botão **Parabéns** envia um toque; vira "Enviado"; não aparece pra si mesmo.
- Depende das migrations 1 e 2.

### Feature nova — Bússola das Essências (teste DISC)
- Teste comportamental **1x por ano**, disponível **~1 semana após o primeiro login**; banner aparece na Home no período elegível.
- Intro com as 4 essências + consentimento opcional → 24 perguntas (uma por tela, barra de progresso, avança sozinho).
- Resultado: 4 barras, essência principal + **personagem-espírito**, secundária + combinação, poderes/atenção/missão, mensagem final.
- **Admin** (Mais → Admin → Bússola do time): distribuição do time + lista de quem consentiu.
- Depende da migration 3.

---

## 6. ⚠️ PENDÊNCIAS (o que falta pra ir ao ar)

Estas dependem de acesso ao Supabase/Lovable e de login — **não** dá pra fazer só no código.

### 6.1 Aplicar as 3 migrations (obrigatório pras features novas), nesta ordem:
| Ordem | Arquivo | O que faz |
| --- | --- | --- |
| 1 | `supabase/migrations/20260721120000_add_birth_date.sql` | Adiciona coluna `profiles.birth_date` |
| 2 | `supabase/migrations/20260721120500_seed_birthdays.sql` | Importa ~86 aniversários do elenco (casa por nome, usa `unaccent`) |
| 3 | `supabase/migrations/20260721121000_behavioral_tests.sql` | Cria tabela `behavioral_tests` (Bússola DISC) + RLS |

Como aplicar: Supabase Dashboard → SQL Editor → cola o conteúdo de cada arquivo e executa na ordem (são idempotentes). Se der erro de `unaccent` na migration 2, rode antes `CREATE EXTENSION IF NOT EXISTS unaccent;` (precisa de permissão de owner). A "Equipe Studios" (só dia/mês, apelidos) ficou **comentada** na migration 2 — preencher manualmente depois.

### 6.2 Publicar no Lovable
- Subir a pasta / conectar o repo.
- Confirmar as variáveis do Supabase no Lovable Cloud (o `.env` local **não** vai pro repo público — ver §8).
- Aplicar as 3 migrations.
- Configurar a **`SUPABASE_SERVICE_ROLE_KEY`** no Cloud (faltava no `.env` local; sem ela, funções admin de servidor falham).
- Publicar e testar o link `.lovable.app` com um usuário real.

### 6.3 Roteiro de teste ponta-a-ponta
Está detalhado em `FINALIZACAO.md` §4 (Início, Aniversários, Bússola, Avaliações, Jornada/Pontos, Gestão/Admin).

---

## 7. Pontas conhecidas (opcionais / dívidas leves)
- **Fonte Panel**: referenciada por nome; onde não carregada, cai no fallback.
- **Check-in com nota**: a versão inline da Home não tem o campo "nota opcional" que a antiga aba Humor tinha (fácil re-adicionar).
- **Tipos do Supabase**: server functions novos usam `as unknown as` até os tipos serem regenerados.

---

## 8. 🔒 Segurança (importante)
- O `.env` do projeto contém **chaves do Supabase** (anon key, URL) — **nunca** suba num repositório público; confirme que está no `.gitignore`. Ao compartilhar a pasta/zip externamente, **remova o `.env`**.
- **Falta** a `SUPABASE_SERVICE_ROLE_KEY` no `.env` local — ela é secreta e deve ficar só no Lovable Cloud, nunca no cliente/repo.
- As migrations e a configuração do banco precisam ser aplicadas por quem tem acesso ao Supabase/Lovable (o assistente não tem acesso ao banco).

---

## 9. Primeiros passos sugeridos pro novo chat
1. `cd ~/Desktop/Claude/culture-spark` e ler `FINALIZACAO.md` + `DESIGN_HANDOFF.md`.
2. Abrir `src/components/link-cultura/LinkCulturaApp.tsx` (núcleo) pra entender a navegação (tipo `TabId`, switch de telas).
3. Rodar `~/.bun/bin/bun run dev` e validar em `http://localhost:8080`.
4. Rodar `~/.bun/bin/bunx tsc --noEmit` pra confirmar typecheck limpo antes de mexer.
5. Priorizar o que o Lucas pedir; se for continuar features, seguir os padrões de §4 (tokens, glass, bento, rings).

---

*Gerado em 2026-08-11 para transferência de contexto. Projeto com typecheck limpo (exit 0) e 2340 linhas no componente núcleo.*
