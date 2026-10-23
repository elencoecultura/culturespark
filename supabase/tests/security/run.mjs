// Testes de regressão de segurança: mesma bateria contra a réplica do estado
// de produção (antes) e depois da migração. "ATAQUE" = o teste tenta algo que
// não deveria ser permitido; "LEGÍTIMO" = fluxo que precisa continuar funcionando.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const MIG = process.argv[2];
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(1), L1 = U(2), M1 = U(3), M2 = U(4), G1 = U(5), L2 = U(6), F1 = U(7), E9 = U(8);
const EV1 = U(101), EV2 = U(102), S_OPEN = U(201), S_CLOSED = U(202), CYC = U(301);

async function fresh(applyMigration) {
  const db = new PGlite();
  await db.exec(readFileSync("baseline.sql", "utf8"));
  await db.exec(`
    insert into public.profiles (id, full_name, attraction, negocio, email, manager_id, co_leader_id, birth_date) values
      ('${ADMIN}','Admin','HECTOR STUDIOS','HECTOR STUDIOS','admin@x.com',null,null,null),
      ('${L1}','Lider Pizza','PIZZARIA ONYRA','PIZZARIA ONYRA','l1@x.com',null,null,null),
      ('${M1}','Membro Pizza','PIZZARIA ONYRA','PIZZARIA ONYRA','m1@x.com','${L1}',null,'1990-05-05'),
      ('${M2}','Co-liderado Pizza','PIZZARIA ONYRA','PIZZARIA ONYRA','m2@x.com',null,'${L1}',null),
      ('${G1}','Gerente Pizza','PIZZARIA ONYRA','PIZZARIA ONYRA','g1@x.com',null,null,null),
      ('${L2}','Lider Ferrovia','FERROVIA SECRETA','FERROVIA SECRETA','l2@x.com',null,null,null),
      ('${F1}','Membro Ferrovia','FERROVIA SECRETA','FERROVIA SECRETA','f1@x.com','${L2}',null,null),
      ('${E9}','Elenco Ferrovia','FERROVIA SECRETA','FERROVIA SECRETA','e9@x.com','${L2}',null,null);
    insert into public.user_roles (user_id, role) values ('${ADMIN}','admin'),('${L1}','lider'),('${M1}','elenco'),('${M2}','elenco'),
      ('${G1}','gerente'),('${L2}','lider'),('${F1}','elenco'),('${E9}','elenco');
    insert into public.mood_checkins (user_id, mood, note) values ('${M1}',2,'nota M1'),('${M2}',3,'nota M2'),('${F1}',1,'nota privada F1');
    insert into public.journey_absences (user_id, absence_date, reason, attachment_path) values ('${F1}','2026-10-01','medico','${F1}/b.pdf');
    insert into public.pre_registrations (full_name, name_normalized, email, perfil, negocio) values
      ('Gerente Livre','gerente livre',null,'GERENTE','PIZZARIA ONYRA'),
      ('Lider Com Email','lider com email','lider@x.com','LIDER','FERROVIA SECRETA'),
      ('Elenco Novo','elenco novo',null,'ELENCO','TRUPE');
    insert into public.evaluations (id, cycle_id, evaluatee_id) values ('${EV1}','${CYC}','${M1}'),('${EV2}','${CYC}','${F1}');
    insert into public.evaluation_evaluators (evaluation_id, evaluator_id) values ('${EV1}','${L1}'),('${EV2}','${L2}');
    insert into public.evaluation_documents (evaluation_id, kind, storage_path) values ('${EV2}','assinado','${EV2}/assinado.pdf');
    insert into public.nps_surveys (id, opens_at, closes_at, active) values ('${S_OPEN}', now() - interval '1 day', now() + interval '1 day', true),
      ('${S_CLOSED}', now() - interval '10 day', now() - interval '1 day', false);
    insert into storage.objects (bucket_id, name) values ('journey-absences','${F1}/b.pdf'),('journey-absences','${M1}/a.pdf');
  `);
  if (applyMigration) await db.exec(readFileSync(MIG, "utf8"));
  if (applyMigration && process.argv[3]) await db.exec(readFileSync(process.argv[3], "utf8")); // modo reversão
  return db;
}

async function as(db, uid, role, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const ok = async (fn) => { try { return await fn(); } catch (e) { return { error: e.message }; } };

const tests = [
  // [tipo, descrição, função que devolve true se o ataque passou / se o fluxo legítimo funcionou]
  ["ATAQUE", "elenco grava attraction='TODOS' no próprio perfil", async (db) => {
    await ok(() => as(db, M1, "authenticated", `update public.profiles set attraction='TODOS' where id='${M1}'`));
    return (await db.query(`select attraction from public.profiles where id='${M1}'`)).rows[0].attraction === "TODOS"; }],
  ["ATAQUE", "elenco lê e-mail de colegas (profiles.email)", async (db) => {
    const r = await ok(() => as(db, M1, "authenticated", `select email from public.profiles where id='${F1}'`));
    return !r.error && r.rows?.[0]?.email === "f1@x.com"; }],
  ["ATAQUE", "signup público com metadata attraction='TODOS' vira visão global", async (db) => {
    await db.query(`insert into auth.users (id,email,raw_user_meta_data) values ('${U(900)}','evil@x.com','{"full_name":"Evil","attraction":"TODOS"}')`);
    return (await db.query(`select attraction from public.profiles where id='${U(900)}'`)).rows[0]?.attraction === "TODOS"; }],
  ["ATAQUE", "signup público por NOME reivindica pré-cadastro de GERENTE", async (db) => {
    await db.query(`insert into auth.users (id,email,raw_user_meta_data) values ('${U(901)}','x@evil.com','{"full_name":"Gerente Livre"}')`);
    return (await db.query(`select 1 from public.user_roles where user_id='${U(901)}' and role='gerente'`)).rows.length > 0; }],
  ["ATAQUE", "signup com e-mail da vítima (não confirmado) reivindica pré-cadastro", async (db) => {
    await db.query(`insert into auth.users (id,email) values ('${U(902)}','lider@x.com')`);
    return (await db.query(`select 1 from public.user_roles where user_id='${U(902)}' and role='lider'`)).rows.length > 0; }],
  ["ATAQUE", "elenco insere check-in retroativo direto no PostgREST (pontos)", async (db) => {
    const r = await ok(() => as(db, M1, "authenticated", `insert into public.mood_checkins (user_id,mood,created_at) values ('${M1}',5,'2025-01-01')`));
    return !r.error; }],
  ["ATAQUE", "elenco insere elogio direto (pula limite/filtro)", async (db) => {
    const r = await ok(() => as(db, M1, "authenticated", `insert into public.kudos (from_user,to_user,message) values ('${M1}','${M2}','x')`));
    return !r.error; }],
  ["ATAQUE", "líder da Pizzaria lê humor (com nota) de membro da Ferrovia", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `select note from public.mood_checkins where user_id='${F1}'`));
    return !r.error && r.rows.length > 0; }],
  ["ATAQUE", "líder da Pizzaria lê falta/atestado da Ferrovia", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `select reason from public.journey_absences where user_id='${F1}'`));
    return !r.error && r.rows.length > 0; }],
  ["ATAQUE", "líder da Pizzaria cria/edita escala de membro da Ferrovia", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.weekly_schedules (week_start,user_id,attraction) values ('2026-10-19','${F1}','x')`));
    return !r.error; }],
  ["ATAQUE", "líder marca a PRÓPRIA semana como cumprida (+20 pts)", async (db) => {
    await ok(() => as(db, L1, "authenticated", `insert into public.weekly_schedules (week_start,user_id,attraction,completed_full) values ('2026-10-12','${L1}','x',true)`));
    return (await db.query(`select 1 from public.point_events where user_id='${L1}' and kind='schedule_completed'`)).rows.length > 0; }],
  ["ATAQUE", "gerente lê pontos de outra casa (point_events)", async (db) => {
    await db.query(`insert into public.point_events (user_id,kind,points,season,ref_id) values ('${F1}','checkin',5,'s','day:x') on conflict do nothing`);
    const r = await ok(() => as(db, G1, "authenticated", `select 1 from public.point_events where user_id='${F1}'`));
    return !r.error && r.rows.length > 0; }],
  ["ATAQUE", "líder cria vaga já 'approved' com decisão preenchida", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.job_requests (title,status,decided_by,created_by) values ('v','approved','${L1}','${L1}')`));
    return !r.error; }],
  ["ATAQUE", "avaliador aponta documento para o PDF de outra avaliação", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.evaluation_documents (evaluation_id,kind,storage_path,uploaded_by) values ('${EV1}','assinado','${EV2}/assinado.pdf','${L1}')`));
    return !r.error; }],
  ["ATAQUE", "avaliador troca o avaliado (evaluatee_id) da avaliação", async (db) => {
    await ok(() => as(db, L1, "authenticated", `update public.evaluations set evaluatee_id='${E9}' where id='${EV1}'`));
    return (await db.query(`select evaluatee_id from public.evaluations where id='${EV1}'`)).rows[0].evaluatee_id === E9; }],
  ["ATAQUE", "responder NPS de pesquisa encerrada", async (db) => {
    const r = await ok(() => as(db, M1, "authenticated", `insert into public.nps_responses (survey_id,user_id,score) values ('${S_CLOSED}','${M1}',0)`));
    return !r.error; }],
  ["ATAQUE", "anônimo consulta papéis via rpc has_role", async (db) => {
    const r = await ok(() => as(db, null, "anon", `select public.has_role('${ADMIN}','admin') as v`));
    return !r.error; }],
  ["ATAQUE", "anônimo enumera pré-cadastros via rpc search_pre_registrations", async (db) => {
    const r = await ok(() => as(db, null, "anon", `select * from public.search_pre_registrations('ger', 5)`));
    return !r.error; }],
  ["LEGÍTIMO", "líder lê humor do time direto (manager_id)", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `select 1 from public.mood_checkins where user_id='${M1}'`));
    return !r.error && r.rows.length === 1; }],
  ["LEGÍTIMO", "líder lê humor de quem ele co-lidera (co_leader_id)", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `select 1 from public.mood_checkins where user_id='${M2}'`));
    return !r.error && r.rows.length === 1; }],
  ["LEGÍTIMO", "gerente lê humor da própria casa", async (db) => {
    const r = await ok(() => as(db, G1, "authenticated", `select 1 from public.mood_checkins where user_id='${M1}'`));
    return !r.error && r.rows.length === 1; }],
  ["LEGÍTIMO", "elenco lê o próprio humor", async (db) => {
    const r = await ok(() => as(db, M1, "authenticated", `select 1 from public.mood_checkins where user_id='${M1}'`));
    return !r.error && r.rows.length === 1; }],
  ["LEGÍTIMO", "elenco lê diretório (nome, casa, aniversário) dos colegas", async (db) => {
    const r = await ok(() => as(db, M1, "authenticated", `select id, full_name, attraction, negocio, birth_date, manager_id from public.profiles`));
    return !r.error && r.rows.length >= 8; }],
  ["LEGÍTIMO", "admin altera hierarquia (manager_id/active) pelo token dele", async (db) => {
    const r = await ok(() => as(db, ADMIN, "authenticated", `update public.profiles set manager_id='${L1}' where id='${E9}'`));
    return !r.error && (await db.query(`select manager_id from public.profiles where id='${E9}'`)).rows[0].manager_id === L1; }],
  ["LEGÍTIMO", "servidor (service role) grava check-in e o +20 da semana roda", async (db) => {
    for (let d = 0; d < 6; d++) await as(db, null, "service_role",
      `insert into public.mood_checkins (user_id,mood,created_at) values ('${F1}',4, (date_trunc('week', now() at time zone 'America/Sao_Paulo') + interval '${d} day' + interval '12 hour') at time zone 'America/Sao_Paulo')`);
    return (await db.query(`select 1 from public.point_events where user_id='${F1}' and kind='schedule_completed'`)).rows.length > 0; }],
  ["LEGÍTIMO", "servidor (service role) grava elogio com pontos", async (db) => {
    await as(db, null, "service_role", `insert into public.kudos (from_user,to_user,message) values ('${M2}','${M1}','obrigado')`);
    return (await db.query(`select 1 from public.point_events where user_id='${M2}' and kind='kudos_sent'`)).rows.length > 0; }],
  ["LEGÍTIMO", "líder marca semana cumprida de membro do time (+20)", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.weekly_schedules (week_start,user_id,attraction,completed_full) values ('2026-10-05','${M1}','x',true)`));
    return !r.error && (await db.query(`select 1 from public.point_events where user_id='${M1}' and kind='schedule_completed'`)).rows.length > 0; }],
  ["LEGÍTIMO", "líder lança a própria escala (sem semana cumprida)", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.weekly_schedules (week_start,user_id,attraction) values ('2026-09-28','${L1}','x')`));
    return !r.error; }],
  ["LEGÍTIMO", "líder cria vaga pendente", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.job_requests (title,created_by) values ('vaga','${L1}')`));
    return !r.error; }],
  ["LEGÍTIMO", "avaliador anexa PDF na pasta da própria avaliação", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `insert into public.evaluation_documents (evaluation_id,kind,storage_path,uploaded_by) values ('${EV1}','assinado','${EV1}/doc.pdf','${L1}')`));
    return !r.error; }],
  ["LEGÍTIMO", "avaliador muda status/publica a avaliação", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `update public.evaluations set status='em_andamento', published_at=now() where id='${EV1}'`));
    return !r.error && (await db.query(`select status from public.evaluations where id='${EV1}'`)).rows[0].status === "em_andamento"; }],
  ["LEGÍTIMO", "responder NPS de pesquisa aberta (e reenviar)", async (db) => {
    const a = await ok(() => as(db, M1, "authenticated", `insert into public.nps_responses (survey_id,user_id,score) values ('${S_OPEN}','${M1}',9)`));
    const b = await ok(() => as(db, M1, "authenticated", `update public.nps_responses set score=10 where survey_id='${S_OPEN}' and user_id='${M1}'`));
    return !a.error && !b.error; }],
  ["LEGÍTIMO", "logado chama has_role/can_view_user_data (usado nas server functions)", async (db) => {
    const r = await ok(() => as(db, L1, "authenticated", `select public.has_role('${L1}','lider') a, public.can_view_user_data('${M1}','${L1}') b`));
    return !r.error && r.rows[0].a && r.rows[0].b; }],
  ["LEGÍTIMO", "servidor busca pré-cadastro (service role)", async (db) => {
    const r = await ok(() => as(db, null, "service_role", `select * from public.search_pre_registrations('elenco', 5)`));
    return !r.error && r.rows.length === 1; }],
  ["LEGÍTIMO", "conta criada pelo servidor com app_metadata vincula o pré-cadastro", async (db) => {
    const pre = (await db.query(`select id from public.pre_registrations where full_name='Elenco Novo'`)).rows[0].id;
    await db.query(`insert into auth.users (id,email,raw_user_meta_data,raw_app_meta_data) values ('${U(903)}','novo@x.com','{"full_name":"Elenco Novo"}','{"pre_registration_id":"${pre}"}')`);
    const p = (await db.query(`select attraction from public.profiles where id='${U(903)}'`)).rows[0];
    return p?.attraction === "TRUPE"; }],
  ["LEGÍTIMO", "líder lê atestado (storage) de membro do time; dono lê o próprio", async (db) => {
    await db.query(`update public.profiles set manager_id='${L1}' where id='${F1}'`);
    const a = await ok(() => as(db, L1, "authenticated", `select 1 from storage.objects where name='${F1}/b.pdf'`));
    const b = await ok(() => as(db, M1, "authenticated", `select 1 from storage.objects where name='${M1}/a.pdf'`));
    await db.query(`update public.profiles set manager_id='${L2}' where id='${F1}'`);
    return !a.error && a.rows.length === 1 && !b.error && b.rows.length === 1; }],
];

const results = [];
for (const [kind, name, fn] of tests) {
  const before = await fn(await fresh(false)).catch((e) => "erro: " + e.message);
  const after = await fn(await fresh(true)).catch((e) => "erro: " + e.message);
  results.push({ kind, name, before, after });
}
let fail = 0;
for (const r of results) {
  const good = r.kind === "ATAQUE" ? r.after === false : r.after === true;
  if (!good) fail++;
  console.log(`${good ? "PASSOU" : "FALHOU"} | ${r.kind.padEnd(8)} | antes: ${String(r.before).padEnd(5)} depois: ${String(r.after).padEnd(5)} | ${r.name}`);
}
console.log(`\n${results.length - fail}/${results.length} ok`);
process.exit(fail ? 1 : 0);
