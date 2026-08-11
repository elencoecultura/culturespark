# Culture Spark — Encantômetro / Link Cultura

App interno da Hector Studios para avaliação de desempenho (**Encantômetro**) e cultura/engajamento do elenco (**Link Cultura** — energia, jornada, pontos, aniversários, Bússola das Essências).

Migrado do Lovable Cloud para infra própria: código no GitHub, banco no Supabase.

## Stack

TanStack Start/Router + React 19 + Vite 7 + Supabase (auth + Postgres + RLS) + Tailwind v4 + shadcn/ui, rodando com [Bun](https://bun.sh).

## Rodando localmente

Requer Bun (não usa Node/npm diretamente).

```bash
bun install
bun run dev
```

Abre em **http://localhost:8080** — a porta é fixa por configuração do `@lovable.dev/vite-tanstack-config` (não muda via flag/env).

Typecheck:

```bash
bunx tsc --noEmit
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha (nomes exatos, usados no código):

| Variável | Onde vale | Observação |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client (browser) | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client (browser) | anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | client | id do projeto |
| `SUPABASE_URL` | server (SSR) | mesma URL |
| `SUPABASE_PUBLISHABLE_KEY` | server (SSR) | mesma publishable key |
| `SUPABASE_PROJECT_ID` | server | id do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | **só server** | secreta — bypassa RLS, nunca expor no client/repo |

`.env` está no `.gitignore` — nunca é commitado.

## Migrations do Supabase

Todas em `supabase/migrations/`, aplicadas em ordem cronológica pelo nome do arquivo. Para aplicar num projeto Supabase novo:

```bash
bunx supabase db push --db-url "postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres"
```

(a senha do Postgres fica em Project Settings → Database; caracteres especiais precisam de percent-encoding, ex. `@` → `%40`)

As 3 mais recentes (dependência das features Aniversários e Bússola):

1. `20260721120000_add_birth_date.sql` — coluna `profiles.birth_date`
2. `20260721120500_seed_birthdays.sql` — importa ~86 aniversários do elenco, casando por nome normalizado (usa extensão `unaccent`)
3. `20260721121000_behavioral_tests.sql` — tabela `behavioral_tests` (Bússola DISC) + RLS

**Importante sobre a seed de aniversários:** ela só atualiza `profiles` que **já existem** no banco (`UPDATE ... WHERE nome = 'X'`, idempotente). Num banco novo/vazio ela não tem efeito. Depois que o elenco tiver contas criadas (login ou import de pré-cadastro), rode o conteúdo do arquivo `20260721120500_seed_birthdays.sql` de novo manualmente (SQL Editor do Supabase) para preencher os aniversários retroativamente — `db push` sozinho não reexecuta migrations já marcadas como aplicadas.

Depois de aplicar migrations novas que criam tabelas/colunas, os tipos em `src/integrations/supabase/types.ts` precisam refletir o schema novo. O ideal é `bunx supabase gen types typescript --project-id SEU-PROJETO` (precisa de `SUPABASE_ACCESS_TOKEN` ou `supabase login`) — nesta máquina, sem Docker instalado, os tipos foram atualizados manualmente com base no SQL das migrations.

## Deploy (Vercel)

Projeto conectado ao repositório GitHub — todo push em `main` dispara build e deploy automático na Vercel (não precisa rodar `vercel --prod` manualmente).

Configure no painel da Vercel (Project Settings → Environment Variables) as 7 variáveis da tabela acima — `SUPABASE_SERVICE_ROLE_KEY` só como secret de servidor. Se o projeto Vercel for de um time (não conta pessoal), desative **Deployment Protection → Vercel Authentication** para Production, senão visitantes sem conta na Vercel caem numa tela de login da Vercel em vez do app.

No Supabase → Authentication → URL Configuration, configure **Site URL** e **Redirect URLs** com o domínio de produção (ex. `https://SEU-DOMINIO.vercel.app/**`).

**Emails de auth (convite/recuperação de senha):** o serviço de email padrão do Supabase tem um limite bem baixo (poucos envios por hora) — bom pra testar, ruim pra produção. Configure um SMTP próprio em Authentication → Settings → SMTP Settings (Resend, SendGrid, Gmail, etc.) antes de depender de convites/recuperação de senha em escala.

## Autenticação — definir/redefinir senha

O botão "Esqueci minha senha" (`src/routes/login.tsx`) chama `supabase.auth.resetPasswordForEmail` e a rota `src/routes/redefinir-senha.tsx` consome o link (recovery ou invite) e chama `supabase.auth.updateUser({ password })`. Sem essa rota, links de convite/recuperação do Supabase caem direto no login sem chance de definir senha.

## Pontas conhecidas

- **Fonte Panel**: referenciada por nome (`panel-sans`/`Panel`); onde não estiver carregada, cai no fallback do sistema.
- **Check-in com nota**: a versão inline da Home não tem o campo "nota opcional" que a antiga aba Humor tinha.
- **Aniversários**: seed só preenche `profiles` existentes — ver seção de migrations acima.
- **Equipe Studios** (apelidos, só dia/mês) ficou comentada na migration de seed — preencher manualmente depois.
- **Migração de usuários do Lovable Cloud**: como o banco antigo era gerenciado pelo Lovable (sem acesso direto ao Postgres), não foi possível migrar hashes de senha reais. As 4 contas com acesso real (na época da migração: admins + 1 elenco) foram recriadas via Supabase Admin API (`generateLink` tipo `recovery`/`invite`) e cada pessoa definiu senha nova em `/redefinir-senha`. Os ~103 pré-cadastros do elenco (nomes, cargos, setor) foram reimportados em `pre_registrations` para o fluxo de cadastro por nome continuar funcionando.
