// Testes da migração da Celebração da Magia (20261105120000) sobre a réplica.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const A = U(1), B = U(2), C = U(3), ADM = U(4);
const db = new PGlite();
await db.exec(readFileSync("baseline.sql", "utf8"));
for (const m of ["20261023120000_auditoria_seguranca", "20261104120000_acessos_da_planilha", "20261105120000_celebracao_da_magia"])
  await db.exec(readFileSync(`../../migrations/${m}.sql`, "utf8"));
await db.exec(`insert into public.profiles (id, full_name) values ('${A}','A'),('${B}','B'),('${C}','C'),('${ADM}','Adm');
  insert into public.user_roles (user_id, role) values ('${ADM}','admin');`);
const ok = []; const check = (n, v) => { ok.push(v); console.log(`${v ? "PASSOU" : "FALHOU"} | ${n}`); };
const tryq = async (sql) => { try { await db.query(sql); return true; } catch { return false; } };
const as = async (uid, sql) => { await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`); try { return await db.query(sql); } catch (e) { return { error: e.message }; } finally { await db.exec("reset role"); } };
check("servidor grava felicitação", await tryq(`insert into public.company_anniversary_wishes (from_user,to_user,anniversary_year,years,message) values ('${A}','${B}',2026,3,'Parabéns pelos 3 anos!')`));
check("segunda felicitação do mesmo remetente no mesmo ano é recusada", !(await tryq(`insert into public.company_anniversary_wishes (from_user,to_user,anniversary_year,years,message) values ('${A}','${B}',2026,3,'De novo')`)));
check("no aniversário seguinte pode felicitar de novo", await tryq(`insert into public.company_anniversary_wishes (from_user,to_user,anniversary_year,years,message) values ('${A}','${B}',2027,4,'Mais um ano!')`));
check("felicitar a si mesmo é recusado", !(await tryq(`insert into public.company_anniversary_wishes (from_user,to_user,anniversary_year,years,message) values ('${A}','${A}',2026,1,'Eu')`)));
check("menos de 1 ano é recusado", !(await tryq(`insert into public.company_anniversary_wishes (from_user,to_user,anniversary_year,years,message) values ('${C}','${B}',2026,0,'Oi oi')`)));
check("ponto do tipo celebracao_magia é aceito", await tryq(`select public.award_points('${A}','celebracao_magia',3,'x')`));
const w = await as(A, `insert into public.company_anniversary_wishes (from_user,to_user,anniversary_year,years,message) values ('${A}','${C}',2026,2,'pelo navegador')`);
check("navegador não grava felicitação direto", !!w.error);
check("terceiro não lê felicitação dos outros", (await as(C, `select * from public.company_anniversary_wishes`)).rows.length === 0);
check("aniversariante lê as dele", (await as(B, `select * from public.company_anniversary_wishes`)).rows.length === 2);
check("admin lê todas", (await as(ADM, `select * from public.company_anniversary_wishes`)).rows.length === 2);
console.log(`\n${ok.filter(Boolean).length}/${ok.length} ok`); process.exit(ok.every(Boolean) ? 0 : 1);
