"""Importa a planilha oficial de colaboradores/acessos (Ônyra, Era do Fogo, Ferrovia).

Uso:
  python3 scripts/importar_planilha_acessos.py PLANILHA.xlsx            # simulação (não grava nada)
  python3 scripts/importar_planilha_acessos.py PLANILHA.xlsx --aplicar  # grava

Precisa da migration 20261104120000_acessos_da_planilha.sql aplicada e do .env
com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Decisões de 04/11/2026:
  - "Marcos" = Marcos Vinicius da Cruz (admin, mantém acesso total)
  - Maria Antonia Stopassola é Hector Studios: não é tocada
  - Cassia Boeira (Hector Studios) fica como está: as linhas dela são ignoradas
  - Trupe e Hector Studios: nenhum dado alterado
  - Desligados da base antiga são desativados e bloqueados no Auth
  - Liberação manual de rede só fica para quem não está nas 3 casas (Trupe/HS);
    nas 3 casas, líder/gestor já passa pelo papel e elenco segue a trava
Não cria logins: quem ainda não tem conta fica no pré-cadastro com os dados
e os acessos pendentes; o acesso do líder vale assim que a conta for criada.
"""
import json, os, re, sys, unicodedata, urllib.request, urllib.parse, collections, datetime
import openpyxl

APLICAR = "--aplicar" in sys.argv
XLSX = [a for a in sys.argv[1:] if not a.startswith("--")][0]
ENV = {}
for line in open(os.path.join(os.path.dirname(__file__), "..", ".env"), encoding="utf-8"):
    if "=" in line and not line.startswith("#"):
        k, v = line.strip().split("=", 1); ENV[k] = v.strip().strip('"')
U, K = ENV["SUPABASE_URL"], ENV["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json"}

def req(method, path, body=None, prefer=None):
    h = dict(H)
    if prefer: h["Prefer"] = prefer
    r = urllib.request.Request(U + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        t = resp.read().decode()
        return json.loads(t) if t else None

def get_all(table, select="*"):
    out, off = [], 0
    while True:
        b = req("GET", f"/rest/v1/{table}?select={urllib.parse.quote(select)}&limit=1000&offset={off}")
        out += b
        if len(b) < 1000: return out
        off += 1000

def norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower().replace("...", "")).strip()

def d(v):
    return v.date().isoformat() if isinstance(v, datetime.datetime) else (str(v)[:10] if v else None)

CASA = {"Ônyra": "PIZZARIA ONYRA", "Era do Fogo": "ERA DO FOGO", "Ferrovia Secreta": "FERROVIA SECRETA"}
CASAS = set(CASA.values())
NAO_TOCAR = {"maria antonia stopassola da silva"}          # Hector Studios
LIDERES_IGNORADOS = {"cassia boeira da silva"}              # fica como está
APELIDOS = {"marcos": "marcos vinicius da cruz"}
DESLIGADOS = ["Dayane Vanessa Pereira Da...", "Giovanna da Silva Pinto", "Joseph Noah de Sousa Gomes",
              "Lucas Andrade da Silva", "Gabriel Pinto da Silva"]

wb = openpyxl.load_workbook(XLSX, data_only=True)
rows = list(wb["Base Colaboradores"].iter_rows(values_only=True))
hdr = rows[4]; base = [dict(zip(hdr, r)) for r in rows[5:] if r and r[1]]
arows = list(wb["Acessos App"].iter_rows(values_only=True))
acc = [dict(zip(arows[0], r)) for r in arows[1:] if r and r[0]]
resumo = {r[0]: r[3] for r in list(wb["Resumo por Líder"].iter_rows(values_only=True))[5:] if r and r[0]}

profiles = get_all("profiles", "id,full_name,attraction,email,birth_date,active,wifi_bypass")
users = []
page = 1
while True:
    b = req("GET", f"/auth/v1/admin/users?page={page}&per_page=1000")["users"]; users += b
    if len(b) < 1000: break
    page += 1
email_of = {u["id"]: (u.get("email") or "").lower() for u in users}
by_email = collections.defaultdict(set)
for p in profiles:
    for e in {email_of.get(p["id"], ""), (p.get("email") or "").lower()}:
        if e: by_email[e].add(p["id"])
pid_by_norm = collections.defaultdict(list)
for p in profiles: pid_by_norm[norm(p["full_name"])].append(p["id"])

def resolve(nome, email=None):
    n = APELIDOS.get(norm(nome), norm(nome))
    if email and len(by_email.get(email.lower(), ())) == 1: return next(iter(by_email[email.lower()]))
    if len(pid_by_norm.get(n, [])) == 1: return pid_by_norm[n][0]
    pref = [p["id"] for p in profiles if len(n) >= 10 and len(norm(p["full_name"])) >= 10
            and (norm(p["full_name"]).startswith(n) or n.startswith(norm(p["full_name"])))]
    return pref[0] if len(pref) == 1 else None

prof = {p["id"]: p for p in profiles}
member_pid = {}
for b in base:
    member_pid[b["Nome"]] = resolve(b["Nome"], (b["E-mail"] or "").strip() or None)
leader_pid = {L: resolve(L) for L in {a["Líder"] for a in acc}}
for L, pid in leader_pid.items():
    if not pid: sys.exit(f"Líder sem conta: {L}")

# 1) dados do perfil (só 3 casas, nunca Hector Studios/Trupe)
upd = []
for b in base:
    pid = member_pid[b["Nome"]]
    if not pid or norm(b["Nome"]) in NAO_TOCAR or prof[pid]["attraction"] not in CASAS: continue
    patch = {"whatsapp": b["WhatsApp"] or None, "admission_date": d(b["Data de admissão"]),
             "employee_code": str(b["Código"]) if b["Código"] is not None else None, "situacao": b["Situação"]}
    if not prof[pid].get("birth_date") and b["Data de nascimento"]: patch["birth_date"] = d(b["Data de nascimento"])
    upd.append((pid, patch))

# 2) acessos
pairs, pend = {}, {}
missing = [b for b in base if not member_pid[b["Nome"]]]
for a in acc:
    if norm(a["Líder"]) in LIDERES_IGNORADOS or norm(a["Colaborador"]) in NAO_TOCAR: continue
    lid, mid = leader_pid[a["Líder"]], member_pid.get(a["Colaborador"])
    if mid and mid != lid: pairs[(lid, mid)] = a["Motivo do acesso"]
    elif not mid: pend[(lid, a["Colaborador"])] = a["Motivo do acesso"]

# 3) pré-cadastros de quem não tem conta
pres = get_all("pre_registrations", "id,full_name,name_normalized,email,claimed_by")
pre_plan = []
for b in missing:
    n = norm(b["Nome"])
    cand = [x for x in pres if x["claimed_by"] is None and (norm(x["full_name"]).startswith(n[:20]) or n.startswith(norm(x["full_name"])))]
    data = {"full_name": b["Nome"], "email": (b["E-mail"] or "").strip().lower() or None, "cargo": b["Cargo"], "setor": b["Setor"],
            "negocio": CASA[b["Empresa"]], "whatsapp": b["WhatsApp"] or None, "admission_date": d(b["Data de admissão"]),
            "birth_date": d(b["Data de nascimento"]), "employee_code": str(b["Código"]), "situacao": b["Situação"],
            "lider_direto": b["Líder direto"]}
    pre_plan.append((cand[0]["id"] if cand else None, b["Nome"], data))

# 4) desligados e liberação manual de rede
desl = [p for p in profiles if p["full_name"] in DESLIGADOS]
tirar_bypass = [p for p in profiles if p.get("wifi_bypass") and p["attraction"] in CASAS]

print(f"Perfis com dados da planilha: {len(upd)}")
print(f"Pares de acesso: {len(pairs)} | pendentes (sem conta): {len(pend)}")
print(f"Pré-cadastros: {sum(1 for x in pre_plan if x[0])} atualizados, {sum(1 for x in pre_plan if not x[0])} novos ->", [x[1] for x in pre_plan if not x[0]])
print("Desativar:", [p["full_name"] for p in desl])
print("Tirar liberação manual de rede (3 casas):", [p["full_name"] for p in tirar_bypass])
cont = collections.Counter(l for l, _ in pairs); contp = collections.Counter(l for l, _ in pend)
print("\nConferência por líder (planilha x vai ver agora x pendente de conta):")
for L in sorted(resumo, key=lambda x: -resumo[x]):
    lid = leader_pid.get(L)
    ign = " (ignorado: fica como está)" if norm(L) in LIDERES_IGNORADOS else ""
    print(f"  {L:32s} planilha {resumo[L]:3d} | agora {cont.get(lid,0):3d} | pendente {contp.get(lid,0):2d}{ign}")

if not APLICAR:
    print("\nSIMULAÇÃO: nada foi gravado. Rode com --aplicar para gravar."); sys.exit(0)

for pid, patch in upd:
    req("PATCH", f"/rest/v1/profiles?id=eq.{pid}", patch, "return=minimal")
lideres = sorted({l for l, _ in pairs} | {l for l, _ in pend})
for lid in lideres:
    req("DELETE", f"/rest/v1/leader_access?leader_id=eq.{lid}&source=eq.planilha", None, "return=minimal")
    req("DELETE", f"/rest/v1/leader_access_pending?leader_id=eq.{lid}", None, "return=minimal")
req("POST", "/rest/v1/leader_access", [{"leader_id": l, "member_id": m, "motivo": mo, "source": "planilha"} for (l, m), mo in pairs.items()], "return=minimal")
pre_id_by_name = {}
for pre_id, nome, data in pre_plan:
    if pre_id:
        patch = {k: v for k, v in data.items() if k != "full_name" and v is not None}
        req("PATCH", f"/rest/v1/pre_registrations?id=eq.{pre_id}", patch, "return=minimal"); pre_id_by_name[nome] = pre_id
    else:
        r = req("POST", "/rest/v1/pre_registrations", {**data, "perfil": "ELENCO"}, "return=representation"); pre_id_by_name[nome] = r[0]["id"]
if pend:
    req("POST", "/rest/v1/leader_access_pending", [{"leader_id": l, "pre_registration_id": pre_id_by_name[n], "motivo": mo} for (l, n), mo in pend.items()], "return=minimal")
for p in desl:
    req("PATCH", f"/rest/v1/profiles?id=eq.{p['id']}", {"active": False}, "return=minimal")
    req("PUT", f"/auth/v1/admin/users/{p['id']}", {"ban_duration": "876000h"})
for p in tirar_bypass:
    req("PATCH", f"/rest/v1/profiles?id=eq.{p['id']}", {"wifi_bypass": False}, "return=minimal")

print("\nGravado. Conferência pelo banco (visible_user_ids):")
for L in sorted(resumo, key=lambda x: -resumo[x]):
    lid = leader_pid.get(L)
    vis = req("POST", "/rest/v1/rpc/visible_user_ids", {"_viewer_id": lid})
    vis3 = [v for v in vis if prof.get(v, {}).get("attraction") in CASAS]
    print(f"  {L:32s} planilha {resumo[L]:3d} | vê nas 3 casas {len(vis3):3d} | pendente {contp.get(lid,0):2d} | vê no total {len(vis)}")
