# Implementation Checklist

Como replicar o padrão visual + textual num novo app.

> Stack assumida: TanStack Start + Vite + Tailwind v4 + shadcn-ui (mesma
> base deste projeto). Para outra stack, adaptar a sintaxe — os tokens são
> os mesmos.

---

## 0. Antes de começar

- [ ] Definir nome do produto (substitui “Encantômetro”).
- [ ] Decidir se o app é mobile-first (recomendado: sim, `max-w-[430px]`)
      ou também desktop (manter container central).
- [ ] Copiar para o novo repositório:
  - `design-tokens.json`
  - `DESIGN_SYSTEM_EXPORT.md`
  - `COMPONENT_STYLE_GUIDE.md`
  - `COPYWRITING_GUIDE.md`

## 1. Fontes

Carregar **no `<head>`**, nunca via `@import` remoto em `styles.css`.

`src/routes/__root.tsx` → `head().links`:

```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{ rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" },
// Display: panel-sans via Adobe Typekit (substituir kit id se houver outro)
{ rel: "preconnect", href: "https://use.typekit.net" },
{ rel: "stylesheet", href: "https://use.typekit.net/vns5oby.css" },
```

> Sem acesso ao kit `panel-sans`? Use uma serif/sans display alternativa
> com o mesmo peso (ex.: `"Fraunces", serif` 900 com `tracking -0.04em`).

## 2. `src/styles.css`

Colar este bloco no topo (depois ajustar conforme necessário):

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-papel: #efefea;
  --color-celeste: #6ad1e3;
  --color-blu: #1a2891;
  --color-pink: #e451f5;
  --color-ink: #071038;
  --color-muted-ink: #65708a;
  --color-magic-green: #24d18b;
  --color-magic-amber: #ffca55;
  --color-magic-red: #ff5c7a;
  --font-display: "panel-sans", "Panel", Georgia, serif;
  --font-sans: "Montserrat", ui-sans-serif, system-ui, -apple-system, sans-serif;
}

/* (incluir bloco @theme inline com tokens semânticos do shadcn — ver styles.css de referência) */

:root {
  --radius: 0.625rem;
  /* semantic oklch tokens — copiar tal qual do design-tokens.json */

  --brand-grad: linear-gradient(135deg,#6ad1e3 0%,#7d7dff 34%,#e451f5 70%,#1a2891 100%);
  --blue-grad:  linear-gradient(145deg,#1a2891 0%,#263dd1 54%,#6ad1e3 120%);
  --pink-grad:  linear-gradient(145deg,#e451f5 0%,#8a68ff 42%,#6ad1e3 100%);
  --aurora-bg:
    radial-gradient(120% 80% at 20% 0%,  #4b3bd8 0%, transparent 55%),
    radial-gradient(110% 80% at 90% 10%, #e451f5 0%, transparent 50%),
    radial-gradient(120% 80% at 50% 100%,#6ad1e3 0%, transparent 55%),
    linear-gradient(180deg,#0a0f3a 0%,#1a2891 60%,#2a1d6b 100%);

  --shadow-glass: 0 30px 60px -20px rgba(7,16,56,.55), 0 8px 24px -10px rgba(7,16,56,.35);
  --shadow-soft:  0 18px 50px rgba(7,16,56,.30);
  --shadow-glow:  0 0 40px rgba(228,81,245,.35);
  --glass-stroke: rgba(255,255,255,.22);
  --glass-highlight: inset 0 1px 0 rgba(255,255,255,.4), inset 0 -1px 0 rgba(255,255,255,.06);
}

@layer base {
  * { border-color: var(--color-border); -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0; min-height: 100%; color: #fff;
    font-family: var(--font-sans);
    background: var(--aurora-bg);
    background-attachment: fixed;
    -webkit-font-smoothing: antialiased;
  }
}

@utility glass-soft   { border:1px solid var(--glass-stroke); background:rgba(255,255,255,.08);
  backdrop-filter:blur(28px) saturate(180%); box-shadow:var(--shadow-glass), var(--glass-highlight); }
@utility glass-strong { border:1px solid rgba(255,255,255,.3); background:rgba(255,255,255,.16);
  backdrop-filter:blur(34px) saturate(190%); box-shadow:var(--shadow-glass), var(--glass-highlight); }
@utility glass-chip   { border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.12);
  backdrop-filter:blur(18px) saturate(170%); box-shadow:var(--glass-highlight); }
@utility glass-input  { border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08);
  backdrop-filter:blur(20px); color:#fff; }
@utility bg-brand-grad { background: var(--brand-grad); }
@utility bg-blue-grad  { background: var(--blue-grad); }
@utility bg-pink-grad  { background: var(--pink-grad); }
@utility bg-aurora     { background: var(--aurora-bg); }
@utility shadow-glass  { box-shadow: var(--shadow-glass); }
@utility shadow-glow   { box-shadow: var(--shadow-glow); }
@utility text-balance  { text-wrap: balance; }

@keyframes floatBlob {
  0%,100% { transform: translate(0,0) scale(1); }
  50%     { transform: translate(20px,-30px) scale(1.08); }
}
.blob-anim { animation: floatBlob 14s ease-in-out infinite; }
```

## 3. Dependências

```bash
bun add tw-animate-css lucide-react sonner
# shadcn-ui (instalar os primitives usados)
```

Adicionar via `bunx shadcn@latest add`: `button card dialog input label form
sonner skeleton badge dropdown-menu tabs avatar`.

## 4. Componentes-base a criar primeiro

Nessa ordem:

1. [ ] `src/components/LiquidBackground.tsx` — aurora + 2-3 `div`s com
       classe `blob-anim` posicionadas absolutas.
2. [ ] `src/components/AppShell.tsx` — `<main class="mx-auto max-w-[430px] px-6 pt-14 pb-10">`.
3. [ ] `Header` (logo branco + título display).
4. [ ] `GlassCard` (wrapper sobre `glass-strong rounded-[32px] p-6`).
5. [ ] `PrimaryButton` / `GhostButton` (variantes do snippet do guia).
6. [ ] `FormField` (label + wrapper `glass-input` + ícone lucide).
7. [ ] `EmptyState` (snippet do guia).

## 5. Telas iniciais a montar

- [ ] **Login** — usar o layout do `src/routes/login.tsx` deste projeto como
      referência fiel.
- [ ] **Home / Dashboard** — header com saudação + lista de cards `glass-soft`.
- [ ] **Detalhe** — card único `glass-strong` ocupando 80% da altura.
- [ ] **Formulário** — `glass-strong` + 3 `FormField` + `PrimaryButton`.

## 6. Microcopy

- [ ] Aplicar `COPYWRITING_GUIDE.md` em todos os textos.
- [ ] Substituir mensagens de erro padrão (auth, rede, validação) pelas
      versões humanas do guia.
- [ ] Garantir que cada estado vazio tem título + próximo passo.

## 7. QA visual (checklist final)

- [ ] Fundo aurora aparece em **todas as telas** (incluindo splash/loading).
- [ ] Nenhuma tela tem fundo branco sólido fora de modal.
- [ ] Todos os textos estão em branco com opacidade (não em cinza fixo).
- [ ] Apenas **um** botão primário branco com `shadow-glow` por tela.
- [ ] Ícones lucide com `strokeWidth` consistente (2 ou 2.4).
- [ ] Tipografia: títulos com `font-display`, body com `font-sans`. Sem
      Inter, Roboto, Poppins ou system default sobrando.
- [ ] Bordas dos painéis são `rounded-[32px]` ou `rounded-3xl`, nunca quadrado.
- [ ] Toasts usam o tom do `COPYWRITING_GUIDE.md`.
- [ ] Mobile: container nunca passa de `max-w-[430px]`.
- [ ] Desktop: conteúdo continua centralizado, fundo aurora preenche tela.

## 8. Manter consistência ao longo do tempo

- Quando aparecer um componente novo, **primeiro** veja se algum dos snippets
  do `COMPONENT_STYLE_GUIDE.md` resolve. Só crie algo novo se realmente
  faltar.
- Toda cor nova passa primeiro pelo `design-tokens.json`. Nunca hardcode hex
  num componente.
- Toda string visível passa pelo filtro do `COPYWRITING_GUIDE.md` antes do
  merge.
