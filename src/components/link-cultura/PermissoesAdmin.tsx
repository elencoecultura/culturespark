import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  History,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/lib/confirm";
import {
  ACTIONS,
  EMPRESAS,
  MODULES,
  PROFILES,
  can,
  type ProfileKey,
} from "@/lib/permissions-catalog";
import {
  getUserPermissions,
  listPermissionAudit,
  previewUserVisibility,
  restoreDefaultPermissions,
  saveUserPermissions,
  searchUsersForPermissions,
} from "@/lib/permissions.functions";

// Permissões de Usuários (somente Administrador): empresas e setores, pessoas
// específicas, módulos e ações, perfil e liberação manual de rede. Prévia de
// "quem esta pessoa vê" antes de salvar, "Restaurar padrão" (planilha base)
// e histórico de alterações.

const empresaLabel = (k: string | null | undefined) =>
  EMPRESAS.find((e) => e.key === k)?.label ?? k ?? "—";
const profileLabel = (k: string) => PROFILES.find((p) => p.key === k)?.label ?? k;
const chip = (on: boolean) =>
  cn(
    "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
    on ? "bg-white text-blu" : "glass-chip text-white/80",
  );

type Scope = { empresa: string; setor: string };
type Tri = "padrao" | "sim" | "nao";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-soft mt-4 rounded-[24px] p-4 text-white">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
        {title}
      </div>
      {children}
    </div>
  );
}

function Editor({ userId, onBack }: { userId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getUserPermissions);
  const { data, isLoading } = useQuery({
    queryKey: ["perm", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
  });

  const [profile, setProfile] = useState<ProfileKey>("elenco");
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [people, setPeople] = useState<
    { id: string; full_name?: string; attraction?: string | null }[]
  >([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [wifi, setWifi] = useState(false);
  const [preview, setPreview] = useState<{
    key: string;
    total: number;
    people: { id: string; full_name: string; attraction: string | null; setor: string | null }[];
  } | null>(null);
  const [addQuery, setAddQuery] = useState("");

  useEffect(() => {
    if (!data) return;
    setProfile(data.profile as ProfileKey);
    setScopes(data.scopes);
    setPeople(
      data.people.map((p: any) => ({ id: p.id, full_name: p.full_name, attraction: p.attraction })),
    );
    setOverrides(data.overrides);
    setWifi(!!data.user.wifi_bypass);
    setPreview(null);
  }, [data]);

  const config = useMemo(
    () => ({
      user_id: userId,
      profile,
      scopes,
      people: people.map((p) => p.id),
      overrides,
      wifi_bypass: wifi,
    }),
    [userId, profile, scopes, people, overrides, wifi],
  );
  const configKey = JSON.stringify({ profile, scopes, people: config.people.slice().sort() });

  const previewFn = useServerFn(previewUserVisibility);
  const runPreview = useMutation({
    mutationFn: () =>
      previewFn({ data: { user_id: userId, profile, scopes, people: config.people } }),
    onSuccess: (r) => setPreview({ key: configKey, ...r }),
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });
  useEffect(() => {
    if (data && !preview) runPreview.mutate();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveFn = useServerFn(saveUserPermissions);
  const save = useMutation({
    mutationFn: () => saveFn({ data: config as any }),
    onSuccess: () => {
      toast.success("Permissões salvas");
      qc.invalidateQueries({ queryKey: ["perm", userId] });
      qc.invalidateQueries({ queryKey: ["perm-audit", userId] });
      qc.invalidateQueries({ queryKey: ["perm-search"] });
    },
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });

  const restoreFn = useServerFn(restoreDefaultPermissions);
  const restore = useMutation({
    mutationFn: () => restoreFn({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Padrão restaurado", {
        description: "Pessoas da planilha base, sem exceções individuais.",
      });
      qc.invalidateQueries({ queryKey: ["perm", userId] });
      qc.invalidateQueries({ queryKey: ["perm-audit", userId] });
    },
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });

  const searchFn = useServerFn(searchUsersForPermissions);
  const { data: addResults } = useQuery({
    queryKey: ["perm-search", "add", addQuery],
    queryFn: () => searchFn({ data: { q: addQuery } }),
    enabled: addQuery.trim().length >= 2,
  });

  const auditFn = useServerFn(listPermissionAudit);
  const { data: auditRows } = useQuery({
    queryKey: ["perm-audit", userId],
    queryFn: () => auditFn({ data: { user_id: userId } }),
  });

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-20 text-white/70">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isAdminProfile = profile === "admin";
  const hasEmpresa = (e: string) => scopes.some((s) => s.empresa === e);
  const toggleEmpresa = (e: string) =>
    setScopes((cur) =>
      hasEmpresa(e) ? cur.filter((s) => s.empresa !== e) : [...cur, { empresa: e, setor: "" }],
    );
  const toggleSetor = (e: string, setor: string) =>
    setScopes((cur) => {
      const others = cur.filter((s) => s.empresa !== e);
      const mine = cur.filter((s) => s.empresa === e && s.setor);
      const has = mine.some((s) => s.setor === setor);
      const next = has ? mine.filter((s) => s.setor !== setor) : [...mine, { empresa: e, setor }];
      return [...others, ...(next.length ? next : [{ empresa: e, setor: "" }])];
    });
  const triOf = (key: string): Tri =>
    key in overrides ? (overrides[key] ? "sim" : "nao") : "padrao";
  const setTri = (key: string, v: Tri) =>
    setOverrides((cur) => {
      const n = { ...cur };
      if (v === "padrao") delete n[key];
      else n[key] = v === "sim";
      return n;
    });
  const previewStale = !preview || preview.key !== configKey;
  const defaultSet = new Set(data.defaultPeople);
  const extra = people.filter((p) => !defaultSet.has(p.id)).length;
  const missing = data.defaultPeople.filter(
    (id: string) => !people.some((p) => p.id === id),
  ).length;

  return (
    <>
      <button
        onClick={onBack}
        className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
      >
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="mt-3 px-1 text-white">
        <h1 className="font-display text-[22px] font-black tracking-[-0.03em]">
          {data.user.full_name}
        </h1>
        <p className="text-[12.5px] text-white/65">
          {empresaLabel(data.user.attraction)}
          {data.user.setor ? ` · ${data.user.setor}` : ""}
          {data.user.role_title ? ` · ${data.user.role_title}` : ""}
        </p>
      </div>

      <Section title="Perfil">
        <div className="flex flex-wrap gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.key}
              onClick={() => setProfile(p.key)}
              className={chip(profile === p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isAdminProfile && (
          <p className="mt-2 text-[11.5px] text-white/60">
            Administrador vê todo mundo e tem todos os módulos, inclusive Relatórios.
          </p>
        )}
      </Section>

      {!isAdminProfile && (
        <Section title="Empresas e setores (vê todas as pessoas)">
          <div className="flex flex-wrap gap-2">
            {EMPRESAS.map((e) => (
              <button
                key={e.key}
                onClick={() => toggleEmpresa(e.key)}
                className={chip(hasEmpresa(e.key))}
              >
                {e.label}
              </button>
            ))}
          </div>
          {scopes
            .map((s) => s.empresa)
            .filter((e, i, a) => a.indexOf(e) === i && e !== "TODAS")
            .map((e) => (
              <div key={e} className="mt-3">
                <div className="text-[11.5px] text-white/60">
                  Setores de {empresaLabel(e)} (nenhum marcado = empresa toda)
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(data.sectorsByEmpresa[e] ?? []).map((setor: string) => (
                    <button
                      key={setor}
                      onClick={() => toggleSetor(e, setor)}
                      className={chip(scopes.some((s) => s.empresa === e && s.setor === setor))}
                    >
                      {setor}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </Section>
      )}

      {!isAdminProfile && (
        <Section title={`Pessoas específicas (${people.length})`}>
          {(extra > 0 || missing > 0) && (
            <p className="mb-2 text-[11.5px] text-amber-200/90">
              Diferente da planilha base: {extra} a mais, {missing} a menos.
            </p>
          )}
          <div className="glass-input flex items-center gap-2 rounded-2xl px-3 py-2.5">
            <UserPlus className="h-4 w-4 text-white/50" />
            <input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Adicionar pessoa pelo nome"
              className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
            />
          </div>
          {addQuery.trim().length >= 2 && (
            <div className="mt-2 grid gap-1.5">
              {(addResults ?? [])
                .filter((r: any) => r.id !== userId && !people.some((p) => p.id === r.id))
                .slice(0, 8)
                .map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setPeople((cur) => [
                        ...cur,
                        { id: r.id, full_name: r.full_name, attraction: r.attraction },
                      ]);
                      setAddQuery("");
                    }}
                    className="glass-chip flex items-center justify-between rounded-xl px-3 py-2 text-left text-[12.5px]"
                  >
                    <span className="truncate">{r.full_name}</span>
                    <span className="shrink-0 text-white/55">{empresaLabel(r.attraction)}</span>
                  </button>
                ))}
            </div>
          )}
          <div className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
            {people
              .slice()
              .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3 py-2 text-[12.5px]"
                >
                  <span className="min-w-0 truncate">
                    {p.full_name ?? p.id}
                    <span className="text-white/50"> · {empresaLabel(p.attraction)}</span>
                    {!defaultSet.has(p.id) && (
                      <span className="ml-1 text-amber-200/90">(manual)</span>
                    )}
                  </span>
                  <button
                    onClick={() => setPeople((cur) => cur.filter((x) => x.id !== p.id))}
                    className="shrink-0 text-white/60"
                    aria-label="Remover"
                  >
                    <UserMinus size={15} />
                  </button>
                </div>
              ))}
            {people.length === 0 && (
              <p className="text-[12px] text-white/55">Nenhuma pessoa específica.</p>
            )}
          </div>
        </Section>
      )}

      {!isAdminProfile && (
        <Section title="Módulos e ações">
          {[
            { title: "Módulos visíveis", kind: "module" as const, items: MODULES },
            { title: "Ações permitidas", kind: "action" as const, items: ACTIONS },
          ].map((g) => (
            <div key={g.kind} className="mb-3 last:mb-0">
              <div className="mb-1.5 text-[12px] font-semibold text-white/80">{g.title}</div>
              <div className="grid gap-1.5">
                {g.items.map((it) => {
                  const key = `${g.kind}:${it.key}`;
                  const t = triOf(key);
                  const padrao = can(g.kind, it.key, [profile], {});
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.05] px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-[12.5px]">{it.label}</span>
                      <div className="flex shrink-0 gap-1">
                        {(["padrao", "sim", "nao"] as Tri[]).map((v) => (
                          <button
                            key={v}
                            onClick={() => setTri(key, v)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
                              t === v ? "bg-white text-blu" : "bg-white/10 text-white/70",
                            )}
                          >
                            {v === "padrao"
                              ? `Padrão (${padrao ? "sim" : "não"})`
                              : v === "sim"
                                ? "Liberar"
                                : "Bloquear"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-white/55">
            Relatórios e as telas de Admin são só de Administrador e não aparecem aqui.
          </p>
        </Section>
      )}

      <Section title="Rede Wi-Fi">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[12.5px]">
            <div className="flex items-center gap-1.5 font-semibold">
              <Wifi size={14} />{" "}
              {data.wifiAuto
                ? "Entra de qualquer rede (pelo perfil ou por ser da Trupe)"
                : "Segue a trava de rede"}
            </div>
            <div className="mt-0.5 text-white/60">Liberação manual (exceção):</div>
          </div>
          <button onClick={() => setWifi((v) => !v)} className={chip(wifi)}>
            {wifi ? "Liberado" : "Não"}
          </button>
        </div>
      </Section>

      <Section title={`Quem esta pessoa vê${preview ? `: ${preview.total}` : ""}`}>
        <button
          onClick={() => runPreview.mutate()}
          disabled={runPreview.isPending}
          className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
        >
          {runPreview.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Eye size={13} />
          )}{" "}
          Atualizar prévia
        </button>
        {previewStale && preview && (
          <p className="mt-2 text-[11.5px] text-amber-200/90">
            Você mudou a configuração: atualize a prévia antes de salvar.
          </p>
        )}
        {preview && (
          <div className="mt-3 grid max-h-72 gap-1 overflow-y-auto pr-1 text-[12px]">
            {preview.people
              .slice()
              .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5"
                >
                  <span className="truncate">{p.full_name}</span>
                  <span className="shrink-0 text-white/50">
                    {empresaLabel(p.attraction)}
                    {p.setor ? ` · ${p.setor}` : ""}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() =>
            confirmAction(
              "Restaurar o padrão da planilha? Exceções individuais desta pessoa serão apagadas.",
              () => restore.mutate(),
              {
                confirmLabel: "Restaurar",
              },
            )
          }
          disabled={restore.isPending}
          className="glass-chip inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold text-white"
        >
          <RotateCcw size={15} /> Restaurar padrão
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || previewStale}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-grad py-3 text-[13px] font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {save.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ShieldCheck size={15} />
          )}{" "}
          Salvar
        </button>
      </div>

      <Section title="Histórico de alterações">
        <div className="grid gap-2">
          {(auditRows ?? []).map((a: any) => (
            <div key={a.id} className="rounded-xl bg-white/[0.05] px-3 py-2 text-[12px]">
              <div className="flex items-center gap-1.5 font-semibold">
                <History size={13} /> {a.field}
              </div>
              <div className="mt-0.5 text-white/60">
                {a.changed_by_name} · {new Date(a.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="mt-1 break-words text-[11px] text-white/70">
                antes: {JSON.stringify(a.before)} → depois: {JSON.stringify(a.after)}
              </div>
            </div>
          ))}
          {(auditRows ?? []).length === 0 && (
            <p className="text-[12px] text-white/55">Nenhuma alteração registrada.</p>
          )}
        </div>
      </Section>
    </>
  );
}

export default function PermissoesAdmin() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const searchFn = useServerFn(searchUsersForPermissions);
  const { data, isLoading } = useQuery({
    queryKey: ["perm-search", query],
    queryFn: () => searchFn({ data: { q: query } }),
  });

  if (selected) return <Editor userId={selected} onBack={() => setSelected(null)} />;

  return (
    <>
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <ShieldCheck size={13} /> Admin
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">
          Permissões de Usuários
        </h1>
        <p className="text-[12.5px] text-white/65">
          Empresas, setores, pessoas, módulos, ações e perfil de cada usuário.
        </p>
      </div>
      <div className="glass-input mt-4 flex items-center gap-2 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 text-white/50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar pelo nome"
          className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
        />
      </div>
      <div className="mt-3 grid gap-2">
        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/60" />}
        {(data ?? []).map((u: any) => (
          <button
            key={u.id}
            onClick={() => setSelected(u.id)}
            className="glass-chip flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-white"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{u.full_name || "Sem nome"}</span>
              <span className="block truncate text-[11.5px] text-white/60">
                {empresaLabel(u.attraction)}
                {u.setor ? ` · ${u.setor}` : ""}
                {u.active ? "" : " · inativo"}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em]">
              {profileLabel(u.profile)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
