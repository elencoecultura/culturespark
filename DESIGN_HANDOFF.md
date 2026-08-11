# Encantômetro — Design System & Layout Handoff

Guia autossuficiente para reproduzir a identidade visual do app **Encantômetro / Link Cultura** (Hector Studios) em outro projeto.

> **Estética em uma frase:** *"Liquid glass sobre uma aurora noturna"* — cartões de vidro fosco flutuando sobre um fundo escuro com gradientes radiais **ciano → roxo → magenta**. Tipografia editorial display + sans humanista. Tom acolhedor, PT-BR, levemente mágico. Stack de referência: **React 19 + Vite + Tailwind CSS v4**.

---

## 1. Princípios de layout

1. **Fundo aurora fixo** no `body` (`background-attachment: fixed`); tudo flutua sobre ele.
2. **Container mobile:** coluna central `max-width: 430px`, padding lateral `16px`, `padding-bottom` ~128px (nav flutuante).
3. **Hero sem caixa:** o bloco principal de cada tela vive direto no fundo; os cards começam abaixo.
4. **Variação de forma:** misture **anéis circulares** (progresso/nível), **grade bento assimétrica**, **ícones redondos** e barras horizontais — nunca só retângulos iguais.
5. **Cantos bem arredondados:** cards `32px`, tiles `28px`, chips/botões `full`.
6. **Barra inferior legível:** fundo escuro (`bg-ink/85`) + blur — nunca transparente sobre conteúdo.

---

## 2. Tokens de cor (só use estes)

| Token | Hex | Uso |
| --- | --- | --- |
| `papel` | `#efefea` | Fundo claro alternativo |
| `celeste` | `#6ad1e3` | Acento ciano, anéis, ícones |
| `blu` | `#1a2891` | Texto sobre superfícies claras |
| `pink` | `#e451f5` | Acento magenta / estado mágico |
| `ink` | `#071038` | Base do gradiente / **fundo da nav** |
| `muted-ink` | `#65708a` | Texto secundário sobre claro |
| `magic-green` | `#24d18b` | **Sucesso** |
| `magic-amber` | `#ffca55` | **Atenção** |
| `magic-red` | `#ff5c7a` | **Erro** |

**Regra:** nada de paletas genéricas do Tailwind (`emerald`, `slate`, `amber`, `cyan`…). Estados semânticos = `magic-green/amber/red`. Texto sobre chip colorido translúcido → `text-white`.

### Gradientes
```css
--brand-grad: linear-gradient(135deg, #6ad1e3 0%, #7d7dff 34%, #e451f5 70%, #1a2891 100%);
--blue-grad:  linear-gradient(145deg, #1a2891 0%, #263dd1 54%, #6ad1e3 120%);
--pink-grad:  linear-gradient(145deg, #e451f5 0%, #8a68ff 42%, #6ad1e3 100%);
--aurora-bg:
  radial-gradient(120% 80% at 20% 0%,  #4b3bd8 0%, transparent 55%),
  radial-gradient(110% 80% at 90% 10%, #e451f5 0%, transparent 50%),
  radial-gradient(120% 80% at 50% 100%,#6ad1e3 0%, transparent 55%),
  linear-gradient(180deg, #0a0f3a 0%, #1a2891 60%, #2a1d6b 100%);
```

---

## 3. Tipografia

```css
--font-display: "panel-sans", "Panel", Georgia, serif;  /* títulos: pesado, arredondado */
--font-sans:    "Montserrat", ui-sans-serif, system-ui, sans-serif;
```
- **Display**: títulos e números — `font-black` (900), `tracking-[-0.02em]` a `-0.04em`, leading apertado, `text-balance`.
- **Rótulos/eyebrows**: `text-[10.5px] font-semibold uppercase tracking-[0.16em]`, cor `text-white/55`.
- Escala típica: hero `28px`, título de card `18–24px`, corpo `13–14px`, meta `11–12px`.

---

## 4. Raios

| Elemento | Raio |
| --- | --- |
| Card (GlassCard) | `32px` |
| Tile / bento / painel admin | `28px` |
| Modal (bottom sheet) | `28px` |
| Barra inferior | `30px` |
| Chip / badge / botão pílula | `full` |
| Ícone circular | `full` |

---

## 5. CSS base (Tailwind v4 — cole no projeto)

```css
@import "tailwindcss" source(none);

@theme {
  --color-papel:#efefea; --color-celeste:#6ad1e3; --color-blu:#1a2891; --color-pink:#e451f5;
  --color-ink:#071038; --color-muted-ink:#65708a;
  --color-magic-green:#24d18b; --color-magic-amber:#ffca55; --color-magic-red:#ff5c7a;
  --font-display:"panel-sans","Panel",Georgia,serif;
  --font-sans:"Montserrat",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
}
:root{
  --brand-grad:linear-gradient(135deg,#6ad1e3 0%,#7d7dff 34%,#e451f5 70%,#1a2891 100%);
  --blue-grad:linear-gradient(145deg,#1a2891 0%,#263dd1 54%,#6ad1e3 120%);
  --pink-grad:linear-gradient(145deg,#e451f5 0%,#8a68ff 42%,#6ad1e3 100%);
  --aurora-bg:
    radial-gradient(120% 80% at 20% 0%,#4b3bd8 0%,transparent 55%),
    radial-gradient(110% 80% at 90% 10%,#e451f5 0%,transparent 50%),
    radial-gradient(120% 80% at 50% 100%,#6ad1e3 0%,transparent 55%),
    linear-gradient(180deg,#0a0f3a 0%,#1a2891 60%,#2a1d6b 100%);
  --shadow-glass:0 30px 60px -20px rgba(7,16,56,.55),0 8px 24px -10px rgba(7,16,56,.35);
  --shadow-glow:0 0 40px rgba(228,81,245,.35);
  --glass-stroke:rgba(255,255,255,.22);
  --glass-highlight:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -1px 0 rgba(255,255,255,.06);
}
@layer base{ html,body{ margin:0;min-height:100%;color:#fff;font-family:var(--font-sans);
  background:var(--aurora-bg);background-attachment:fixed;-webkit-font-smoothing:antialiased; } }

@utility glass-soft{ border:1px solid var(--glass-stroke); background:rgba(255,255,255,.08);
  backdrop-filter:blur(28px) saturate(180%); box-shadow:var(--shadow-glass),var(--glass-highlight); }
@utility glass-strong{ border:1px solid rgba(255,255,255,.3); background:rgba(255,255,255,.16);
  backdrop-filter:blur(34px) saturate(190%); box-shadow:var(--shadow-glass),var(--glass-highlight); }
@utility glass-chip{ border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.12);
  backdrop-filter:blur(18px) saturate(170%); box-shadow:var(--glass-highlight); }
@utility glass-input{ border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08);
  backdrop-filter:blur(20px); color:#fff; }
@utility bg-brand-grad{ background:var(--brand-grad); }
@utility bg-blue-grad{ background:var(--blue-grad); }
@utility bg-pink-grad{ background:var(--pink-grad); }
@utility shadow-glass{ box-shadow:var(--shadow-glass); }
@utility shadow-glow{ box-shadow:var(--shadow-glow); }
```

---

## 6. Receitas de componentes (React + Tailwind)

### Casca + barra inferior legível
```jsx
<main className="relative mx-auto min-h-screen w-full max-w-[430px] px-4 pb-32 pt-6">…</main>
<nav className="fixed bottom-3 left-1/2 z-20 w-[min(420px,calc(100%-16px))] -translate-x-1/2">
  <div className="rounded-[30px] border border-white/15 bg-ink/85 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] shadow-glass backdrop-blur-2xl">
    {/* item ativo: text-white + sublinhado gradiente; inativo: text-white/50 */}
  </div>
</nav>
```

### GlassCard (32px)
```jsx
const VARIANT={ glass:"glass-soft text-white",
  blue:"border border-white/20 bg-blue-grad text-white shadow-glass",
  pink:"border border-white/25 bg-pink-grad text-white shadow-glass",
  brand:"border border-white/30 bg-brand-grad text-white shadow-glass" };
function GlassCard({variant="glass",onClick,className,children}){
  const Tag=onClick?"button":"div";
  return <Tag onClick={onClick} className={cn("relative w-full overflow-hidden rounded-[32px] p-5 text-left transition active:scale-[0.99]",VARIANT[variant],className)}>
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/18 to-transparent"/>
    <span className="relative block">{children}</span></Tag>;
}
```
`cn` = clsx + tailwind-merge.

### Anel de progresso (nível / sequência)
```jsx
function ProgressRing({value,pct,label="dias",size=96}){
  const r=size*0.375,c=2*Math.PI*r,off=c-(Math.min(100,Math.max(0,pct))/100)*c,k=size/2;
  return <div className="relative grid shrink-0 place-items-center" style={{height:size,width:size}}>
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={k} cy={k} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7"/>
      <circle cx={k} cy={k} r={r} fill="none" stroke="url(#ring)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-500"/>
      <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6ad1e3"/><stop offset="100%" stopColor="#e451f5"/></linearGradient></defs>
    </svg>
    <div className="absolute text-center leading-none"><div className="font-display text-[28px] font-black">{value}</div>
    <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">{label}</div></div>
  </div>;
}
```

### Medidor 1–5 (círculos que preenchem como barra)
Selecionado = círculo branco maior + ring celeste; preenchidos até o valor = `bg-white/45`; vazio = `glass-chip`. Rótulo curto abaixo de cada.

### Grade bento assimétrica
```jsx
<div className="grid grid-cols-2 gap-3" style={{gridAutoRows:"84px"}}>
  <Tile variant="pink" className="row-span-2 flex flex-col justify-between">…tile alto…</Tile>
  <Tile variant="blue" className="flex flex-col justify-between">…pequeno…</Tile>
  <Tile className="flex flex-col justify-between">…pequeno…</Tile>
  <Tile className="col-span-2 flex items-center gap-3">…barra larga…</Tile>
</div>
```
`Tile` = mesma ideia do GlassCard mas com filhos diretos (p/ flex funcionar), raio `28px`.

### Botões / chips / inputs
```
// CTA colorido
"flex w-full items-center justify-center gap-2 rounded-full bg-brand-grad px-5 py-3.5 text-[14px] font-bold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50"
// CTA branco (sobre fundo colorido): "rounded-full bg-white px-5 py-3 font-bold text-blu shadow-glow"
// Chip/secundário: "glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
// Input/select/textarea: "glass-input w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"  (em <option> use text-blu)
```

### Badge de status
```jsx
const TONE={ ok:"text-magic-green bg-magic-green/15", warn:"text-magic-amber bg-magic-amber/15",
  danger:"text-magic-red bg-magic-red/15", info:"text-celeste bg-celeste/15", neutral:"text-white/55 bg-white/10" };
<span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold",TONE[tone])}>{label}</span>
```

### Modal (bottom sheet) — acessível
`role="dialog"` + `aria-modal`, fecha no **Esc**, foco preso, devolve foco ao abridor, fecha no backdrop. Backdrop `fixed inset-0 z-40 flex items-end justify-center bg-blu/60 p-3 backdrop-blur-sm`; painel `glass-strong w-full max-w-[420px] rounded-[28px] p-5`.

### Confirmação destrutiva (nunca use confirm() nativo)
```jsx
import { toast } from "sonner";
export function confirmAction(msg, onConfirm){
  toast(msg,{ duration:10000, action:{label:"Confirmar",onClick:onConfirm}, cancel:{label:"Cancelar",onClick(){}} });
}
```

---

## 7. Padrões de tela
- **Abas** (pílula) em telas densas: `glass-soft rounded-full p-1`, aba ativa `bg-white text-blu shadow-glow`.
- **Resumo antes do detalhe:** anel/médias/contadores no topo, listas depois.
- **Estado vazio** como convite: `glass-chip rounded-2xl px-4 py-3 text-[13px] text-white/70`.
- **Blocos recolhíveis** para conteúdo pesado (ex.: NPS vira 1 linha "Responder ›").

---

## 8. Tom de voz
PT-BR, humano, otimista, levemente mágico. Vocabulário: "elenco", "magia", "brilho", "cuidar do clima". CTAs curtos ("Fazer check-in", "Registrar", "Iluminar"). Confirmações gentis ("Valeu por cuidar do clima").

---

## 9. Checklist de replicação
- [ ] Colar o CSS da seção 5 (tokens + utilitários glass).
- [ ] `--aurora-bg` fixo no body, texto branco, container `max-w-[430px]` + `pb-32`.
- [ ] Só tokens de marca; semânticos = `magic-*`.
- [ ] Cantos: cards 32px, tiles/painéis 28px, chips/botões `full`.
- [ ] Hero sem card; variar forma (anéis + bento + círculos).
- [ ] Barra inferior `bg-ink/85` + blur.
- [ ] `cn` = clsx + tailwind-merge; fonte display arredondada pesada.
