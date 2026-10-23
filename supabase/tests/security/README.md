# Testes de segurança do banco (sem tocar produção)

`baseline.sql` reproduz, num Postgres em memória (PGlite), o estado de produção
de 23/10/2026 das tabelas, funções, triggers, policies e grants que a migração
`20261023120000_auditoria_seguranca.sql` altera (definições copiadas do banco
vivo). `run.mjs` roda 36 cenários duas vezes, antes e depois da migração:
18 ataques que precisam passar a falhar e 18 fluxos legítimos que precisam
continuar funcionando. Dados sintéticos, nada sai da máquina.

```bash
cd supabase/tests/security
bun install
bun run test            # esperado: 36/36 ok
bun run test:rollback   # aplica a reversão; esperado: comportamento igual ao de antes
```

Ao mudar policies no futuro, atualize `baseline.sql` com o estado vivo
(`pg_policies`, `pg_get_functiondef`) e acrescente o cenário em `run.mjs`.
