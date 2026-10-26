# Design System

## Direção
Futurista, limpo, tecnológico. Tema claro e escuro, com valores próprios por tema.
Referências: interfaces de dashboards modernos, glassmorphism sutil (não exagerado).

## Tokens e temas

Fonte de verdade: `web/app/styles/tokens.css`. Cada token é declarado **uma única vez** com `light-dark(<claro>, <escuro>)`. Os valores e usos de cada token estão no design da feature (`docs/design/lancamentos-financeiros.md`, seção 1.2); a tabela abaixo reproduz o que está no código. Este é o único arquivo que pode conter cores literais: componentes usam apenas `var(--token)`, inclusive em SVG (Recharts).

### Mecanismo de tema

- `:root { color-scheme: light dark; }`: sem preferência salva, o tema segue o sistema operacional (`prefers-color-scheme`), ao vivo e sem JavaScript.
- `:root[data-theme="light"]` e `:root[data-theme="dark"]` fixam `color-scheme` e, com isso, o resultado de todos os `light-dark()` (e dos controles nativos: date/month picker, select, barras de rolagem).
- **Cookie `theme`** (`light` | `dark`; `Path=/; Max-Age=31536000; SameSite=Lax`, `Secure` em HTTPS; valor inválido equivale a ausente). `web/app/layout.tsx` lê o cookie no servidor e renderiza `<html data-theme="...">`, então o primeiro quadro (inclusive loading e erro) já nasce no tema certo. Por ler `cookies()` no layout raiz, as rotas são dinâmicas.
- **Alternador sol/lua** (`web/components/theme/theme-toggle.tsx`, na navbar): botão com `aria-label` fixo "Tema escuro" e `aria-pressed`. Ao clicar grava `document.documentElement.dataset.theme` e o cookie, sem recarregar e sem tocar o estado de outras árvores React (drawer, formulários, filtros). Os dois ícones ficam no DOM e a visibilidade é por CSS. A troca é instantânea (`data-theme-switching` desliga transições por dois frames).
- `web/app/global-error.tsx` usa um script inline mínimo que lê o cookie antes da pintura.
- Navegadores sem `light-dark()` não são suportados.

### Regras de uso das cores

1. Texto só com tokens de texto: `--text`, `--text-muted`, `--text-disabled`, `--accent`, `--on-primary`, `--success-text`, `--warning-text`, `--danger-text`, `--income`, `--expense`. `--success`, `--warning` e `--danger` são para preenchimento e borda, nunca texto.
2. Sem opacidade em texto ou controles; desabilitado usa `--surface-2` + `--text-disabled`.
3. Transparência só em `--scrim`, `--header-bg` (alfa 0.95) e sombras.
4. Todo elemento preenchido com `--primary-strong*` declara borda `--primary-border`.
5. Recharts: `fill`/`stroke` sempre de `var(--token)`; tooltip e legenda próprios.
6. Contraste mínimo WCAG AA (4,5:1 texto; 3:1 não textual) nos dois temas, verificado por teste unitário de tokens e por Playwright + axe.

### Tabela de tokens (claro / escuro)

**Superfícies e texto**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#F5F7FB` | `#0B0F1A` | Fundo da página; fundo opaco da faixa de abas fixa |
| `--surface` | `#FFFFFF` | `#121829` | Cards, resumo, tabela, blocos de fatura, drawer, modal, folha, menus |
| `--surface-2` | `#EEF1F7` | `#18203A` | Hover, linha selecionada, toast, tooltip (escuro), desabilitados, faixa de subtotal, painel de novo cartão |
| `--surface-active` | `#E2E7F0` | `#222B4A` | Pressionado de botões secundários/ícone, itens de menu e abas |
| `--input-bg` | `#FFFFFF` | `#0B0F1A` | Fundo de inputs, selects, combobox, date picker |
| `--header-bg` | `rgb(255 255 255 / 0.95)` | `rgb(18 24 41 / 0.95)` | Navbar fixa (blur 12px) |
| `--border` | `#DDE2EC` | `#1F2940` | Bordas decorativas |
| `--border-strong` | `#737D92` | `#6E7891` | Borda de controles, blocos de fatura, painel de novo cartão, drawer/modal (>= 3:1) |
| `--text` | `#0F172A` | `#E6EAF5` | Texto principal, valores monetários, aba ativa |
| `--text-muted` | `#475569` | `#8B95AD` | Texto secundário, rótulos, placeholders, ticks, aba inativa |
| `--text-disabled` | `#737D92` | `#6E7891` | Texto e ícone de controles desabilitados |
| `--skeleton` | `#E2E7F0` | `#222B4A` | Blocos de skeleton |
| `--scrim` | `rgb(15 23 42 / 0.45)` | `rgb(11 15 26 / 0.72)` | Fundo atrás de drawer/modal/folha |

**Ação, foco e links**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--primary` | `#6366F1` | `#6366F1` | Apenas glow decorativo; nunca texto |
| `--primary-strong` | `#4F46E5` | `#4F46E5` | Botão primário, segmento selecionado, checkbox marcado, página atual |
| `--primary-strong-hover` | `#4338CA` | `#4338CA` | Hover do primário |
| `--primary-strong-active` | `#3730A3` | `#3730A3` | Pressionado do primário |
| `--primary-border` | `#4F46E5` | `#818CF8` | Borda 1px de tudo que é preenchido com `--primary-strong` |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` | Texto/ícone sobre `--primary-strong` e variantes |
| `--accent` | `#0E7490` | `#22D3EE` | Links, item de navegação ativo, indicador da aba ativa, barra de progresso |
| `--accent-active` | `#0C6980` | `#22D3EE` | Texto do botão terciário pressionado (`:active`) sobre `--surface-active` (5,05:1 no claro) |
| `--focus-color` | `#0E7490` | `#22D3EE` | Cor do anel de foco |
| `--focus-ring` / `--focus-offset` | `2px solid var(--focus-color)` / `2px` | idem | Forma do anel de foco (iguais nos dois temas) |

**Semântica de status e tipo**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--success` | `#059669` | `#34D399` | Preenchimento/borda: Pago, toast de sucesso |
| `--success-text` | `#047857` | `#34D399` | Texto/ícone: badge "Pago", "Positivo" |
| `--warning` | `#B45309` | `#FBBF24` | Preenchimento/borda: Pendente |
| `--warning-text` | `#92400E` | `#FBBF24` | Texto/ícone: badge "Pendente" |
| `--danger` | `#DC2626` | `#F87171` | Borda: campo com erro, banner/toast de erro |
| `--danger-text` | `#B91C1C` | `#F87171` | Texto/ícone: erros, "Negativo" |
| `--income` | `#1D4ED8` | `#60A5FA` | Ícone/rótulo "Receita", badge "Recebida" |
| `--expense` | `#BE123C` | `#FB7185` | Ícone/rótulo "Despesa" |

**Gráficos, tooltip e barras de rolagem**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--chart-income` | `#1D4ED8` | `#60A5FA` | Barra de receitas |
| `--chart-paid` | `#059669` | `#34D399` | Despesas pagas |
| `--chart-pending` | `#B45309` | `#FBBF24` | Despesas pendentes (com hachura) |
| `--chart-balance-realized` | `#6D28D9` | `#A78BFA` | Linha "Saldo realizado" |
| `--chart-balance-projected` | `#BE185D` | `#F472B6` | Linha tracejada "Saldo previsto" |
| `--chart-axis` | `#475569` | `#8B95AD` | Ticks dos eixos |
| `--chart-grid` | `#DDE2EC` | `#2A3552` | Grade |
| `--chart-zero-line` | `#475569` | `#8B95AD` | Linha do zero |
| `--chart-cursor` | `#EEF1F7` | `#18203A` | Faixa de hover/foco e do mês selecionado |
| `--chart-1` | `#0E7490` | `#22D3EE` | Donut, 1a categoria |
| `--chart-2` | `#4F46E5` | `#818CF8` | Donut, 2a categoria |
| `--chart-3` | `#BE185D` | `#F472B6` | Donut, 3a categoria |
| `--chart-4` | `#4D7C0F` | `#A3E635` | Donut, 4a categoria |
| `--chart-5` | `#C2410C` | `#FB923C` | Donut, 5a categoria |
| `--chart-6` | `#64748B` | `#8B95AD` | Donut, "Outras" |
| `--tooltip-bg` | `#FFFFFF` | `#18203A` | Fundo dos tooltips (opaco) |
| `--tooltip-border` | `#737D92` | `#6E7891` | Borda dos tooltips |
| `--scrollbar-thumb` | `#737D92` | `#6E7891` | Polegar da barra de rolagem |
| `--scrollbar-track` | `#EEF1F7` | `#18203A` | Trilho |

Tokens introduzidos em relação à primeira versão deste documento (que só tinha tema escuro e `--bg/--surface/--border/--primary/--accent/--success/--warning/--danger/--text/--text-muted`): `--surface-2`, `--surface-active`, `--input-bg`, `--header-bg`, `--border-strong`, `--text-disabled`, `--skeleton`, `--scrim`, `--primary-strong` (+ `-hover`, `-active`), `--primary-border`, `--on-primary`, `--focus-color`, `--focus-ring`, `--focus-offset`, variantes `*-text`, `--income`, `--expense`, todos os `--chart-*`, `--tooltip-*` e `--scrollbar-*`. Os valores do tema escuro originais foram mantidos; `--primary` virou apenas glow decorativo e fundos de botão usam `--primary-strong`.

## Tipografia
- Títulos: Space Grotesk (600/700) | Corpo: Inter (400/500) | Mono: JetBrains Mono (carregadas com `next/font/google` em `web/app/layout.tsx`)
- Escala: 12 / 14 / 16 / 20 / 24 / 32 / 48

## Forma e profundidade
- Raio: 8px (inputs), 12px (cards), 999px (badges)
- Sombras suaves com glow sutil na cor primary em elementos de foco
- Blur (backdrop-filter) apenas em modais e headers fixos

## Motion
- 150–250ms, easing ease-out. Respeitar `prefers-reduced-motion`.
- Troca de tema é instantânea (sem transição de cor).

## Layout responsivo (mobile-first)
- Breakpoints: sm 640 / md 768 / lg 1024 / xl 1280
- Grid de 4 colunas (mobile), 8 (tablet), 12 (desktop)
- Alvos de toque ≥ 44px
