import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { read, utils } from "xlsx";
import { Loader2, Upload, Trash2, FileSpreadsheet, Check, X, Search, Users, UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import {
  importPreRegistrations,
  listPreRegistrations,
  deletePreRegistration,
  createAccountForPreRegistration,
} from "@/lib/pre-registration.functions";

type Row = {
  full_name: string;
  email?: string | null;
  cargo?: string | null;
  setor?: string | null;
  perfil: string;
  negocio: string;
};

const PERFIL_VALUES = new Set(["ELENCO", "LÍDER", "LIDER", "GERENTE", "DIREÇÃO", "DIRECAO", "ADMIN"]);

function normalizeHeader(h: string) {
  return String(h ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function pickKey(obj: Record<string, unknown>, candidates: string[]) {
  const norm = Object.fromEntries(Object.keys(obj).map((k) => [normalizeHeader(k), k]));
  for (const c of candidates) {
    const k = norm[normalizeHeader(c)];
    if (k && obj[k] != null && String(obj[k]).trim() !== "") return String(obj[k]).trim();
  }
  return "";
}

function parseSheet(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const rows: Row[] = [];
        for (const raw of json) {
          const full_name = pickKey(raw, ["NOME", "Nome", "name", "full_name"]);
          if (!full_name) continue;
          const perfilRaw = pickKey(raw, ["PERFIL", "perfil", "nivel", "Nível"]).toUpperCase();
          const perfil = PERFIL_VALUES.has(perfilRaw) ? perfilRaw : "ELENCO";
          const negocio = pickKey(raw, ["EMPRESA", "NEGOCIO", "Negócio", "negocio", "Empresa"]) || "TODOS";
          rows.push({
            full_name,
            email: pickKey(raw, ["EMAIL", "E-MAIL", "email"]) || null,
            cargo: pickKey(raw, ["CARGO", "cargo", "FUNCAO", "Função"]) || null,
            setor: pickKey(raw, ["TIPO", "SETOR", "setor", "tipo"]) || null,
            perfil,
            negocio: negocio.trim(),
          });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

type PreRegRowData = {
  id: string;
  full_name: string;
  email?: string | null;
  cargo?: string | null;
  setor?: string | null;
  perfil: string;
  negocio: string;
  claimed_by?: string | null;
};

function genPassword() {
  const words = ["Fenix", "Aurora", "Celeste", "Magia", "Estrela", "Portal"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}!`;
}

function PreRegRow({ row: r, onDelete }: { row: PreRegRowData; onDelete: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAccountForPreRegistration);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(r.email ?? "");
  const [password, setPassword] = useState(() => genPassword());
  const [showPass, setShowPass] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { pre_registration_id: r.id, email: email.trim().toLowerCase(), password } }),
    onSuccess: () => {
      toast.success(`Conta criada para ${r.full_name}`, {
        description: `Repasse o email e a senha por um canal direto (WhatsApp, etc). ${email} · ${password}`,
      });
      qc.invalidateQueries({ queryKey: ["pre-regs"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Não rolou criar a conta", { description: e.message }),
  });

  return (
    <div className="glass-chip rounded-2xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-white">{r.full_name}</span>
            {r.claimed_by ? (
              <span className="rounded-full bg-magic-green/20 px-2 py-0.5 text-[10px] font-semibold text-magic-green">
                cadastrado
              </span>
            ) : (
              <span className="rounded-full bg-magic-amber/20 px-2 py-0.5 text-[10px] font-semibold text-magic-amber">
                pendente
              </span>
            )}
          </div>
          <div className="truncate text-[11.5px] text-white/65">
            {r.perfil} · {r.cargo ?? "—"} · {r.setor ?? "—"} · {r.negocio}
            {r.email ? ` · ${r.email}` : ""}
          </div>
        </div>
        {!r.claimed_by && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/20"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Criar conta
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-magic-red/30 hover:text-white"
          aria-label="Apagar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && !r.claimed_by && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/15 bg-white/5 p-3">
          <label className="block">
            <span className="ml-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@email.com"
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/40"
            />
          </label>
          <label className="block">
            <span className="ml-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Senha
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-[13px] text-white outline-none"
              />
              <button type="button" onClick={() => setShowPass((v) => !v)} className="shrink-0 text-white/60">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPassword(genPassword())}
              className="text-[11.5px] text-celeste underline-offset-4 hover:underline"
            >
              gerar outra senha
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white hover:bg-white/20"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={create.isPending || !email.includes("@") || password.length < 6}
                onClick={() => create.mutate()}
                className="flex items-center gap-1.5 rounded-full bg-magic-green px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreRegistrationsAdmin() {
  const qc = useQueryClient();
  const importFn = useServerFn(importPreRegistrations);
  const listFn = useServerFn(listPreRegistrations);
  const deleteFn = useServerFn(deletePreRegistration);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [query, setQuery] = useState("");
  const [negFilter, setNegFilter] = useState<string>("");

  const list = useQuery({ queryKey: ["pre-regs"], queryFn: () => listFn() });

  const imp = useMutation({
    mutationFn: (rows: Row[]) => importFn({ data: { rows, replaceAll } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["pre-regs"] });
      const parts = [
        `${res.inserted} novos`,
        `${res.updated} atualizados`,
        `${res.unchanged ?? 0} sem mudança`,
      ];
      if ((res.skipped ?? 0) > 0) parts.push(`${res.skipped} ignorados`);
      toast.success("Pré-cadastro sincronizado", { description: parts.join(" · ") });
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => toast.error("Falha no import", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre-regs"] }),
  });

  async function onFile(f: File) {
    setParsing(true);
    try {
      const rows = await parseSheet(f);
      if (!rows.length) {
        toast.error("Nada para importar", { description: "A planilha não tem linhas válidas." });
        return;
      }
      setPreview(rows);
    } catch (e) {
      toast.error("Não consegui ler a planilha", {
        description: e instanceof Error ? e.message : "Formato inválido",
      });
    } finally {
      setParsing(false);
    }
  }

  const negocios = useMemo(() => {
    const s = new Set<string>();
    (list.data ?? []).forEach((r) => r.negocio && s.add(r.negocio));
    return Array.from(s).sort();
  }, [list.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data ?? []).filter((r) => {
      if (negFilter && r.negocio !== negFilter) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.cargo, r.setor, r.perfil, r.negocio]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [list.data, query, negFilter]);

  const claimed = (list.data ?? []).filter((r) => r.claimed_by).length;

  return (
    <div className="space-y-4">
      {/* Upload card */}
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <FileSpreadsheet className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Pré-cadastro do elenco</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          Suba a planilha mestre (.xlsx) com NOME, CARGO, TIPO, PERFIL e EMPRESA. Quando a pessoa
          fizer o cadastro, o nível dela já vem certo automaticamente.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-semibold text-blu disabled:opacity-60"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Escolher planilha
          </button>
          <label className="flex items-center gap-2 text-[12.5px] text-white/80">
            <input
              type="checkbox"
              checked={replaceAll}
              onChange={(e) => setReplaceAll(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            <span>
              Apagar pendentes não reivindicados antes de importar
              <span className="ml-1 text-[11px] text-magic-amber/80">(destrutivo)</span>
            </span>
          </label>
        </div>
        <p className="mt-2 text-[11.5px] text-white/55">
          Reimportar a planilha não duplica ninguém: cadastros existentes são atualizados pelo email ou pelo nome.
        </p>

        {preview && (
          <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-white/85">
                <span className="font-semibold text-white">{preview.length}</span> linhas detectadas
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={imp.isPending}
                  onClick={() => imp.mutate(preview)}
                  className="flex items-center gap-1.5 rounded-full bg-magic-green px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-60"
                >
                  {imp.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirmar import
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-56 overflow-auto rounded-xl bg-black/20 p-2 text-[11px] font-mono text-white/80">
              {preview.slice(0, 12).map((r, i) => (
                <div key={i} className="truncate">
                  {r.full_name} · {r.cargo ?? "—"} · {r.setor ?? "—"} · {r.perfil} · {r.negocio}
                </div>
              ))}
              {preview.length > 12 && <div className="opacity-60">…e mais {preview.length - 12}</div>}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-[12px] text-white/60">
          <Users className="h-3.5 w-3.5" />
          {list.data?.length ?? 0} no mestre · {claimed} já criaram conta · {(list.data?.length ?? 0) - claimed} pendentes
        </div>
      </div>

      {/* Filters */}
      <div className="glass-chip flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
          <Search className="h-4 w-4 text-white/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nome, cargo, email…"
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
        <select
          value={negFilter}
          onChange={(e) => setNegFilter(e.target.value)}
          className="rounded-xl bg-white/5 px-3 py-2 text-[13px] text-white [&>option]:bg-blu"
        >
          <option value="">Todos negócios</option>
          {negocios.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {list.isLoading && (
          <div className="grid place-items-center py-6">
            <Loader2 className="animate-spin text-white/50" />
          </div>
        )}
        {!list.isLoading && filtered.length === 0 && (
          <div className="glass-chip rounded-2xl p-4 text-center text-[13px] text-white/70">
            Nada por aqui. Suba a planilha para começar.
          </div>
        )}
        {filtered.map((r) => (
          <PreRegRow
            key={r.id}
            row={r}
            onDelete={() => confirmAction(`Apagar pré-cadastro de ${r.full_name}?`, () => del.mutate(r.id))}
          />
        ))}
      </div>
    </div>
  );
}
