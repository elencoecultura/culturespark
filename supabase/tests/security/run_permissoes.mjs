// Testes da migração Permissões de Usuários (20261105150000) sobre a réplica.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const L = U(1), S1 = U(2), C1 = U(3), F1 = U(4), T1 = U(5), X = U(6);
const db = new PGlite();
await db.exec(readFileSync("baseline.sql", "utf8"));
for (const m of ["20261023120000_auditoria_seguranca", "20261104120000_acessos_da_planilha", "20261105120000_celebracao_da_magia", "20261105150000_permissoes_de_usuarios"])
  await db.exec(readFileSync(`../../migrations/${m}.sql`, "utf8"));
await db.exec(`insert into public.profiles (id, full_name, attraction, setor) values
  ('${L}','Líder','PIZZARIA ONYRA','SALÃO'),('${S1}','Salão 1','PIZZARIA ONYRA','SALÃO'),('${C1}','Cozinha 1','PIZZARIA ONYRA','COZINHA'),
  ('${F1}','Ferrovia 1','FERROVIA SECRETA','SALÃO'),('${T1}','Trupe 1','TRUPE','ARTÍSTICO'),('${X}','Elenco','PIZZARIA ONYRA','SALÃO');
  insert into public.user_roles (user_id, role) values ('${L}','lider'),('${X}','elenco');`);
const ok = []; const check = (n, v) => { ok.push(v); console.log(`${v ? "PASSOU" : "FALHOU"} | ${n}`); };
const vis = async () => (await db.query(`select v from public.visible_user_ids('${L}') v`)).rows.map((r) => r.v).sort();
await db.exec(`insert into public.access_scopes (user_id, empresa, setor) values ('${L}','PIZZARIA ONYRA','COZINHA')`);
check("empresa+setor: vê só a cozinha da Ônyra", JSON.stringify(await vis()) === JSON.stringify([C1]));
await db.exec(`insert into public.leader_access (leader_id, member_id) values ('${L}','${F1}')`);
check("setor + pessoa avulsa somam", JSON.stringify(await vis()) === JSON.stringify([C1, F1].sort()));
await db.exec(`delete from public.access_scopes; insert into public.access_scopes (user_id, empresa, setor) values ('${L}','PIZZARIA ONYRA','')`);
check("empresa toda (setor vazio) + pessoa", JSON.stringify(await vis()) === JSON.stringify([S1, C1, F1, X].sort()));
await db.exec(`delete from public.access_scopes; delete from public.leader_access; insert into public.access_scopes (user_id, empresa, setor) values ('${L}','TODAS','')`);
check("TODAS vê todo mundo", (await vis()).length === 5);
await db.exec(`delete from public.access_scopes`);
check("sem nada: volta à regra antiga (líder sem time não vê ninguém)", (await vis()).length === 0);
await db.query(`select public.track_access('${X}','home')`); await db.query(`select public.track_access('${X}','home')`);
check("registro de acesso soma no mesmo dia/módulo", (await db.query(`select hits from public.app_access_log where user_id='${X}'`)).rows[0].hits === 2);
const asX = async (sql) => { await db.exec(`select set_config('request.jwt.claim.sub','${X}',false); set role authenticated;`); try { await db.query(sql); return true; } catch { return false; } finally { await db.exec("reset role"); } };
check("navegador não chama track_access", !(await asX(`select public.track_access('${X}','x')`)));
check("navegador não se dá empresa", !(await asX(`insert into public.access_scopes (user_id, empresa) values ('${X}','TODAS')`)));
check("navegador não se libera módulo", !(await asX(`insert into public.user_permission_overrides (user_id, key, allowed) values ('${X}','module:team',true)`)));
check("chave de permissão fora do padrão é recusada", !(await db.query(`insert into public.user_permission_overrides (user_id, key, allowed) values ('${X}','qualquer coisa',true)`).then(() => true).catch(() => false)));
check("navegador não lê histórico de permissões", (await (async () => { await db.exec(`select set_config('request.jwt.claim.sub','${X}',false); set role authenticated;`); try { return await db.query(`select * from public.permission_audit`); } catch (e) { return { err: true }; } finally { await db.exec("reset role"); } })()).err === true);
console.log(`\n${ok.filter(Boolean).length}/${ok.length} ok`); process.exit(ok.every(Boolean) ? 0 : 1);
