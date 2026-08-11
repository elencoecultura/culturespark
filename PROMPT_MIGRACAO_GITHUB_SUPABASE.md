Você é meu parceiro de engenharia. Vou te entregar um app pronto (zip anexado) e preciso migrá-lo do Lovable Cloud para o MEU próprio GitHub + MEU próprio Supabase. Conduza passo a passo, me pedindo só o que você não consegue fazer sozinho (criar repo/projeto, colar chaves). Trabalhe e valide você mesmo — não me mande "testar manualmente" sem antes verificar.

## O PROJETO
- App interno de cultura/gestão de elenco da Hector Studios: "Encantômetro" (avaliação de desempenho) + "Link Cultura" (energia, jornada, pontos, aniversários, Bússola das Essências / teste DISC).
- Stack: Lovable + TanStack Start/Router + React 19 + Vite 7 + Supabase (auth + Postgres + RLS) + Tailwind v4 + shadcn/ui. Server functions via createServerFn.
- O código está no zip anexado. Leia o `CONTEXTO_COMPLETO_APP_CULTURA.md` e o `FINALIZACAO.md` na raiz — eles têm todo o histórico, o design system e as pendências.

## MEU AMBIENTE (Mac) — importante
- NÃO tenho Node/npm/brew. Uso **Bun** (binários em `~/.bun/bin`). Rode tudo com `~/.bun/bin/bun ...`. Dev sobe em http://localhost:8080.
- O sandbox de preview não enxerga a pasta Desktop (só /tmp). Pra ver o app, suba o dev server com Bun e abra localhost:8080, ou sirva por fora.
- Descompacte o zip em `~/Desktop/Claude/culture-spark/` (ou onde eu indicar).

## OBJETIVO
Sair do Lovable Cloud e passar a rodar em infra própria: código no MEU GitHub (repo privado) e banco no MEU projeto Supabase, com deploy funcionando. Mesmo caminho que já fiz no meu hub de marketing.

## TAREFAS (nesta ordem)

### 0. SEGURANÇA PRIMEIRO (antes de qualquer git)
- O `.gitignore` atual NÃO ignora o `.env`. **Adicione `.env` e `.env.*` (menos `.env.example`) ao `.gitignore` ANTES do primeiro commit.** Se as chaves já tiverem sido commitadas em algum momento, me avise pra rotacioná-las no Supabase.
- Crie um `.env.example` com os NOMES das variáveis e valores em branco, pra servir de referência sem vazar segredo.

### 1. GitHub (repo privado)
- Inicialize git, faça o primeiro commit e me guie pra criar um repo **privado** e dar push. Se eu tiver o `gh` CLI, use; senão, me passe os comandos e eu crio o repo pela interface. Nunca comite o `.env`.

### 2. Supabase próprio
- Vou criar um novo projeto em supabase.com e te passar as chaves. Já existe `supabase/config.toml` no projeto.
- Aplique **todas as migrations** de `supabase/migrations/` no meu projeto novo, em ordem cronológica. Preste atenção nas 3 mais recentes, que precisam rodar nesta ordem:
  1. `20260721120000_add_birth_date.sql` (coluna profiles.birth_date)
  2. `20260721120500_seed_birthdays.sql` (importa ~86 aniversários; usa extensão `unaccent` — rode `CREATE EXTENSION IF NOT EXISTS unaccent;` antes se der erro)
  3. `20260721121000_behavioral_tests.sql` (tabela behavioral_tests + RLS da Bússola)
- Use `~/.bun/bin/bunx supabase link` + `supabase db push`, OU me oriente a colar cada SQL no SQL Editor. As migrations são idempotentes.
- Depois de aplicar, regenere os tipos (`supabase gen types typescript`) e remova os casts temporários `as unknown as` dos server functions novos (birthdays/disc).

### 3. Variáveis de ambiente (nomes EXATOS já usados no código)
Configure no `.env` local e depois no host de deploy:

| Variável | Onde vale | Observação |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client (browser) | URL do projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client (browser) | anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | client | id do projeto |
| `SUPABASE_URL` | server (SSR) | mesma URL |
| `SUPABASE_PUBLISHABLE_KEY` | server (SSR) | mesma publishable key |
| `SUPABASE_PROJECT_ID` | server | id do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | **só server** | **FALTA no meu .env** — secreta, nunca no client/repo. Sem ela, as funções admin quebram. |

O cliente lê em `src/integrations/supabase/client.ts` (client), `client.server.ts` (service role) e `auth-middleware.ts` (SSR). Confira lá se precisar.

### 4. Rodar e validar local
- `~/.bun/bin/bun install` e `~/.bun/bin/bun run dev` → valide em http://localhost:8080.
- Rode `~/.bun/bin/bunx tsc --noEmit` e garanta typecheck limpo (hoje está exit 0).
- Teste login real e as features novas (Aniversários, Bússola) — elas só funcionam depois das migrations.

### 5. Deploy
- Recomende e configure um host que suporte TanStack Start com server functions (Vercel, Netlify ou Cloudflare). Configure TODAS as variáveis acima no painel do host (a SERVICE_ROLE só como secret de servidor).
- No Supabase → Auth, configure as Redirect URLs / Site URL do domínio de produção.
- Faça um deploy de teste e me mande o link pra validar com usuário real.

### 6. Fechamento
- Escreva/atualize um `README.md` com: como rodar (Bun), variáveis, como aplicar migrations, como fazer deploy.
- Me diga o que ficou pendente e o que eu preciso fazer com minhas credenciais.

## REGRAS
- Nunca faça login por mim nem peça minha senha; me diga o que colar/aprovar e eu faço.
- Nunca comite segredos. Confirme o `.gitignore` antes de qualquer push.
- Priorize deixar o app rodando ponta-a-ponta no meu Supabase. Preserve o design system existente (tokens de marca, liquid glass, bento) — não redesenhe nada sem eu pedir.
