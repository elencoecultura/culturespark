// Catálogo de permissões: perfis, módulos do menu e ações, com o padrão de
// cada perfil. Usado pelo menu (o que aparece), pelo servidor (o que pode
// ser feito) e pela tela Permissões de Usuários. Relatórios e as telas de
// Admin não entram aqui: são só de Administrador e não se liberam por pessoa.

export type ProfileKey = "elenco" | "lider" | "gerente" | "direcao" | "admin";

export const PROFILES: { key: ProfileKey; label: string }[] = [
  { key: "elenco", label: "Colaborador" },
  { key: "lider", label: "Líder" },
  { key: "gerente", label: "Gestor" },
  { key: "direcao", label: "Diretor" },
  { key: "admin", label: "Administrador" },
];

export const EMPRESAS: { key: string; label: string }[] = [
  { key: "PIZZARIA ONYRA", label: "Ônyra" },
  { key: "ERA DO FOGO", label: "Era do Fogo" },
  { key: "FERROVIA SECRETA", label: "Ferrovia Secreta" },
  { key: "TRUPE", label: "Trupe" },
  { key: "HECTOR STUDIOS", label: "Hector Studios" },
  { key: "TODAS", label: "Todas" },
];

const EVERYONE = ["elenco", "lider", "gerente", "direcao", "admin"] as ProfileKey[];
const LEADERSHIP = ["lider", "gerente", "direcao", "admin"] as ProfileKey[];

export const MODULES: { key: string; label: string; defaults: ProfileKey[] }[] = [
  { key: "points", label: "Gamificação", defaults: EVERYONE },
  { key: "feedback", label: "Elogio Rápido", defaults: EVERYONE },
  { key: "iluminari", label: "Iluminari", defaults: EVERYONE },
  { key: "birthdays", label: "Aniversários", defaults: EVERYONE },
  { key: "celebracao", label: "Celebração da Magia", defaults: EVERYONE },
  { key: "bussola", label: "Bússola das Essências", defaults: EVERYONE },
  { key: "leader", label: "Liderança", defaults: LEADERSHIP },
  { key: "team", label: "Liderados", defaults: LEADERSHIP },
  { key: "evals", label: "Avaliações", defaults: LEADERSHIP },
  { key: "analytics", label: "Performance da gamificação", defaults: LEADERSHIP },
  { key: "vagas", label: "Vagas", defaults: LEADERSHIP },
  { key: "wellbeing-timeline", label: "Evolução do bem-estar", defaults: LEADERSHIP },
  { key: "disc-admin", label: "Bússola do time", defaults: LEADERSHIP },
  { key: "nps-results", label: "Resultados do NPS", defaults: ["gerente", "direcao", "admin"] },
];

export const ACTIONS: { key: string; label: string; defaults: ProfileKey[] }[] = [
  { key: "ver_perfil", label: "Ver perfil dos liderados", defaults: LEADERSHIP },
  { key: "avaliar", label: "Avaliar", defaults: LEADERSHIP },
  { key: "reconhecer", label: "Reconhecer (Elogio Rápido)", defaults: EVERYONE },
  { key: "celebrar", label: "Felicitar na Celebração da Magia", defaults: EVERYONE },
  { key: "editar_escala", label: "Editar escala e semana cumprida", defaults: LEADERSHIP },
];

export const MODULE_KEYS = new Set(MODULES.map((m) => m.key));

const ROLE_ALIASES: Record<string, ProfileKey> = { leader: "lider", messenger: "elenco" };

export function normalizeRoles(roles: string[]): Set<ProfileKey> {
  return new Set(roles.map((r) => (ROLE_ALIASES[r] ?? r) as ProfileKey));
}

// Perfil principal (o mais alto) para exibir e editar.
export function mainProfile(roles: string[]): ProfileKey {
  const r = normalizeRoles(roles);
  for (const k of ["admin", "direcao", "gerente", "lider"] as ProfileKey[]) if (r.has(k)) return k;
  return "elenco";
}

export type Overrides = Record<string, boolean>; // "module:x" | "action:y" -> liberado?

export function can(
  kind: "module" | "action",
  key: string,
  roles: string[],
  overrides: Overrides = {},
): boolean {
  const r = normalizeRoles(roles);
  if (r.has("admin")) return true;
  // Fora do catálogo (Relatórios, telas de Admin) só admin, sem exceção.
  const list = kind === "module" ? MODULES : ACTIONS;
  const item = list.find((x) => x.key === key);
  if (!item) return false;
  const o = overrides[`${kind}:${key}`];
  if (typeof o === "boolean") return o;
  return item.defaults.some((p) => r.has(p));
}
