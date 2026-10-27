# Design System

## Direção
Futurista, limpo, tecnológico. Tema claro e escuro, com valores próprios por tema.
Referências: interfaces de dashboards modernos, glassmorphism sutil (não exagerado).

Paleta suavizada (rev. 5 do design da feature, aprovada pelo usuário em 2026-10-25): o escuro deixou de usar quase-preto (fundo azul-ardósia `#151B26`, cartões `#1C2330`) e o claro ganhou um fundo cinza-azulado suave (`#EEF1F5`) com cartões brancos, para separar melhor fundo e cartões. A separação é reforçada por `--border` e pela sombra sutil `--shadow-card`.

Fundo em gradiente (rev. 6, aprovada pelo usuário em 2026-10-26): o fundo da página deixou de ser uma cor sólida e passou a ser um gradiente fixo na viewport, estático, nos dois temas. Escuro: Grafite com brilho ciano. Claro: Lavanda → azul-gelo. Detalhes em "Fundo da página (rev. 6)" abaixo; decisão em `docs/adr/0003-fundo-gradiente-temas.md`.

## Tokens e temas

Fonte de verdade: `web/app/styles/tokens.css`. Cada token de cor é declarado **uma única vez** com `light-dark(<claro>, <escuro>)`. Os valores e usos de cada token estão no design da feature (`docs/design/lancamentos-financeiros.md`, seção 1.2, contrastes na 1.9); a tabela abaixo reproduz esses valores. Este é o único arquivo que pode conter cores literais: componentes usam apenas `var(--token)`, inclusive em SVG (Recharts).

### Mecanismo de tema

- `:root { color-scheme: light dark; }`: sem preferência salva, o tema segue o sistema operacional (`prefers-color-scheme`), ao vivo e sem JavaScript.
- `:root[data-theme="light"]` e `:root[data-theme="dark"]` fixam `color-scheme` e, com isso, o resultado de todos os `light-dark()` (e dos controles nativos: date/month picker, select, barras de rolagem).
- `light-dark()` só aceita valores de cor. Tokens compostos (como `--shadow-card` e `--focus-ring`) são declarados uma vez, sem `light-dark()`, e referenciam um token de cor que varia por tema (`--shadow-color`, `--focus-color`).
- **Cookie `theme`** (`light` | `dark`; `Path=/; Max-Age=31536000; SameSite=Lax`, `Secure` em HTTPS; valor inválido equivale a ausente). `web/app/layout.tsx` lê o cookie no servidor e renderiza `<html data-theme="...">`, então o primeiro quadro (inclusive loading e erro) já nasce no tema certo. Por ler `cookies()` no layout raiz, as rotas são dinâmicas.
- **Alternador sol/lua** (`web/components/theme/theme-toggle.tsx`, na navbar): botão com `aria-label` fixo "Tema escuro" e `aria-pressed`. Ao clicar grava `document.documentElement.dataset.theme` e o cookie, sem recarregar e sem tocar o estado de outras árvores React (drawer, formulários, filtros). Os dois ícones ficam no DOM e a visibilidade é por CSS. A troca é instantânea (`data-theme-switching` desliga transições por dois frames).
- `web/app/global-error.tsx` usa um script inline mínimo que lê o cookie antes da pintura.
- Navegadores sem `light-dark()` não são suportados.

### Regras de uso das cores

1. Texto só com tokens de texto: `--text`, `--text-muted`, `--text-disabled`, `--accent`, `--accent-active`, `--on-primary`, `--success-text`, `--warning-text`, `--danger-text`, `--income`, `--expense`. `--success`, `--warning` e `--danger` são para preenchimento e borda, nunca texto.
2. Sem opacidade em texto ou controles; desabilitado usa `--surface-2` + `--text-disabled`.
3. Transparência só em `--scrim`, `--header-bg` (alfa 0.95) e sombras (`--shadow-color`).
4. Todo elemento preenchido com `--primary-strong*` declara borda `--primary-border`.
5. Recharts: `fill`/`stroke` sempre de `var(--token)`; tooltip e legenda próprios.
6. Contraste mínimo WCAG AA (4,5:1 texto; 3:1 não textual) nos dois temas, verificado por teste unitário de tokens e por Playwright + axe. Pares e razões em `docs/design/lancamentos-financeiros.md`, 1.9.

### Tabela de tokens (claro / escuro)

**Superfícies, texto e profundidade**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#ECEEFC` | `#181E2A` | Cor base do fundo da página (`html`/`body`, overscroll, base sob o gradiente). Ver "Fundo da página (rev. 6)" |
| `--bg-stop-1` | `#EEEEFE` | `#141A24` | Parada 1 (0%) do gradiente linear |
| `--bg-stop-2` | `#E8F0FC` | `#181E2A` | Parada 2 (55%) |
| `--bg-stop-3` | `#F0ECFC` | `#12182A` | Parada 3 (100%) |
| `--bg-glow-1` | `#E4F0FE` | `#0C3044` | Brilho radial superior esquerdo |
| `--bg-glow-2` | `#F4ECFE` | `#20244D` | Brilho radial inferior direito |
| `--bg-gradient` | receita única | idem | Composição dos tokens acima (declarado sem `light-dark()`) |
| `--surface` | `#FFFFFF` | `#1C2330` | Cards, resumo, tabela, blocos de fatura, drawer, modal, folha, menus |
| `--surface-2` | `#F4F6F9` | `#252D3C` | Hover, linha selecionada, toast, tooltip (escuro), desabilitados, faixa de subtotal, painel de novo cartão |
| `--surface-active` | `#E4E8EE` | `#303A4C` | Pressionado de botões secundários/ícone, itens de menu e abas, opção ativa do combobox, `::selection` |
| `--input-bg` | `#FFFFFF` | `#151B26` | Fundo de inputs, selects, combobox, date picker |
| `--header-bg` | `rgb(255 255 255 / 0.95)` | `rgb(28 35 48 / 0.95)` | Navbar fixa (blur 12px) |
| `--border` | `#D9DEE6` | `#2E3747` | Bordas decorativas (cards, divisórias, base da faixa de abas) |
| `--border-strong` | `#6F798C` | `#7A8497` | Borda de controles, blocos de fatura, painel de novo cartão, drawer/modal (>= 3:1) |
| `--text` | `#1E293B` | `#E3E7EE` | Texto principal, valores monetários, aba ativa |
| `--text-muted` | `#4B5567` | `#9BA5B7` | Texto secundário, rótulos, placeholders, ticks, aba inativa |
| `--text-disabled` | `#6F798C` | `#7A8497` | Texto e ícone de controles desabilitados |
| `--skeleton` | `#E4E8EE` | `#303A4C` | Blocos de skeleton |
| `--scrim` | `rgb(15 23 42 / 0.45)` | `rgb(8 11 17 / 0.72)` | Fundo atrás de drawer/modal/folha |
| `--shadow-color` | `rgb(15 23 42 / 0.06)` | `rgb(0 0 0 / 0.3)` | Cor da sombra dos cartões (token de cor; é o que varia por tema) |
| `--shadow-card` | `0 1px 2px var(--shadow-color)` | idem | Sombra sutil de tudo que é `--surface` sobre `--bg` (declarado sem `light-dark()`) |

**Ação, foco e links**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--primary` | `#6366F1` | `#6366F1` | Apenas glow decorativo; nunca texto |
| `--primary-strong` | `#4F46E5` | `#4F46E5` | Botão primário, segmento selecionado, checkbox marcado, página atual |
| `--primary-strong-hover` | `#4338CA` | `#4338CA` | Hover do primário |
| `--primary-strong-active` | `#3730A3` | `#3730A3` | Pressionado do primário |
| `--primary-border` | `#4F46E5` | `#818CF8` | Borda 1px de tudo que é preenchido com `--primary-strong` |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` | Texto/ícone sobre `--primary-strong` e variantes |
| `--accent` | `#0E7490` | `#5CC8DB` | Links, item de navegação ativo, indicador da aba ativa, barra de progresso |
| `--accent-active` | `#0C6980` | `#5CC8DB` | Texto do botão terciário pressionado (`:active`) sobre `--surface-active` (5,10 claro / 5,85 escuro) |
| `--focus-color` | `#0E7490` | `#5CC8DB` | Cor do anel de foco |
| `--focus-ring` / `--focus-offset` | `2px solid var(--focus-color)` / `2px` | idem | Forma do anel de foco (iguais nos dois temas) |

**Semântica de status e tipo** (sem mudança de valor na rev. 5; conferidos contra os novos fundos)

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
| `--chart-axis` | `#4B5567` | `#9BA5B7` | Ticks dos eixos (= `--text-muted`) |
| `--chart-grid` | `#D9DEE6` | `#343E51` | Grade |
| `--chart-zero-line` | `#4B5567` | `#9BA5B7` | Linha do zero |
| `--chart-cursor` | `#EEF1F5` | `#252D3C` | Faixa de hover/foco e do mês selecionado |
| `--chart-1` | `#0E7490` | `#5CC8DB` | Donut, 1a categoria (= `--accent`) |
| `--chart-2` | `#4F46E5` | `#818CF8` | Donut, 2a categoria |
| `--chart-3` | `#BE185D` | `#F472B6` | Donut, 3a categoria |
| `--chart-4` | `#4D7C0F` | `#A3E635` | Donut, 4a categoria |
| `--chart-5` | `#C2410C` | `#FB923C` | Donut, 5a categoria |
| `--chart-6` | `#64748B` | `#9BA5B7` | Donut, "Outras" |
| `--tooltip-bg` | `#FFFFFF` | `#252D3C` | Fundo dos tooltips (opaco) |
| `--tooltip-border` | `#6F798C` | `#7A8497` | Borda dos tooltips |
| `--scrollbar-thumb` | `#6F798C` | `#7A8497` | Polegar da barra de rolagem |
| `--scrollbar-track` | `#F4F6F9` | `#252D3C` | Trilho |

### Fundo da página (rev. 6)

Valores finais: claro = "Lavanda → azul-gelo", escuro = "Grafite com brilho ciano" (análise de contraste por preset em `docs/design/fundo-gradiente-temas.md`, §2.4).

**Tokens.** Todos opacos, declarados com `light-dark()` em `tokens.css`: `--bg` (cor base), `--bg-stop-1..3` (paradas lineares) e `--bg-glow-1..2` (brilhos radiais). Valores na tabela de tokens acima. `--bg-gradient` é a receita, declarada uma vez fora de `light-dark()`, só com `var()` desses tokens e `transparent`:

```css
--bg-gradient:
  radial-gradient(circle at 12% 8%, var(--bg-glow-1), transparent 55%),
  radial-gradient(circle at 88% 92%, var(--bg-glow-2), transparent 50%),
  linear-gradient(160deg, var(--bg-stop-1), var(--bg-stop-2) 55%, var(--bg-stop-3));
```

A geometria (ângulo, centros, alcances) é única para os dois temas; só as cores variam. O tema resolve o `light-dark()` no elemento que usa `background-image`.

**Aplicação (`globals.css`).**

- `html` e `body` continuam com `background-color: var(--bg)` (overscroll, fallback, valor lido pelos testes).
- `body { isolation: isolate }` e `body::before`: `position: fixed; inset: 0; z-index: -1; pointer-events: none; background-color: var(--bg); background-image: var(--bg-gradient)`. Camada fixa na viewport, estática (sem animação), atrás do conteúdo; vale para todas as rotas, `loading.tsx`, `error.tsx` e `global-error.tsx`.
- **`.page-bg-window`**: `background-color: var(--bg); background-image: var(--bg-gradient); background-attachment: fixed`. Faixa opaca que mostra o mesmo trecho do gradiente que a camada fixa teria atrás dela. Usada na faixa de abas sticky de `/entries` (`entries-tabs-bar.tsx`, com `border-b border-border`).
- A 2ª linha da navbar no mobile ficou **sem fundo** (rola com a página; o fundo visível é a camada fixa).
- `.segmented` e `.tablist` têm `background: transparent` (contorno `--border-strong`). Sobre o gradiente mostram o fundo; no drawer mostram `--surface`.
- Nenhum `bg-bg` resta em `app/` e `components/`; `--bg` não é mais usado como fundo de componente.

**Superfícies.** Cards, drawer, modal, tooltip e inputs continuam opacos e com os valores da rev. 5; a navbar mantém `--header-bg` (alfa 0,95). A separação card/fundo continua sendo `--border` + `--shadow-card`. No escuro os brilhos são mais claros que `--surface`, então um card sobre o brilho fica levemente mais escuro que o fundo ao redor; é intencional. `--chart-cursor` (claro, `#EEF1F5`) e `--input-bg` (escuro, `#151B26`) mantêm os valores da rev. 5 e deixaram de ser "iguais ao fundo".

**Contraste.** Todo par cujo fundo é `--bg` vale no **pior caso** contra `--bg`, as paradas, as interpolações e os brilhos compostos (`PAGE_BACKGROUND_TOKENS`, `sampleGradient`). Nenhum mínimo foi afrouxado e nenhum token de texto mudou. Pior caso calculado no design para o par escolhido (razões arredondadas para baixo; a fonte de verdade é `tokens.spec.ts`):

| Frente | Mín. | Claro | Escuro |
|---|---|---|---|
| `--text` | 4,5 | 12,61 | 11,12 |
| `--text-muted` | 4,5 | 6,48 | 5,55 |
| `--accent` (texto, indicador, `--focus-color`) | 4,5 / 3 | 4,62 | 7,05 |
| `--danger-text` | 4,5 | 5,57 | 4,98 |
| `--text-disabled`, `--border-strong` | 3 | 3,78 | 3,66 |
| `--primary-border` | 3 | 5,42 | 4,62 |

Limites de luminância: escuro não preto (todas as cores em `[0,005; 0,25)`; o par limitante é `--danger-text` sobre o fundo) e claro não branco (nenhuma cor `#FFFFFF`, abaixo de `--surface`; o par limitante é `--accent`).

**Limitação conhecida (iOS Safari).** O iOS ignora `background-attachment: fixed` (trata como `scroll`). Nesse caso a `.page-bg-window` mostra o gradiente relativo à própria faixa, com uma pequena diferença de tom em relação à camada fixa (as paradas variam pouco de luminância). Não aparece barra sólida. A camada `body::before` (`position: fixed`) não é afetada.

**Observação para os testes.** O axe não enxerga o `body::before` e mede o texto contra `--bg`; o pior caso real é coberto por `tokens.spec.ts` e por `auditPageGradient` (`web/e2e/support.ts`). Ver ADR 0003 §5.5 e §13.

Histórico dos tokens: a primeira versão deste documento só tinha tema escuro e `--bg/--surface/--border/--primary/--accent/--success/--warning/--danger/--text/--text-muted`. A rev. 2 do design da feature introduziu `--surface-2`, `--surface-active`, `--input-bg`, `--header-bg`, `--border-strong`, `--text-disabled`, `--skeleton`, `--scrim`, `--primary-strong` (+ `-hover`, `-active`), `--primary-border`, `--on-primary`, `--focus-color`, `--focus-ring`, `--focus-offset`, variantes `*-text`, `--income`, `--expense`, todos os `--chart-*`, `--tooltip-*` e `--scrollbar-*`; `--primary` virou apenas glow decorativo e fundos de botão usam `--primary-strong`. A rev. 4 introduziu `--accent-active`. A rev. 5 suavizou superfícies, bordas, texto e `--accent` do escuro, e introduziu `--shadow-color` e `--shadow-card`; tokens semânticos e séries de gráfico mantiveram os valores (exceto `--chart-1`, `--chart-6`, eixo, grade, linha do zero e cursor, que acompanham os tokens de base). A rev. 6 trocou `--bg` por uma cor base nova (`#ECEEFC` / `#181E2A`) e introduziu `--bg-stop-1..3`, `--bg-glow-1..2` e `--bg-gradient`; superfícies, textos e semântica não mudaram de valor.

## Tipografia
- Títulos: Space Grotesk (600/700) | Corpo: Inter (400/500) | Mono: JetBrains Mono (carregadas com `next/font/google` em `web/app/layout.tsx`)
- Escala: 12 / 14 / 16 / 20 / 24 / 32 / 48

## Forma e profundidade
- Raio: 8px (inputs), 12px (cards), 999px (badges)
- Cartões (`--surface` sobre o fundo em gradiente: cards do resumo e do dashboard, cards de lista, tabela, blocos de fatura, cards de `/cards`): borda 1px (`--border`, ou `--border-strong` nos blocos de ação) + `--shadow-card`. A sombra é reforço visual; a separação não depende só dela.
- Menus, listas de combobox e tooltips: sombra mais marcada (definida por componente, sempre com `--shadow-color` ou cor de sombra transparente, nunca cor literal fora de `tokens.css`).
- Glow sutil na cor `--primary` apenas em elementos de foco.
- Blur (backdrop-filter) apenas em modais e headers fixos

## Motion
- 150–250ms, easing ease-out. Respeitar `prefers-reduced-motion`.
- Troca de tema é instantânea (sem transição de cor).
- O fundo em gradiente é estático: sem animação com nenhuma preferência de movimento.

## Layout responsivo (mobile-first)
- Breakpoints: sm 640 / md 768 / lg 1024 / xl 1280
- Grid de 4 colunas (mobile), 8 (tablet), 12 (desktop)
- Alvos de toque ≥ 44px
