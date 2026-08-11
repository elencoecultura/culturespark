# Component Style Guide

Snippets prontos para um novo app no mesmo padrão visual.
Todos assumem Tailwind v4 + tokens definidos em `src/styles.css`
(ver `IMPLEMENTATION_CHECKLIST.md`).

---

## Layout principal (mobile-first)

**Quando usar:** wrapper padrão de qualquer tela.

```tsx
<LiquidBackground>
  <main className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6 pb-10 pt-14">
    {/* conteúdo */}
  </main>
</LiquidBackground>
```

`LiquidBackground` aplica `bg-aurora` em fixed e desenha 2–3 blobs animados
com `blob-anim` para movimento ambiente sutil.

---

## Header / topbar

```tsx
<header className="flex items-center justify-between">
  <img src={logo} alt="Marca" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
  <button className="glass-chip rounded-full p-2"><Bell size={18} /></button>
</header>

<h1 className="mt-8 font-display text-[34px] font-black leading-[0.95] tracking-[-0.04em] text-white text-balance">
  Olá, Maria
</h1>
<p className="mt-2 text-[14px] text-white/75">Pronta pra começar o dia?</p>
```

---

## Sidebar / menu (quando existir desktop)

Use `shadcn/sidebar` com `collapsible="icon"`, mas troque as superfícies por
`glass-soft` e mantenha o background `bg-aurora` no shell. Itens ativos com
`bg-white/15` e borda esquerda `border-l-2 border-pink`.

---

## Card / painel

**Quando usar:** qualquer agrupamento de conteúdo flutuando no fundo.

```tsx
<section className="glass-strong rounded-[32px] p-6">
  <h2 className="font-display text-[22px] font-bold tracking-tight text-white">Cultura da semana</h2>
  <p className="mt-1 text-[13px] text-white/70">Quatro gestos pra encantar.</p>
  {/* … */}
</section>
```

Variante compacta: `glass-soft rounded-3xl p-4`.

---

## Botão primário

```tsx
<button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-[15px] font-semibold tracking-[0.01em] text-blu shadow-glow transition active:scale-[0.98] disabled:opacity-70">
  Continuar <ArrowRight size={18} strokeWidth={2.4} />
</button>
```

Regra: **um único primário por tela**.

## Botão secundário

```tsx
<button className="glass-chip rounded-2xl px-4 py-3 text-[14px] font-medium text-white">
  Voltar
</button>
```

## Botão fantasma / link

```tsx
<button className="text-[13px] font-medium text-white/70 underline-offset-4 hover:underline">
  Esqueci minha senha
</button>
```

---

## Formulário + Input

```tsx
<form className="glass-strong mt-10 rounded-[32px] p-6">
  <label className="block">
    <span className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
      E-mail
    </span>
    <div className="glass-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <Mail size={18} className="shrink-0 text-white/60" />
      <input
        type="email"
        className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
        placeholder="voce@empresa.com"
      />
    </div>
  </label>
</form>
```

Erro de campo: linha abaixo do input em `text-[12px] text-magic-red`.

---

## Tabela

Tabelas pesadas não combinam com glass. Quando necessário, prefira **listas em
cards** (uma linha = um `glass-soft rounded-2xl p-4 flex items-center gap-3`).
Se for tabela real, use shadcn `Table` dentro de um modal/superfície clara.

---

## Badge / status

```tsx
<span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
  Novo
</span>

<span className="inline-flex items-center rounded-full border border-[#24d18b]/45 bg-[#24d18b]/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#24d18b]">
  Concluído
</span>
```

Cores de estado: `magic-green`, `magic-amber`, `magic-red` (ver tokens).

---

## Modal

Use `shadcn/dialog`. O conteúdo do modal usa a superfície clara
(`bg-card text-card-foreground`) para alto contraste com o aurora atrás. Manter
`rounded-2xl`, padding `p-6`, título em `font-display`.

---

## Estado vazio

```tsx
<div className="glass-soft mx-auto mt-12 max-w-[320px] rounded-[28px] p-8 text-center">
  <Sparkles size={28} className="mx-auto text-white/70" />
  <h3 className="mt-4 font-display text-[20px] font-bold tracking-tight text-white">
    Ainda não tem nada por aqui
  </h3>
  <p className="mt-2 text-[13px] text-white/65">
    Quando a primeira ação acontecer, ela aparece aqui.
  </p>
</div>
```

---

## Loading

- Inline em botões: `<Loader2 className="animate-spin" size={18} />`
- Tela cheia: usar `<Skeleton />` do shadcn com classe `bg-white/10 rounded-2xl`.
- Nunca usar spinner sozinho centralizado sem moldura — ele se perde no aurora.

---

## Toasts (sonner)

Já configurado no `__root.tsx`. Convenções:

```ts
toast.success("Bem-vindo de volta");
toast.error("Não rolou entrar", { description: "Verifique e-mail e senha." });
toast.message("Salvando…");
```

Tom curto, humano. Ver `COPYWRITING_GUIDE.md`.

---

## Footer eyebrow

```tsx
<p className="mt-auto pt-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
  Marca · Produto
</p>
```
