// Testes da regra de visibilidade por lista (planilha de acessos), sobre a
// réplica do banco + migrações 20261023120000 e 20261104120000.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(1), BRYAN = U(2), M1 = U(3), M2 = U(4), M3 = U(5), WASEM = U(6), T1 = U(7), T2 = U(8);
const db = new PGlite();
await db.exec(readFileSync("baseline.sql", "utf8"));
await db.exec(readFileSync("../../migrations/20261023120000_auditoria_seguranca.sql", "utf8"));
await db.exec(readFileSync("../../migrations/20261104120000_acessos_da_planilha.sql", "utf8"));
await db.exec(`
  insert into public.profiles (id, full_name, attraction, negocio) values
   ('${ADMIN}','Admin','TODOS','TODOS'),('${BRYAN}','Bryan','PIZZARIA ONYRA','PIZZARIA ONYRA'),
   ('${M1}','Cozinha 1','PIZZARIA ONYRA','PIZZARIA ONYRA'),('${M2}','Cozinha 2','PIZZARIA ONYRA','PIZZARIA ONYRA'),
   ('${M3}','Salão 1','PIZZARIA ONYRA','PIZZARIA ONYRA'),('${WASEM}','Wasem','TRUPE','TRUPE'),
   ('${T1}','Trupe 1','TRUPE','TRUPE'),('${T2}','Trupe 2','TRUPE','TRUPE');
  insert into public.user_roles (user_id, role) values ('${ADMIN}','admin'),('${BRYAN}','gerente'),('${WASEM}','gerente'),
   ('${M1}','elenco'),('${M2}','elenco'),('${M3}','elenco'),('${T1}','elenco'),('${T2}','elenco');
  insert into public.mood_checkins (user_id, mood) values ('${M1}',3),('${M2}',3),('${M3}',3),('${T1}',3);
`);
async function as(uid, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return (await db.query(sql)).rows; } catch (e) { return { error: e.message }; }
  finally { await db.exec(`reset role;`); }
}
const ids = async (uid, viewer = uid) => { const r = await as(uid, `select v from public.visible_user_ids('${viewer}') v`); return r.error ? r : r.map((x) => x.v).sort(); };
const res = [];
const check = (name, ok) => { res.push(ok); console.log(`${ok ? "PASSOU" : "FALHOU"} | ${name}`); };
check("antes da lista: gerente Bryan vê a Ônyra inteira (regra antiga)", JSON.stringify(await ids(BRYAN)) === JSON.stringify([M1, M2, M3].sort()));
await db.exec(`insert into public.leader_access (leader_id, member_id, motivo) values ('${BRYAN}','${M1}','Cozinha'),('${BRYAN}','${M2}','Cozinha')`);
check("com lista: Bryan vê exatamente M1 e M2", JSON.stringify(await ids(BRYAN)) === JSON.stringify([M1, M2].sort()));
const moods = await as(BRYAN, `select user_id from public.mood_checkins order by 1`);
check("RLS segue a lista (humor só de M1 e M2)", JSON.stringify(moods.map((x) => x.user_id)) === JSON.stringify([M1, M2].sort()));
check("Wasem (Trupe, sem lista) continua vendo a Trupe", JSON.stringify(await ids(WASEM)) === JSON.stringify([T1, T2].sort()));
check("admin vê todo mundo", (await ids(ADMIN)).length === 7);
const forb = await ids(M1, BRYAN);
check("elenco não consulta quem outra pessoa vê", !!forb.error);
check("elenco não vê a lista de acessos de ninguém", (await as(M1, `select * from public.leader_access`)).length === 0);
const w = await as(BRYAN, `insert into public.leader_access (leader_id, member_id) values ('${BRYAN}','${M3}')`);
check("líder não se dá acesso pelo navegador", !!w.error);
console.log(`\n${res.filter(Boolean).length}/${res.length} ok`);
process.exit(res.every(Boolean) ? 0 : 1);
