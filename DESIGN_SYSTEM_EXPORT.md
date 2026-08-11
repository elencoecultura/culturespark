# Encantômetro · Design System Export

Guia visual completo do app **Encantômetro / Link Cultura** (Hector Studios).
Este documento descreve a identidade, decisões visuais e padrões para que outro
app possa ser construído com exatamente a mesma sensação.

> Estética em uma frase: **“Liquid glass sobre uma aurora noturna”** — cartões
> de vidro fosco com blur forte flutuando sobre um fundo escuro com gradientes
> radiais ciano → roxo → magenta. Tipografia editorial em display + sans
> humanista no corpo. Tom de voz acolhedor, em PT-BR, levemente lúdico.

---

## 1. Marca

- **Nome do produto neste app:** Encantômetro (interno da Hector Studios).
  No novo app, substitua pelo nome do produto, mas mantenha o sistema.
- **Personalidade:** humano, otimista, acolhedor, gentil, levemente mágico.
  Nunca corporativo, nunca infantilizado.
- **Logo:** mark monocromática branca sobre o fundo aurora (usar
  `filter: brightness(0) invert(1)` para forçar versão branca).

## 2. Paleta de cores

### Cores de marca (Hector)

| Token            | Hex       | Uso                                                   |
| ---------------- | --------- | ----------------------------------------------------- |
| `papel`          | `#efefea` | Fundo claro alternativo, superfícies impressas        |
| `celeste`        | `#6ad1e3` | Acento ciano, ícones, highlights                      |
| `blu`            | `#1a2891` | Texto sobre botões claros, âncora azul profundo       |
| `pink`           | `#e451f5` | Acento magenta, brilhos, estado “mágico”              |
| `ink`            | `#071038` | Texto sobre superfícies claras / base do gradient bg  |
| `muted-ink`      | `#65708a` | Texto secundário sobre superfícies claras             |
| `magic-green`    | `#24d18b` | Estado de sucesso                                     |
| `magic-amber`    | `#ffca55` | Estado de atenção                                     |
| `magic-red`      | `#ff5c7a` | Estado de erro                                        |

### Cores semânticas (shadcn / superfícies claras)

São tokens oklch atribuídos via CSS variables. Usados pelos primitives do
shadcn quando exibidos em modal/claro:

```
--background, --foreground, --card, --card-foreground,
--popover, --popover-foreground, --primary, --primary-foreground,
--secondary, --secondary-foreground, --muted, --muted-foreground,
--accent, --accent-foreground, --destructive, --destructive-foreground,
--border, --input, --ring
```

### Texto em superfícies escuras (default do app)

| Função         | Cor                |
| -------------- | ------------------ |
| Texto primário | `#ffffff`          |
| Texto suave    | `rgba(255,255,255,0.75)` |
| Texto auxiliar | `rgba(255,255,255,0.6)`  |
| Texto fraco    | `rgba(255,255,255,0.4)`  |
| Borda glass    | `rgba(255,255,255,0.22)` |

### Gradientes

```
--brand-grad : linear-gradient(135deg, #6ad1e3 0%, #7d7dff 34%, #e451f5 70%, #1a2891 100%);
--blue-grad  : linear-gradient(145deg, #1a2891 0%, #263dd1 54%, #6ad1e3 120%);
--pink-grad  : linear-gradient(145deg, #e451f5 0%, #8a68ff 42%, #6ad1e3 100%);
--aurora-bg  : radial layers + linear base, ver design-tokens.json
```

`--aurora-bg` é o **fundo padrão do app**. Sempre `background-attachment: fixed`.

## 3. Tipografia

- **Display:** `panel-sans` (carregado via Adobe Typekit
  `https://use.typekit.net/vns5oby.css`). Fallback: `"Panel", Georgia, serif`.
  Usado em títulos grandes (`h1`, hero, números de destaque). Peso 800–900,
  tracking apertado `-0.04em`, line-height curto `0.95`.
- **Sans (corpo):** `Montserrat` (Google Fonts, pesos 400, 500, 600, 700,
  800, 900). Usado em textos, botões, labels.
- **Mono:** não há fonte mono específica — usar a padrão do sistema quando
  necessário.

### Escala recomendada

| Nível       | Tamanho | Peso | Tracking  | Line-height |
| ----------- | ------- | ---- | --------- | ----------- |
| Display XL  | 34–48px | 900  | -0.04em   | 0.95        |
| H1          | 28–32px | 800  | -0.03em   | 1.05        |
| H2          | 22–24px | 700  | -0.02em   | 1.15        |
| H3          | 18px    | 700  | -0.01em   | 1.2         |
| Body        | 14–15px | 400–500 | normal | 1.5         |
| Small       | 12–13px | 500  | normal    | 1.45        |
| Label/eyebrow | 11–12px | 600 | 0.12em uppercase | 1.2 |

## 4. Espaçamento e layout

- Sistema baseado no spacing scale do Tailwind (`0.25rem` step).
- Container principal mobile-first: `max-w-[430px]` com `px-6`. O app foi
  desenhado para celular; em desktop, o conteúdo permanece centralizado.
- Padding vertical típico de tela: `pt-14 pb-10`.
- Gaps padrão entre seções: `space-y-6` ou `gap-6`.

## 5. Border-radius

| Token       | Valor    | Uso                              |
| ----------- | -------- | -------------------------------- |
| `radius-sm` | 6px      | Chips e inputs pequenos          |
| `radius-md` | 8px      | Botões secundários, badges       |
| `radius-lg` | 10px     | Cartões compactos                |
| `radius-xl` | 14px     | Cartões padrão                   |
| Custom 2xl  | 16–24px  | Inputs glass, chips de UI        |
| Custom 3xl  | 28–32px  | Painéis principais glass         |

Painéis glass costumam usar `rounded-[32px]`; botões primários `rounded-2xl`.

## 6. Sombras

```
--shadow-glass: 0 30px 60px -20px rgba(7,16,56,.55), 0 8px 24px -10px rgba(7,16,56,.35);
--shadow-soft : 0 18px 50px rgba(7,16,56,.30);
--shadow-glow : 0 0 40px rgba(228,81,245,.35);
--glass-highlight: inset 0 1px 0 rgba(255,255,255,.4), inset 0 -1px 0 rgba(255,255,255,.06);
```

- `shadow-glass` em cartões grandes.
- `shadow-glow` no botão primário (CTA principal) para destacar.
- `glass-highlight` sempre combinado com `shadow-glass` para reforçar o
  brilho do vidro.

## 7. Utilitários proprietários

```
glass-soft   → painel padrão (bg rgba(255,255,255,.08), blur 28px)
glass-strong → painel destaque (bg rgba(255,255,255,.16), blur 34px)
glass-chip   → chip/etiqueta (bg rgba(255,255,255,.12), blur 18px)
glass-input  → campo de input (bg rgba(255,255,255,.08), blur 20px)
bg-aurora    → background principal
bg-brand-grad / bg-blue-grad / bg-pink-grad
shadow-glass / shadow-glow / text-balance
```

## 8. Ícones

- Biblioteca: **lucide-react**.
- Tamanho padrão: 18–20px dentro de inputs/botões, 24px em headers.
- Cor: branca com opacidade (`text-white/60` a `text-white/80`).
- `strokeWidth` padrão 2; em ícones de seta/ação destacada usar 2.4.

## 9. Princípios visuais (do/don’t)

- ✅ Usar fundo aurora + cartões glass empilhados.
- ✅ Texto branco com hierarquia por opacidade, não por novo tom.
- ✅ Um único CTA branco com `shadow-glow` por tela.
- ✅ Acentos em ciano/magenta usados com parcimônia.
- ❌ Não usar fundos sólidos cinza/branco no corpo do app.
- ❌ Não introduzir cores fora da paleta (sem laranja, sem amarelo neon).
- ❌ Não usar fontes default (Inter, Poppins, Roboto).
- ❌ Não usar bordas pretas duras — sempre `rgba(255,255,255,.22)`.

## 10. Componentes principais (resumo)

Detalhes completos com snippets em `COMPONENT_STYLE_GUIDE.md`.

- **Botão primário:** branco, texto `blu`, `rounded-2xl`, `shadow-glow`,
  `active:scale-[0.98]`.
- **Botão secundário:** `glass-chip`, texto branco.
- **Input:** wrapper `glass-input` + ícone à esquerda, input transparente,
  placeholder `text-white/40`.
- **Card / painel:** `glass-strong rounded-[32px] p-6`.
- **Chip / badge:** `glass-chip rounded-full px-3 py-1 text-xs uppercase tracking-wider`.
- **Modal (shadcn Dialog):** mantém superfície clara semântica (`--card`),
  para máximo contraste com o fundo escuro.
- **Toast:** sonner (já integrado em `__root.tsx`).

## 11. Estrutura visual de uma tela típica

```
LiquidBackground (aurora + blobs animados)
└── <main class="mx-auto max-w-[430px] px-6 pt-14 pb-10">
    ├── Header (logo + título display + subtítulo /75)
    ├── Painel glass-strong (formulário ou conteúdo)
    ├── Link/ação secundária
    └── Footer eyebrow (uppercase /40)
```

---

Os tokens machine-readable estão em **`design-tokens.json`**.
A microcopy e o tom de voz estão em **`COPYWRITING_GUIDE.md`**.
Snippets prontos por componente estão em **`COMPONENT_STYLE_GUIDE.md`**.
O passo a passo para aplicar tudo num novo projeto está em
**`IMPLEMENTATION_CHECKLIST.md`**.
