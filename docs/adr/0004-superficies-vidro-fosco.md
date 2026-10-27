# ADR 0004 - Superfícies em vidro fosco e resumo do mês sem card externo

- **Status:** **Aceito** (2026-10-27). Implementado e aprovado no code review; os desvios em relação ao texto original estão no "Adendo – implementação" (fim do documento). Histórico: **Aprovado** no gate em 2026-10-27. Usuário aprovou a feature no gate: B1 = opção (a) (vidro de barra com alfa 0,91 no claro e 0,90 no escuro, nenhuma cor de texto muda); B2-B5 aprovados com as respostas padrão (resumo em 3 cards empilhados no mobile, mesmo layout em /dashboard, itens de lista e tabela em vidro com `thead` sticky em vidro de barra, título "Resumo de <mês>" visível no mobile). TQ1-TQ8 decididas pelo architect (§5). O §3.1 foi resolvido pela opção (a); o ui-designer fechou o alfa escuro em 0,90 (design §2.6).
- **Data:** 2026-10-26
- **Spec:** `docs/specs/superficies-vidro-fosco.md` (RF01-RF19, RNF01-RNF10, CA01-CA22, B1-B5, TQ1-TQ8, PA1-PA10, R1-R11)
- **Base:** `docs/adr/0003-fundo-gradiente-temas.md` (fundo em gradiente, `PAGE_BACKGROUND_TOKENS`, `sampleGradient`, `auditPageGradient`, `GradientRegion`). Este ADR **revoga a premissa B1 do 0003** ("superfícies e navbar sem vidro"). O restante do 0003 continua valendo.
- **Design:** `docs/design/design-system.md` rev. 7 (valores finais em `docs/design/superficies-vidro-fosco.md`).
- **Escopo:** só `web/`. **Nenhuma** mudança em `api/`, contratos HTTP, Prisma, schema ou migrations.
- **Autor:** architect

---

## 1. Contexto

O usuário viu o app com o fundo em gradiente (rev. 6) e reclamou de duas coisas: a navbar, os cards e alguns selects "não tiveram efeito", e o resumo mostra "3 cards dentro de um card". Ele decidiu: superfícies em vidro fosco (translúcidas, com `backdrop-filter: blur`, ~70%, borda clara de 1px, AA no pior caso) e resumo do mês sem card externo.

Fatos do código que condicionam as decisões (todos verificados no repositório):

1. **Tokens.** `web/app/styles/tokens.css` declara cada cor uma vez com `light-dark()`. `web/lib/theme/tokens.spec.ts` lê só declarações `--x: light-dark(a, b);`, lança erro em declaração duplicada, proíbe token fora de `EXPECTED_VALUES` e aceita alfa **só** em `--header-bg`, `--scrim` e `--shadow-color`. Declarações fora de `light-dark()` (`--shadow-card`, `--bg-gradient`, `--focus-offset`) são ignoradas pelo parser e têm testes estruturais próprios.
2. **Navbar.** `app-header.tsx` usa `bg-header backdrop-blur-md` com `--header-bg` em alfa 0,95. `HEADER_UNDER` (em `contrast-pairs.ts`) é `PAGE_BACKGROUND_TOKENS + --surface, --surface-2, --text`.
3. **Cascata (TQ6, R8): confirmado.** Em `web/app/globals.css` **todas** as classes de componente (`.btn*`, `.field`, `.checkbox`, `.segmented`, `.tablist`, `.tab`, `.card`, `.chip`, `.skeleton`, `.progress`, `.row-*`, `.drawer*`, `.modal`) e as regras de elemento (`input, select, textarea`, `option`, `dialog`) estão **fora de qualquer `@layer`**. O Tailwind 4 emite os utilitários em `@layer utilities`. Pela regra de cascade layers, uma declaração sem layer vence qualquer declaração em layer, **independentemente da especificidade e da ordem**. Consequências concretas encontradas:
   - `month-summary.tsx` l. 21: `card p-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none`. Os quatro utilitários `md:*` perdem para `.card { border; background; box-shadow }`, e o card externo continua visível no desktop. **É a causa do "3 cards dentro de um card".** (`p-4`/`md:p-0` funcionam, porque `.card` não declara `padding`.)
   - `month-summary.tsx` l. 101: `md:card` não gera nada, porque `.card` não é utilitário registrado (`@utility`). No desktop o skeleton mostra 3 blocos **sem** card, dentro do card externo.
   - `combobox.tsx` l. 127: `field pr-11`. `pr-11` perde para `.field { padding: 8px 12px }`, e o texto pode passar por baixo da seta. Mesmo defeito, ainda não percebido.
   - `expenses-list.tsx` l. 273: `Checkbox` com `-ml-3 -mt-2`. Os dois perdem para `.checkbox { margin: 0 }`. O ajuste de alinhamento do card mobile nunca foi aplicado.
4. **`<dl>` do resumo inválida.** Em `MonthSummary`, `dt`/`dd` ficam em `div` (ROW) dentro de `div` (GROUP) dentro de `dl`. O HTML só admite **um** nível de `div` entre `dl` e `dt`/`dd`, e há `<p>` (dicas "receitas − despesas pagas") dentro do `div` do grupo. O `a11y.pw.ts` roda só `color-contrast`, por isso ninguém viu. O axe completo reprovaria em `dlitem`/`definition-list`.
5. **Resumo compartilhado.** `MonthSummary`/`MonthSummarySkeleton` são usados em `/entries` (`entries-header.tsx`, `entries/loading.tsx`) e em `/dashboard` (`dashboard-blocks.tsx`, `dashboard/page.tsx`, `dashboard/loading.tsx`). O erro do bloco usa `BlockErrorBoundary compact` (`.card`).
6. **Material decidido no JSX.** Cerca de 12 lugares escrevem `bg-surface`/`bg-surface-2` + `border-border` + `shadow-card` direto no JSX (`EntryItem` em `expenses-list.tsx` e `income-panel.tsx`, linhas e `thead` das tabelas, toolbar de seleção, barra de lote, `invoice-block.tsx`, `tab-subtotal.tsx`, `InlineAlert`). `InlineAlert` e `EmptyState` aparecem **tanto** sobre a página **quanto** dentro de drawer/folha.
7. **Overlays.** Drawer, folha e modal são `<dialog>` com `showModal()` (`modal-dialog.tsx`). Ficam no top layer, e o bloco de contenção de `position: fixed` deles é sempre a viewport, mesmo que um ancestral tenha `backdrop-filter`. `FilterControls` (`expense-filters.tsx`) é renderizado na página (≥ md) **e** dentro de `BottomSheet` (< md).
8. **Popovers mapeados (R3).**
   - Seletor de mês: `month-picker.tsx`, `absolute z-30`, dentro de `EntriesHeader` (`<header>` sem fundo) e de `DashboardHeader`. Não fica dentro de superfície que vai virar vidro. Os cards do resumo vêm **depois** no DOM.
   - Combobox: lista `absolute z-20`, usado só dentro de drawers (opacos, top layer).
   - Tooltip do Recharts: dentro de `chart-card.tsx` (`.card`, que vira vidro). Sem `allowEscapeViewBox`, então fica contido na área do gráfico.
   - Toasts: `fixed z-50` em `ToastProvider` (layout `(app)`), fora de qualquer card.
   - Barra de lote mobile: `fixed bottom-0 z-30`, filha direta da raiz de `ExpensesList`, que não é superfície.
   - `PayConfirmDialog`/`ConfirmDialog`: `<dialog>` modal (top layer).
9. **Separadores dos gráficos.** `monthly-chart.tsx` (barras empilhadas, pontos, marcador de legenda e coluna sticky `bg-surface`) e `category-donut.tsx` (fatias) usam `var(--surface)` como contorno ou preenchimento "da cor do card".
10. **Auditoria e2e.** `pageGradientFailures` (`e2e/support.ts`) **ignora** todo texto com algum ancestral de fundo não transparente. Hoje os textos da navbar (0,95) ficam só com a camada 1. O `INCOMPLETE_ALLOWLIST` contém `/^header\b/` e `/\bheader\b/`, que casam **qualquer** `<header>`, inclusive `EntriesHeader` e `DashboardHeader`, onde está o resumo. Qualquer `incomplete` do axe no resumo passa hoje sem ser verificado.
11. O Playwright roda só Chromium (`playwright.config.ts`, projeto `chromium`), contra build de produção, com `@playwright/test` ^1.64. `page.emulateMedia` aceita `contrast` e `forcedColors`. `prefers-reduced-transparency` só sai por CDP.

---

## 2. Bounded context e linguagem ubíqua

**Bounded context:** *Apresentação / Design System* do `web`. Não há regra de negócio, dado persistido nem contrato novo. O contexto financeiro (lançamentos, cartões, faturas, totais) **não muda**: os valores do resumo continuam vindo da API (RF18).

Vale a linguagem da spec §2 (vidro fosco, superfície de vidro, vidro de barra, superfície opaca, overlay, popover, borda de vidro, composição de vidro, pior caso, fallback opaco, resumo do mês, título do resumo, aviso de mês vazio, card externo), com estes termos técnicos:

| Termo | Definição | Artefato |
|---|---|---|
| **Token de vidro** | Cor translúcida (alfa < 1) declarada uma vez com `light-dark()` em `tokens.css`. É o "material". | `--glass-bg`, `--glass-bg-2`, `--glass-input-bg`, `--glass-bar-bg`, `--glass-border` |
| **Raio de desfoque** | Comprimento único do blur, fora de `light-dark()`. | `--glass-blur` |
| **Papel de superfície** | Custom property **sem cor literal** que o componente consome. Aponta para o token de vidro ou para o token opaco, conforme o contexto. É o que torna o componente independente do material. | `--card-bg`, `--card-bg-2`, `--field-bg`, `--bar-bg`, `--card-border`, `--glass-filter`, `--item-filter`, `--chart-sep` (em `app/styles/glass.css`) |
| **Contexto opaco** | Subárvore em que os papéis apontam para os tokens opacos da rev. 6: overlays (`dialog`, `.drawer`, `.modal`) e qualquer `[data-surface="opaque"]`. | regra de reset em `glass.css` |
| **Fallback opaco** | Os papéis apontam para os tokens opacos em `:root`, por falta de suporte ou por preferência do usuário (RF06-RF08). | 2 blocos em `glass.css` |
| **Vidro plano** | Superfície translúcida **sem** desfoque, para itens repetidos (lista mobile, contêiner da tabela). Mesma cor e borda do vidro. | classe `.glass-flat` |
| **Backdrop root** | Ancestral com `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode` ou `backdrop-filter`. O desfoque de um descendente só enxerga o que está dentro dele. | invariante G7 |
| **Conteúdo sob barra** | Conjunto de cores que pode passar por baixo de um vidro de barra: amostras do fundo, superfícies opacas e de vidro, e os extremos de luminância do primeiro plano (`--text`, `--on-primary`). | `BAR_UNDER` (substitui `HEADER_UNDER`) |
| **Separador de gráfico** | Cor opaca que imita o card de vidro composto sobre a cor base, usada como contorno entre séries. | `--chart-separator` (token), `--chart-sep` (papel) |

---

## 3. Premissas pendentes de aprovação (B1-B5)

Adotadas como resposta padrão da spec. **Nenhuma foi aprovada ainda.** Se o usuário responder diferente, as seções indicadas mudam.

| # | Premissa adotada | Consequência técnica | Muda se a resposta for outra |
|---|---|---|---|
| **B1** | Barras sticky/fixas (navbar, `thead` sticky, barra de lote mobile, coluna sticky da tabela do gráfico) usam **vidro de barra**, mais opaco que o card, com o **menor alfa que passa AA no pior caso** (estimativa da spec: 0,80-0,85). Mesmo desfoque e mesma borda. | Token `--glass-bar-bg` com alfa próprio por tema; `BAR_UNDER` no pior caso. **Ver o achado do §3.1.** | §5.1, §5.3 |
| **B2** | No mobile, o resumo também vira **3 cards empilhados** (gap 12 px), com a compactação interna atual (valor na mesma linha do rótulo). | Um único layout em todos os breakpoints (§5.7). | §5.7 |
| **B3** | O novo layout vale também para **/dashboard**. | Nenhuma variante por tela; `MonthSummary` continua único. | §5.7 |
| **B4** | Itens de lista (mobile) e tabela (desktop) em vidro. Na tabela, o contêiner é de vidro, as linhas não têm fundo próprio e hover/seleção usam a variante 2. O **cabeçalho sticky** usa vidro de barra. | `.glass-flat` em itens e contêiner; `thead` com `.glass-bar` (§5.4). | §5.4, §8 |
| **B5** | O título "Resumo de <mês>" fica **visível também no mobile**, em texto simples `--text-muted`, 14 px, peso 500. | Sai o `sr-only` (§5.7). | §5.7 |

### 3.1 Achado sobre B1 (precisa do usuário no gate)

Calculei o pior caso com o método do `tokens.spec.ts`: barra composta sobre o conteúdo que rola por baixo, desfoque fora da conta. O resultado é que **0,80-0,85 não passa com as cores atuais da navbar**:

- **Claro:** `--accent` (item ativo, 14-16 px, `#0E7490`, L ≈ 0,146) sobre a barra branca composta sobre `--text` (`#1E293B`) precisa de fundo efetivo com L ≥ 0,832. Isso exige **α ≥ ~0,91**. Com 0,85 a razão fica em ~3,98:1 (< 4,5).
- **Escuro:** `--text-muted` (itens inativos, `#9BA5B7`) sobre a barra composta sobre `--text`/`--on-primary` exige **α ≥ ~0,89**. Com 0,85 a razão fica em ~4,17:1. O mesmo vale para o `thead` sticky, que usa `--text-muted`.

Opções para o gate:

| Opção | O que é | Custo |
|---|---|---|
| **(a) Padrão deste ADR** | Alfa por tema no menor valor que passa (≈ 0,91 claro / ≈ 0,89 escuro; o ui-designer fecha o valor exato na T1). Nenhuma cor de texto muda. | O gradiente atrás da navbar fica perceptível, mas discreto (9-11%). CA01 continua atendido (α < 1, blur). |
| (b) | α 0,80 e cores das barras trocadas: item ativo em `--text` + indicador `--accent` (não textual, 3:1), inativos em `--text`, `th` sticky em `--text`. Calculei que passa: `--text` ≥ 7:1 e foco ≥ 3,6:1 nos dois temas. | Muda o visual da navegação (RF fora do escopo atual) e precisa de aprovação explícita. |
| (c) | Tirar `--text` do conteúdo sob a barra. | **Descartada:** contraria RNF01 ("o pior caso também inclui o conteúdo que rola por baixo"). |

---

## 4. Modelo (equivalente de domínio para uma feature só de apresentação)

Não existe domínio no sentido da `api`: sem aggregates persistidos, repositórios, domain events ou use cases de aplicação. Mantenho a disciplina do 0003: **modelo puro** (tipos e funções sem React, DOM ou Next, em `web/lib/theme/`) separado de **apresentação** (CSS e componentes). O modelo puro não importa framework.

### 4.1 Value objects

```ts
// web/lib/theme/glass.ts (novo; puro, sem DOM)
import type { Rgba } from "./contrast";

/** Material de uma superfície: decide fundo, borda e desfoque (RF01). */
export type SurfaceMaterial = "glass" | "glass-flat" | "bar" | "opaque";

/** Uma camada da cadeia de ancestrais de um texto, do elemento para fora (lida no navegador ou montada em teste). */
export interface ChainLayer {
  /** background-color computado (rgb/rgba) */
  background: string;
  /** algum background-image */
  image: boolean;
  /** position computada: "sticky" | "fixed" identificam barras */
  position: string;
}

/** Classificação da cadeia para decidir quem audita o contraste (axe, pior caso do gradiente ou pior caso de vidro). */
export type ChainClass =
  | { kind: "transparent" }                // fundo = amostras do gradiente (comportamento do 0003)
  | { kind: "glass"; depth: number }       // so camadas translucidas; compor chain[0..depth) sobre as amostras
  | { kind: "bar"; depth: number }         // ha uma barra translucida sticky/fixed; compor chain[0..depth] sobre BAR_UNDER
  | { kind: "opaque" }                     // ha fundo opaco: o axe compoe corretamente
  | { kind: "image" };                     // background-image: so GradientRegion (0003 5.5)
```

**Invariantes** (verificadas por `tokens.spec.ts`, `glass-css.spec.ts` e e2e, conforme o §9):

- **G1 - Mesma tinta.** Cada token de vidro tem o **mesmo RGB** do opaco correspondente: `--glass-bg` ↔ `--surface`, `--glass-bg-2` ↔ `--surface-2`, `--glass-input-bg` ↔ `--input-bg`, `--glass-bar-bg` ↔ `--surface`. Só o alfa difere. Assim o fallback opaco é "o mesmo material sem transparência", e a troca não muda a tinta.
- **G2 - Alfas.** `0 < α(--glass-bg), α(--glass-bg-2), α(--glass-input-bg) < 1`. `α(--glass-bar-bg) ≥` o maior deles **e** `≤ 0,95` (herda o invariante do antigo `--header-bg`). Alfas podem variar por tema (PA1).
- **G3 - Tokens com alfa.** Exatamente `--glass-bg`, `--glass-bg-2`, `--glass-input-bg`, `--glass-bar-bg`, `--glass-border`, `--scrim` e `--shadow-color`. `--header-bg` deixa de existir (§5.1).
- **G4 - Borda de vidro decorativa.** `--glass-border` fica na allowlist de "decorativo" (como `--border`, PA5). Bordas de controle continuam `--border-strong`, com 3:1 no pior caso.
- **G5 - Desfoque.** `--glass-blur` é declarado uma vez, fora de `light-dark()`, comprimento entre 8 e 12 px. Nenhuma transição ou animação de `backdrop-filter`, `background` ou alfa nas regras de vidro (RNF06).
- **G6 - Separador.** `--chart-separator` é opaco e, em cada tema, `contrastRatio(--chart-separator, composite(--glass-bg, s)) ≤ 1,10` para toda amostra `s` do gradiente (indistinguível do card).
- **G7 - Sem backdrop root acima do vidro.** Nenhum elemento com `backdrop-filter ≠ none` tem ancestral com `backdrop-filter ≠ none`, `filter ≠ none`, `opacity < 1`, `mask`, `clip-path` ou `mix-blend-mode ≠ normal`. Sem isso o desfoque só enxerga a subárvore, e não o gradiente.
- **G8 - Empilhamento (R3).** Nenhum elemento `position: fixed` fora do top layer tem ancestral com `backdrop-filter`. Nenhum popover (`[role=listbox]`, grade do seletor de mês) é descendente de superfície com `backdrop-filter`. Exceção: o tooltip do Recharts, que precisa ficar **inteiro** dentro do retângulo do card.
- **G9 - Fallback em um ponto.** Os dois gatilhos de fallback (`@supports not` e `@media` de preferências) e o reset de contexto opaco declaram **o mesmo conjunto** papel → valor opaco da rev. 6. O bloco padrão de `:root` declara os mesmos papéis com os valores de vidro.
- **G10 - Separação card/fundo (RNF04).** Para toda amostra `s` e tema, `contrastRatio(composite(--glass-bg, s), s) ≥ R_SEP`. O ui-designer define `R_SEP` na rev. 7 (sugestão: 1,05). Além disso, `.glass`/`.card` declaram borda **e** sombra, verificado estaticamente.

### 4.2 Entities, aggregates, domain events

Nenhum, de propósito. Tokens e papéis não têm identidade nem ciclo de vida, e nada é persistido ou publicado.

### 4.3 "Repositórios" e ports

- **Sem repositório.** A fonte de verdade é `tokens.css`. O teste lê o arquivo com parser próprio (independente da implementação, como no 0003).
- **Port `TokenColorResolver`** (já existe no 0003 §4.3, reutilizado): o e2e resolve tokens para `Rgba` por sonda DOM, e as funções puras recebem o mapa já resolvido. Isso é DIP: `lib/theme/glass.ts` não sabe de DOM.
- **Política de auditoria como dado:** `BAR_UNDER` e `PAGE_BACKGROUND_TOKENS` são exportados de `contrast-pairs.ts` e injetados em `pageGradientFailures`. Política e cálculo ficam separados (§5.3).

### 4.4 Casos de uso (funções puras)

| Função | Entrada | Saída | Onde |
|---|---|---|---|
| `classifyChain(chain)` | `readonly ChainLayer[]` (texto → body, exclusive) | `ChainClass` | `lib/theme/glass.ts` |
| `expandUnders(colors, pageSamples)` | mapa token → `Rgba` (opacos e translúcidos), amostras do gradiente | `Rgba[]`: opaco entra como está; translúcido é composto sobre **cada** amostra | `lib/theme/glass.ts` |
| `worstOverLayers(fg, layersInnerFirst, unders)` | cor do texto, camadas translúcidas (mais interna primeiro), fundos possíveis | menor razão. **Move** `worstOverRegion` de `e2e/contrast.ts`, que passa a reexportá-la. | `lib/theme/glass.ts` |
| `separationRatio(glass, samples)` | token de vidro, amostras | menor razão entre a composição e a amostra (G10) | `lib/theme/glass.ts` |

```ts
export function classifyChain(chain: readonly ChainLayer[]): ChainClass;
export function expandUnders(colors: Readonly<Record<string, Rgba>>, pageSamples: readonly Rgba[]): Rgba[];
export function worstOverLayers(fg: Rgba, layersInnerFirst: readonly string[], unders: readonly Rgba[]): number;
export function separationRatio(glass: Rgba, samples: readonly Rgba[]): number;
```

Regras de `classifyChain`, na ordem:
1. Alguma camada com `image` → `image`.
2. Alguma camada com alfa 1 → `opaque`.
3. Todas com alfa 0 → `transparent`.
4. Senão, se alguma camada translúcida tem `position` `sticky` ou `fixed` → `bar`, com `depth` = índice dela. Só o trecho do texto até a barra fica **na frente**. O que está abaixo da barra na cadeia (por exemplo o card que contém um `th` sticky) está **atrás** e já é representado em `BAR_UNDER`. Compor esse trecho por cima seria otimista.
5. Senão → `glass`, com `depth` = tamanho da cadeia.

`worstOverLayers` e `expandUnders` lançam erro com lista vazia (falha fechada, como `worstCaseRatio`).

---

## 5. Decisões técnicas (TQ1-TQ8)

### 5.1 TQ1 - Representação do vidro nos tokens

**Decisão:** duas camadas, com responsabilidades separadas.

**Camada 1: material (`tokens.css`, cores com alfa em `light-dark()`, declaradas uma vez).** Os valores abaixo são **provisórios**. O ui-designer fecha na T1 (rev. 7), respeitando G1-G6 e G10.

```css
  /* vidro fosco (design rev. 7): mesma tinta das superficies opacas (G1), so o alfa difere */
  --glass-bg: light-dark(rgb(255 255 255 / 0.70), rgb(28 35 48 / 0.70));       /* = --surface */
  --glass-bg-2: light-dark(rgb(244 246 249 / 0.70), rgb(37 45 60 / 0.70));     /* = --surface-2 */
  --glass-input-bg: light-dark(rgb(255 255 255 / 0.70), rgb(21 27 38 / 0.70)); /* = --input-bg */
  --glass-bar-bg: light-dark(rgb(255 255 255 / 0.91), rgb(28 35 48 / 0.89));   /* vidro de barra (B1, ver 3.1) */
  --glass-border: light-dark(rgb(255 255 255 / 0.60), rgb(255 255 255 / 0.08)); /* decorativa (PA5) */
  --glass-blur: 12px;                                                           /* fora de light-dark (G5) */
  --chart-separator: light-dark(#F9FAFE, #1B222E);  /* ~ --glass-bg sobre --bg (G6) */
```

- **`--header-bg` sai** e dá lugar a `--glass-bar-bg`. O nome antigo era de componente (navbar), mas o papel agora vale para quatro barras (`thead`, barra de lote, coluna sticky). O invariante "≤ 0,95" passa para o novo token (G2). O utilitário `bg-header` (`--color-header`) sai junto.
- **Contraste: composto, não pré-calculado.** Os tokens ficam translúcidos e os testes compõem sobre cada amostra (§5.3). **Não** existe um "equivalente opaco" por token para o cálculo: um valor opaco único não representa o gradiente inteiro e esconderia o pior caso.
- **Variante de tabela/hover:** `--glass-bg-2` cobre hover, linha selecionada, item selecionado no mobile, `.row-highlight` e o subtotal.

**Camada 2: papéis (`web/app/styles/glass.css`, novo, importado por `globals.css` logo depois de `tokens.css`).** Só `var()`, sem literal (o scanner continua verde, RF10). Os componentes consomem **só os papéis**:

```css
:root {
  --card-bg: var(--glass-bg);
  --card-bg-2: var(--glass-bg-2);
  --field-bg: var(--glass-input-bg);
  --bar-bg: var(--glass-bar-bg);
  --card-border: var(--glass-border);
  --glass-filter: blur(var(--glass-blur));
  --item-filter: none;               /* itens repetidos: vidro plano (TQ3, 5.5) */
  --chart-sep: var(--chart-separator);
}
```

**Por que papéis em vez de os componentes usarem `--glass-*` direto:** o mesmo componente (`InlineAlert`, `EmptyState`, `.field`) aparece sobre a página e dentro de overlays. O contexto decide o material por herança de custom property, e o componente não precisa saber onde está (DIP, §10). A troca de tema continua no mesmo quadro: os papéis só referenciam tokens `light-dark()` já resolvidos no `:root` (0003 §5.8, adendo do Lightning CSS).

**`@theme inline` (globals.css):** remove `--color-header`. Adiciona `--color-card: var(--card-bg)`, `--color-card-2: var(--card-bg-2)`, `--color-field: var(--field-bg)`, `--color-bar: var(--bar-bg)` e `--color-card-border: var(--card-border)`. Mais `@utility backdrop-glass { backdrop-filter: var(--glass-filter); -webkit-backdrop-filter: var(--glass-filter); }`.

**Classes de superfície** (em `@layer components`, §5.8):

```css
@layer components {
  .glass, .card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    box-shadow: var(--shadow-card);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
  }
  .card { border-radius: 12px; }
  .glass-flat { background: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--shadow-card);
                -webkit-backdrop-filter: var(--item-filter); backdrop-filter: var(--item-filter); }
  .glass-bar { background: var(--bar-bg); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); }
  .field { background: var(--field-bg); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); /* + regras atuais */ }
  .field:disabled, .field[readonly] { background: var(--surface-2); -webkit-backdrop-filter: none; backdrop-filter: none; } /* PA3 */
  .row-selected, .row-highlight { background: var(--card-bg-2); /* + box-shadow atual */ }
}
```

A sombra fica `--shadow-card` (PA6). O ui-designer pode subir `--shadow-color` na rev. 7 para cumprir G10/RNF04.

### 5.2 TQ4 - Fallback opaco em um único ponto

**Decisão:** em `glass.css`, dois gatilhos globais e um reset de contexto, com o **mesmo** conjunto de declarações (G9):

```css
/* (1) sem suporte a backdrop-filter, com ou sem prefixo (RF06, R10) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { /* OPACO */ }
}
/* (2) preferencias do usuario (RF07, RF08, PA4). Lista com virgula: navegador sem
   prefers-reduced-transparency (R9) ignora so aquele termo, os outros continuam valendo */
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active) {
  :root { /* OPACO */ }
}
/* (3) contexto opaco: overlays e quem declarar (RF05, PA2, PA8) */
dialog, .drawer, .modal, [data-surface="opaque"] { /* OPACO */ }

/* OPACO = valores da rev. 6 */
--card-bg: var(--surface);
--card-bg-2: var(--surface-2);
--field-bg: var(--input-bg);
--bar-bg: var(--surface);      /* alfa 1 (CA08): a navbar deixa de ser 0,95 */
--card-border: var(--border);
--glass-filter: none;
--item-filter: none;
--chart-sep: var(--surface);
```

- **Por que repetir e não fatorar:** CSS não combina `@supports` e `@media` com "ou" numa regra só. A alternativa sem repetição seria style query (`@container style(--glass: off)`), mas ela ainda não tem suporte amplo. A repetição fica num arquivo só, e o `glass-css.spec.ts` exige que os três blocos sejam idênticos e cubram todos os papéis do `:root`. Esquecer um papel deixa o teste vermelho.
- **Ordem:** os blocos (1) e (2) vêm depois do `:root` padrão, porque têm a mesma especificidade e quem vem depois vence. O bloco (3) é por seletor de elemento, então vale dentro do overlay mesmo com o vidro ligado.
- O fallback **não** usa `var(--bg)` (o teste do 0003 continua válido).
- **Build:** o Lightning CSS do Tailwind 4 pode reescrever prefixos e queries. Por isso o e2e verifica as regras **compiladas** pelo CSSOM (`CSSSupportsRule`/`CSSMediaRule` com a condição esperada e as declarações esperadas), além do teste estático do fonte (§9).

### 5.3 TQ2 - Contraste no pior caso com vidro

**Camada 1 (`contrast-pairs.ts` + `tokens.spec.ts`).**

`contrast-pairs.ts`:

```ts
export const PAGE_BACKGROUND_TOKENS = [/* inalterado */] as const;
/**
 * O que pode passar sob um vidro de barra (B1, R1): o fundo, superficies opacas e de vidro (translucidas sao
 * compostas sobre cada amostra do fundo) e os extremos de luminancia do primeiro plano nos dois temas.
 */
export const BAR_UNDER = [
  ...PAGE_BACKGROUND_TOKENS,
  "--surface", "--surface-2", "--glass-bg", "--glass-bg-2", "--glass-input-bg",
  "--text", "--on-primary", "--primary-strong",
] as const;
```

- **Semântica de `over` estendida** (documentada no tipo `ContrastPair`): uma entrada translúcida de `over` é expandida para "ela composta sobre cada amostra do fundo" (`expandUnders`). Isso cobre vidro sobre o gradiente, barra sobre vidro e hover (`--glass-bg-2`) sobre o contêiner de vidro, com um só nível de recursão.
- **Novos pares**, com `where` contendo "vidro" (o teste exige):
  - `bg: "--glass-bg"`, `over: PAGE_BACKGROUND_TOKENS`: todo `fg` hoje verificado sobre `--surface` em contexto de página. São `--text`, `--text-muted`, `--accent` (texto e não texto), `--success-text`, `--warning-text`, `--danger-text`, `--income`, `--expense`, `--chart-axis`, `--text-disabled`, `--border-strong`, `--primary-border`, `--focus-color`, `--danger`, `--success`, `--warning`, `--tooltip-border` e todos os `--chart-*` de série (R6, RNF01).
  - `bg: "--glass-bg-2"`, `over: [...PAGE_BACKGROUND_TOKENS, "--glass-bg"]`: o conjunto atual de `--surface-2` (hover, seleção, subtotal, item selecionado).
  - `bg: "--glass-input-bg"`, `over: [...PAGE_BACKGROUND_TOKENS, "--glass-bg"]`: `--text`, `--text-muted` (placeholder), `--border-strong`, `--focus-color`, `--danger`, `--danger-text`.
  - `bg: "--glass-bar-bg"`, `over: BAR_UNDER`: `--text`, `--text-muted`, `--accent`, `--focus-color`, `--border-strong`, `--primary-border`. Substituem os quatro pares de `--header-bg`.
- **Pares opacos ficam** (RNF02/RNF03): os de `--surface`, `--surface-2` e `--input-bg` continuam valendo para overlays e para o fallback, com as mesmas razões.

`tokens.spec.ts` (oráculo independente, escrito pelo tester na T3):
- `EXPECTED_VALUES` passa à rev. 7: entram os 5 tokens de vidro e `--chart-separator`, sai `--header-bg`.
- A lista de tokens com alfa passa a ser G3. O invariante de alfa da barra passa a G2.
- `backgroundsOf(name)` fica recursivo: conjunto do fundo → amostras; translúcido → composto sobre cada amostra; opaco → ele mesmo. `ratioOf` usa as amostras como `over` padrão de qualquer `bg` translúcido.
- `BAR_UNDER` **local** do teste (independente do de produção), com a mesma composição, e um teste que exige igualdade com o exportado.
- Teste de **extremos**: em cada tema, o token opaco de **menor** e o de **maior** luminância entre os tokens de cor do primeiro plano e das superfícies estão em `BAR_UNDER`. Se um token futuro for mais escuro ou mais claro que `--text`/`--on-primary`, o teste falha.
- G1, G2, G5, G6 e G10 como testes próprios. "Todo token aparece em um par": `--glass-border` e `--chart-separator` entram na allowlist de decorativos, com justificativa (G4/G6).
- O teste "navbar (--header-bg 0,95) composta sobre cada amostra" vira "vidro de barra composto sobre `BAR_UNDER`", com os `expected` recalculados pelo ui-designer. Nenhum mínimo é afrouxado.

**Camada 2 (navegador, `e2e/support.ts`).** `pageGradientFailures` passa a usar `classifyChain`:

```ts
export interface WorstCaseOptions {
  pageTokens?: readonly string[];   // padrao: PAGE_BACKGROUND_TOKENS
  barUnder?: readonly string[];     // padrao: BAR_UNDER
}
export async function pageGradientFailures(page: Page, options?: WorstCaseOptions): Promise<string[]>;
```

- No `evaluate`, para cada texto visível: cadeia de `ChainLayer` até o body (exclusive), opacidade acumulada, cor, tamanho e peso. As cores dos tokens de `pageTokens ∪ barUnder` são lidas por sonda (já é assim).
- Fora do `evaluate`, por classe da cadeia:
  - `transparent`: como hoje.
  - `glass`: `worstOverLayers(fg, chain[0..depth), amostras)`.
  - `bar`: `worstOverLayers(fg, chain[0..depth], expandUnders(barUnder, amostras))`.
  - `opaque` e `image`: ficam com o axe (e com `GradientRegion`).
  - Opacidade < 1 continua reprovando.
- Assim os textos da navbar (R1), do `thead`, da barra de lote e de todo card de vidro (R2) passam a ser auditados no pior caso. Hoje são ignorados.
- **R1 no navegador:** os cenários de CA02 rolam a lista `many` até o conteúdo passar sob a navbar e o `thead`, e chamam `auditPageGradient`. O cálculo usa `BAR_UNDER` (conjunto fechado), e não os pixels do momento. A rolagem garante que o estado real (sticky ativo, `position` computada) foi exercitado.
- **`INCOMPLETE_ALLOWLIST` diminui:** fica só `/\[data-navbar\]/`. As regexes `/^header\b/`, `/^nav\b/` e `/\bheader\b/` casam também `EntriesHeader`/`DashboardHeader` (fato 10) e escondem o resumo. A cobertura da navbar fica com a camada 1 e com a auditoria `bar`. Se a T6 mostrar `incomplete` legítimo em `nav` (2ª linha mobile), entra um seletor específico com justificativa. A allowlist **não cresce**.
- **Axe e vidro:** o axe compõe o fundo translúcido sobre `--bg` (a cor do body) e não vê o gradiente nem o desfoque. Não há sinal de que `backdrop-filter` gere `incomplete`. Se a T6 encontrar algum, o `messageKey` encontrado **não** entra em `RESOLVABLE_MESSAGE_KEYS`. Cria-se uma `GlassRegion` declarada pela tela, no mesmo molde da `GradientRegion` (resolução só dentro de região declarada, veredito pelo pior caso), e este ADR recebe um adendo.

### 5.4 TQ5 (empilhamento, R3) - Onde o `backdrop-filter` pode ficar

**Decisão:** `backdrop-filter` direto no elemento, **só em superfícies folha** (que não contêm popovers nem `fixed`), travado por invariantes verificados no navegador (G7, G8). O mapeamento do fato 8 mostra que nenhum popover atual fica dentro de superfície de vidro. Os riscos reais e o tratamento:

| Caso | Risco | Tratamento |
|---|---|---|
| Seletor de mês acima dos cards do resumo | Os cards com `backdrop-filter` viram contextos de empilhamento e vêm depois no DOM. | A grade do picker é `absolute z-30` no contexto do body, e os cards ficam no nível z 0/auto. O picker fica por cima. CA12 verifica com `elementFromPoint` nos quatro cantos e no centro da grade, em 360 e 1280 px, em `/entries` e `/dashboard`. |
| Combobox | Nenhum (só em drawer, top layer). | Teste existente + contexto opaco. |
| Tooltip do Recharts dentro do card de vidro | Fica preso ao contexto do card. | Aceito: fica contido na área do gráfico (sem `allowEscapeViewBox`). O guarda e2e verifica que o retângulo do tooltip está dentro do card. |
| Barra de lote `fixed` | Viraria contida no card se um ancestral ganhasse vidro. | `ExpensesList` e os painéis **não** recebem vidro no contêiner (só filhos folha). Guarda G8. |
| Toasts, overlays | Nenhum (layout raiz e top layer). | Testes existentes. |

**Guardas** (helper `glassStackingProblems(page)` em `e2e/support.ts`, chamado em cada tela × tema × breakpoint de `glass.pw.ts`): devolve `[]` se G7 e G8 valem no DOM atual.

**Padrão reservado (não adotado agora):** se um dia uma superfície de vidro precisar conter um popover, o vidro vai para um `::before` (`position: absolute; inset: 0; z-index: -1; backdrop-filter`), com o elemento `position: relative` **sem** `z-index` nem `isolation`. Assim o elemento não vira contexto de empilhamento nem bloco de contenção. Fica registrado aqui para não ser reinventado. Não é o padrão porque depende de todos os ancestrais serem transparentes e complica as barras sticky.

### 5.5 TQ3 - Onde aplicar o desfoque e com que raio (R4, RNF05)

**Decisão:** raio `--glass-blur: 12px` (o ui-designer pode baixar até 8 px). Desfoque só em barras e em superfícies de topo pouco numerosas. Itens repetidos ficam em **vidro plano**.

| Superfície | Material | Desfoque |
|---|---|---|
| Navbar, `thead` sticky (despesas e receitas), barra de lote mobile | `.glass-bar` | Sim. É onde o desfoque tem efeito visível, porque há conteúdo com detalhe por baixo. |
| Coluna sticky da tabela do gráfico (`monthly-chart.tsx` `th`) | `bg-bar`, sem desfoque | Não: são até 13 células e ficam dentro do card, que já é backdrop root. A cor de barra já passa AA sobre `--text` por baixo (`BAR_UNDER`). Revoga o "Opaco (*)" do inventário, com confirmação do ui-designer. |
| `.card` (3 do resumo, gráficos, `/cards`, `EmptyState`, erros, `BlockErrorBoundary`, alerta de `expenses-panel`), `invoice-block`, subtotal, toolbar de seleção desktop, `InlineAlert`, `.field` sobre a página | `.glass` / `.card` / `.field` | Sim (CA03, CA04). |
| `EntryItem` mobile (até ~50), contêiner da tabela desktop | `.glass-flat` | **Não** (`--item-filter: none`). Atrás deles só há o gradiente suave e estático: o desfoque não muda o resultado e custaria um re-desfoque por item a cada quadro de rolagem. |
| Linhas da tabela | sem fundo próprio. Hover, seleção e realce usam `--card-bg-2`. | Não |

- **Pior caso de camadas desfocadas simultâneas:** ~6 no mobile (navbar, 3 cards, subtotal, barra de lote) e ~10 no desktop (navbar, 3 cards, toolbar, 3-4 filtros, subtotal, `thead`). Todas pequenas, exceto a navbar.
- **Ajuste de um ponto só:** se a medição da T10 passar **com** desfoque nos itens, basta trocar `--item-filter: none` por `var(--glass-filter)` em `glass.css` (spec TQ3: "se passar, mantém-se o desfoque em tudo"). Se reprovar mesmo assim, baixa-se `--glass-blur` para 8 px e mede-se de novo.
- **CA03 para itens e tabela:** com esta decisão, o "backdrop-filter contém blur" do CA03 vale para `.card` e equivalentes, e **não** para `.glass-flat`. O e2e verifica `backdrop-filter` igual a `var(--item-filter)` resolvido. Registrado como interpretação de CA03 + TQ3, a confirmar no gate.
- **Medição (TQ5 da spec):** a mesma do 0003 §5.7. Lighthouse mobile em `/entries?month=2026-11`, 3 execuções, mediana, contra o commit base `d8483d6` (rev. 6): queda ≤ 5 pontos e ΔCLS ≤ 0,01. Mais trace do Chrome rolando o cenário `many` com CPU 4x mais lenta, sem quadros > 50 ms recorrentes atribuídos a paint/composição. Execução manual com registro em `docs/runs/superficies-vidro-fosco.md`. Fora do CI.

### 5.6 TQ7 - Emulação no Playwright

- **`prefers-reduced-transparency: reduce`:** sessão CDP (`page.context().newCDPSession(page)`) com `Emulation.setEmulatedMedia({ features: [{ name: "prefers-reduced-transparency", value: "reduce" }] })`. Helper `emulateReducedTransparency(page)` em `support.ts`.
- **`prefers-contrast: more`** e **`forced-colors: active`:** `page.emulateMedia({ contrast: "more" })` e `page.emulateMedia({ forcedColors: "active" })`.
- **Sem suporte a `backdrop-filter`** (não dá para desligar no Chromium):
  1. Teste estático do fonte (`glass-css.spec.ts`): a condição `@supports not (... or -webkit-...)` existe e o bloco é idêntico ao opaco (G9).
  2. E2E pelo CSSOM do build: acha a `CSSSupportsRule` cuja condição cita `backdrop-filter` **e** `-webkit-backdrop-filter` e confere as declarações. Depois injeta **o `cssText` do `:root` daquela própria regra** como estilo de página. Com isso, verifica que navbar, cards e campos ficam com alfa 1 e `backdrop-filter: none`, e roda `audit` + `auditPageGradient`. O conteúdo vem da regra compilada, não de uma cópia no teste, o que evita a tautologia de "injetar a mesma regra" escrita à mão.

### 5.7 TQ6 - Resumo do mês sem card externo e correção da cascata

**Correção da cascata (R8):** todas as classes de componente de `globals.css` vão para `@layer components`, e as regras de elemento (`input, select, textarea`, `option`, `::placeholder`, autofill, `dialog`, `dialog::backdrop`) vão para `@layer base`. Ficam **fora** de layer, de propósito: `html`, `body`, `body::before`, `.page-bg-window`, `:focus-visible`, `::selection`, `data-theme-switching` e o ícone sol/lua, que são regras globais de tema e não devem ser sobrescritas por utilitários.

- **Por que mover tudo e não só `.card`:** o mesmo defeito já quebra `combobox.tsx` (`pr-11`) e `expenses-list.tsx` (`-ml-3 -mt-2`). Mover só `.card` deixa a armadilha armada para a próxima pessoa.
- **Efeito visível previsto (aceito):** `pr-11` passa a valer no input do combobox (o texto não passa mais sob a seta) e o `Checkbox` mobile ganha o deslocamento `-ml-3 -mt-2` que o código sempre pediu. O ui-designer confere os dois na T1. Não há outra combinação classe+utilitário conflitante em `app/` e `components/` (varredura do fato 3).
- **Trava:** `glass-css.spec.ts` exige que todo seletor de classe de `globals.css` fora da allowlist acima esteja dentro de `@layer components`. A varredura de marcação reprova `className` com `md:card` ou com qualquer classe de componente usada como variante (`<breakpoint>:<classe>`).

**Novo markup do `MonthSummary`** (Server Component, sem `"use client"`). Um layout só, em todos os breakpoints (B2/B3):

```tsx
<section aria-labelledby={headingId} className="flex flex-col gap-3">
  <h2 id={headingId} className="text-sm font-medium text-muted">Resumo de {monthLongPtBR(month)}</h2>   {/* B5: visivel */}
  <dl className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
    <div className={`card ${SUMMARY_CARD}`}>  {/* Receitas: dt, dd */}            </div>
    <div className={`card ${SUMMARY_CARD}`}>  {/* Despesas: dt/dd total, dt/dd Pago, dt/dd Pendente */} </div>
    <div className={`card ${SUMMARY_CARD}`}>  {/* Saldo: dt/dd realizado, dt/dd previsto */} </div>
  </dl>
  {isEmpty(totals) ? <p className="text-sm text-muted">Sem lançamentos neste mês</p> : null}             {/* RF14 */}
</section>
```

- **Um `dl`, um nível de `div`** (corrige o fato 4). Cada card é o `div` de agrupamento e contém os pares `dt`/`dd` **diretamente**, sem `div` intermediário. O arranjo "rótulo à esquerda, valor à direita" vem de CSS grid no próprio card (`grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1`, com variações `md:` definidas pelo ui-designer). As dicas "receitas − despesas pagas" / "− todas as despesas" ficam **dentro** do `dd` correspondente (`<span className="hidden text-xs text-muted md:block">`), porque `p` não pode ser filho do `div` de grupo. O atributo `title` continua no `dd`.
- **Ordem de leitura e textos inalterados** (RF15, PA9): título → Receitas → Despesas (total, Pago, Pendente) → Saldo (realizado, previsto) → aviso. `Money`, `SignIndicator` e `StatusDot` como hoje (RF18).
- **Sem card externo:** o `<section>` não tem fundo, borda nem sombra em nenhum breakpoint (CA15/CA16). Nada é "anulado" com utilitário: o card externo simplesmente não existe.
- **Contraste do texto simples:** título e aviso ficam sobre o gradiente (`--text-muted` sobre `--bg`, pior caso 6,48/5,55, CA19), cobertos por `auditPageGradient` (cadeia `transparent`).
- **Skeleton sem salto (RF16, CA20):** as classes de layout ficam em constantes **compartilhadas** do módulo (`SUMMARY_GRID`, `SUMMARY_CARD`, `SUMMARY_TITLE`). O skeleton usa as mesmas, para não divergir:

```tsx
<div aria-busy="true" className="flex flex-col gap-3">
  <span className="sr-only">Carregando resumo do mês</span>
  <Skeleton className="h-5 w-48" />                               {/* altura da linha do titulo (14px / 20px) */}
  <div className={SUMMARY_GRID}>
    {SKELETON_ROWS.map((rows, i) => (                              /* [1, 3, 2]: mesmas linhas de cada card real */
      <div key={i} className={`card ${SUMMARY_CARD}`}>{/* rows x (Skeleton rotulo + Skeleton valor) */}</div>
    ))}
  </div>
</div>
```

  O número de linhas por card do skeleton (1, 3, 2) espelha os cards reais, para as alturas baterem no mobile empilhado. O CLS da troca é medido em e2e (≤ 0,01).
- **Impacto nos chamadores:** nenhum. `entries-header.tsx`, `dashboard-blocks.tsx`, `loading.tsx` e `dashboard/page.tsx` continuam passando `month`, `totals` e `headingId`. `UpdatingRegion` (sem opacidade, `relative` sem `z-index`) não vira backdrop root (G7) nem contexto de empilhamento.

### 5.8 TQ8 - Separadores dos gráficos (R6)

**Decisão:** token opaco `--chart-separator` (G6) e papel `--chart-sep`. Todos os usos de `var(--surface)` como separador ou miolo trocam para `var(--chart-sep)`:
- `monthly-chart.tsx`: `stroke` das duas `Bar`, `stroke` dos `dot`/`activeDot` de "Saldo realizado", `fill` dos `dot`/`activeDot` ocos de "Saldo previsto", marcador de legenda (l. 156).
- `category-donut.tsx`: `stroke` do `Pie` e das `Cell` inativas. A `Cell` ativa continua `var(--text)`.

**Por que opaco e não translúcido:** um contorno translúcido sobre a série deixaria a cor da série vazar e enfraqueceria a separação entre fatias e barras. Um opaco igual a `--surface` vira um contorno de outra cor sobre o vidro (R6). O valor "vidro sobre a cor base" fica indistinguível do card em todo o gradiente, porque a faixa de luminância das paradas é estreita, e G6 trava isso. No fallback, `--chart-sep` volta a `--surface` e coincide com o card opaco.

**Mantidos opacos:** pílula "Sem lançamentos de…" (`bg-surface`) e tooltip (`--tooltip-bg`). `--chart-cursor` continua opaco e decorativo. Se ficar chapado sobre o vidro, o ui-designer pode torná-lo translúcido na rev. 7, como token decorativo novo na allowlist.

---

## 6. Endpoints e impacto no Next.js

- **API/HTTP:** nenhum endpoint novo ou alterado. Nenhum DTO. Nenhum formato de erro novo.
- **Server actions:** nenhuma.
- **Páginas:** nenhuma rota nova. Mudança visual em `/entries`, `/cards` e `/dashboard`, inclusive em `loading.tsx` e `error.tsx`, por CSS (`tokens.css`, `glass.css`, `globals.css`) e por troca de classes nos componentes do §8. `MonthSummary` continua Server Component. `global-error.tsx` importa `globals.css`, que importa `glass.css`, então o fallback e os papéis valem também lá.
- **Renderização:** nada muda em dinamismo, cache ou streaming. O `Suspense` do resumo continua com `MonthSummarySkeleton` (agora com o mesmo layout).

---

## 7. Prisma, schema e migrations

Nenhuma mudança. A feature é só `[web]` (spec §6). Não há migration nem estratégia de rollout de dados. O rollback é reverter o PR.

---

## 8. Arquivos a criar e a alterar

### 8.1 Criar

| Arquivo | Conteúdo |
|---|---|
| `web/app/styles/glass.css` | Papéis (`:root`), fallback `@supports not`, fallback `@media` de preferências e reset de contexto opaco (§5.1, §5.2). Sem literal. |
| `web/lib/theme/glass.ts` | `classifyChain`, `expandUnders`, `worstOverLayers` (movida de `e2e/contrast.ts`) e `separationRatio` (§4.4). |
| `web/lib/theme/glass.spec.ts` | Unitários das funções puras. |
| `web/lib/theme/glass-css.spec.ts` | Estáticos de `glass.css` e `globals.css`, mais varredura de marcação (§9.1). |
| `web/e2e/glass.pw.ts` | CA01-CA05, CA08-CA13 e guardas G7/G8. |
| `web/e2e/month-summary.pw.ts` | CA15-CA17, CA20 e CA21 (layout, computados, sem rolagem horizontal, CLS do skeleton). |
| `docs/runs/superficies-vidro-fosco.md` | Medição da T10 (CA14). |

### 8.2 Alterar

| Arquivo | Mudança |
|---|---|
| `web/app/styles/tokens.css` | + `--glass-bg`, `--glass-bg-2`, `--glass-input-bg`, `--glass-bar-bg`, `--glass-border`, `--glass-blur` e `--chart-separator`; − `--header-bg`. |
| `web/app/globals.css` | `@import "./styles/glass.css"`. `@theme inline` (− `--color-header`; + `card`, `card-2`, `field`, `bar`, `card-border`). `@utility backdrop-glass`. Classes de componente em `@layer components` e regras de elemento em `@layer base` (§5.7). `.glass`, `.glass-flat`, `.glass-bar` e `.card` novo. `.field` com `--field-bg` + desfoque. `.row-selected`/`.row-highlight` com `--card-bg-2`. |
| `web/components/app-header.tsx` | `bg-header backdrop-blur-md` → `glass-bar`. O link "Pular para o conteúdo" continua `focus:bg-surface` (opaco). |
| `web/components/month-summary.tsx` | Novo markup e skeleton (§5.7). |
| `web/app/(app)/entries/_components/expenses-list.tsx` | Toolbar desktop `glass rounded-lg`. Tabela envolvida em `div.glass-flat rounded-xl overflow-clip` (`overflow: clip` não cria contêiner de rolagem, então o `thead` sticky continua funcionando), sem borda nem sombra própria. `thead` `glass-bar` (sai `bg-surface`). Linhas sem `bg-surface`, hover `hover:bg-card-2`. `EntryItem` `glass-flat rounded-xl p-4` (selecionado `bg-card-2 border-accent`). Barra de lote `glass-bar` (sai `bg-surface-2`). |
| `web/app/(app)/entries/_components/income-panel.tsx` | Mesmo tratamento de tabela, `thead` e `EntryItem`. |
| `web/app/(app)/entries/_components/invoice-block.tsx` | Bloco `glass rounded-xl border-border-strong`. O `dl` de totais no mobile perde `bg-surface-2` (sem vidro sobre vidro) e ganha separação por `border-t border-border`, conforme o ui-designer. O alerta interno perde `bg-surface` (fica sobre o próprio bloco, com a borda `--danger`). |
| `web/app/(app)/entries/_components/tab-subtotal.tsx` | `glass bg-card-2 rounded-lg` (sai `bg-surface-2`). |
| `web/components/ui/states.tsx` | `InlineAlert`: `bg-surface shadow-card` → `glass` (a borda colorida continua via utilitário, que agora vence `.glass`). `EmptyState` sem mudança (já usa `.card`). |
| `web/app/(app)/dashboard/_components/monthly-chart.tsx` | `var(--surface)` → `var(--chart-sep)` (§5.8). `th` sticky `bg-surface` → `bg-bar`. A pílula continua `bg-surface`. |
| `web/app/(app)/dashboard/_components/category-donut.tsx` | `stroke` → `var(--chart-sep)`. |
| `web/lib/theme/contrast-pairs.ts` | `BAR_UNDER` (substitui `HEADER_UNDER`), semântica de `over`, pares de vidro, pares da barra (§5.3). |
| `web/lib/theme/tokens.spec.ts` | §5.3, camada 1. |
| `web/lib/theme/page-background.spec.ts` | O parser já entra em `@layer`. Confirmar que os testes de `body::before`, `.page-bg-window` e `.segmented`/`.tablist` continuam achando as regras (as duas últimas passam a estar em `@layer components`). |
| `web/e2e/support.ts` | `pageGradientFailures` com `classifyChain` e `WorstCaseOptions`. `INCOMPLETE_ALLOWLIST` reduzida a `[data-navbar]`. `emulateReducedTransparency`, `glassStackingProblems`, `resolveTokens` para os tokens de vidro e reexport de `BAR_UNDER`. |
| `web/e2e/contrast.ts`, `web/e2e/contrast.spec.ts` | `worstOverRegion` reexportada de `lib/theme/glass.ts` (sem mudança de comportamento). `GlassRegion` só se a T6 achar `incomplete` (§5.3). |
| `web/e2e/a11y.pw.ts` | Mesmas telas e estados nos dois temas, com a auditoria estendida. Novos estados: resumo em mês vazio e lista `many` rolada sob navbar e `thead` (CA02, CA07, CA19). |
| `web/e2e/dark-theme.pw.ts` | `expectDark(".card")` passa a compor a cor do card sobre `BG.dark` (alfa < 1) antes de medir a luminância. Overlays, listbox, menu de mês, toast e tooltip mantêm a expectativa opaca. |
| `web/e2e/theme.pw.ts` | `expectDialogTokens` continua válido (contexto opaco). Novo: troca de tema no mesmo quadro para `--card-bg` da navbar, do card e do `.field` dos filtros (CA11). |
| `web/e2e/theme-charts.pw.ts` | Passa a ler `--chart-sep` em vez de `--surface` como separador. |
| `web/e2e/page-background.pw.ts` | "Cards continuam com `--border` e `--shadow-card`" passa a "borda = `--card-border` resolvido e `--shadow-card`". |
| `web/e2e/entries.pw.ts` | Conferir a comparação de `innerText` da região com o título visível no mobile. A forma de localizar a região não muda. |
| `web/components/month-summary.spec.tsx` | Casos novos do §9.2. |
| `web/app/(app)/dashboard/_components/dashboard-blocks.spec.tsx` | Sem mudança esperada (região "Resumo de novembro de 2026"). |
| `docs/design/design-system.md` | Rev. 7 (T1 rascunho, T12 final): tokens de vidro, papéis, classificação, regra 3 ("transparência só em…") e "blur apenas em modais e headers fixos" revistas, fallbacks, razões no pior caso, novo resumo, achado do §3.1. |
| `docs/specs/fundo-gradiente-temas.md`, `docs/adr/0003-fundo-gradiente-temas.md` | Nota de revogação do B1 apontando para este ADR. |
| `CHANGELOG.md` | Entrada da feature. |

---

## 9. Plano de testes por camada

Ordem do fluxo: o tester escreve tudo abaixo **em vermelho** (T3-T6) depois do gate, sem afrouxar mínimos. Cobertura ≥ 80% em `lib/theme/glass.ts`.

### 9.1 Unitários (Vitest, node, sem I/O exceto leitura de CSS)

- **`lib/theme/tokens.spec.ts`** (CA06): rev. 7 em `EXPECTED_VALUES`; G1, G2, G3, G5 (estrutura de `--glass-blur`), G6, G10; `backgroundsOf` recursivo; `BAR_UNDER` local igual ao exportado; teste de extremos de luminância; todos os pares de vidro com o mínimo da categoria e os `expected` da rev. 7; pares opacos com as razões atuais (RNF02); allowlist de decorativos com `--glass-border` e `--chart-separator`.
- **`lib/theme/glass.spec.ts`**:
  - `classifyChain`: as cinco classes; a barra no meio da cadeia corta `depth` no índice dela; `image` vence `opaque`; alfa 0 vs alfa > 0.
  - `expandUnders`: opaco intacto; translúcido composto sobre cada amostra (cardinalidade = amostras); alfa 0 devolve as amostras; lista vazia lança erro.
  - `worstOverLayers`: com uma camada opaca, coincide com a razão simples; caso montado à mão em que compor só até a barra é **mais pessimista** que compor a cadeia inteira (prova de que o corte de `depth` é necessário).
  - `separationRatio`: vidro com alfa 0 → 1; alfa 1 → razão simples.
- **`lib/theme/glass-css.spec.ts`** (CA05, CA08-CA10, CA13 no nível estático; RNF06; RF10):
  - `glass.css`: o `:root` declara os 8 papéis, todos `var(--glass-*|--chart-separator)` ou `blur(var(--glass-blur))`/`none`. Existe `@supports not ((backdrop-filter: …) or (-webkit-backdrop-filter: …))`. Existe `@media` com `prefers-reduced-transparency: reduce`, `prefers-contrast: more` e `forced-colors: active`. O reset cobre `dialog`, `.drawer`, `.modal` e `[data-surface="opaque"]`. **Os três blocos opacos são idênticos** e cobrem todos os papéis (G9). Nenhum `var(--bg)`. Nenhum `transition`/`animation`. Nenhuma cor literal.
  - `globals.css`: toda regra de classe fora da allowlist do §5.7 está em `@layer components`. `.card`/`.glass` têm `border` **e** `box-shadow` (G10). `.drawer`, `.modal`, `.page-bg-window`, `.skeleton` e `.chip` sem `backdrop-filter`. `.field:disabled`/`[readonly]` com `--surface-2` e `backdrop-filter: none` (PA3). `.checkbox::before` com `--input-bg` (PA3). Nenhum `--color-header`.
  - Marcação (`app/`, `components/`): nenhum `bg-header`; nenhum `<bp>:card`/`<bp>:field`/`<bp>:btn`; `combobox.tsx` (lista), `month-picker.tsx` (grade), `toast.tsx`, `drawer.tsx`, `bottom-sheet.tsx` e a pílula do gráfico sem `glass`/`backdrop-glass` (opacos, RF05); `app-header.tsx` com `glass-bar`; nenhum `var(--surface)` em `stroke`/`fill` de `monthly-chart.tsx`/`category-donut.tsx`.
- **`test/no-literal-colors.spec.ts`:** verde, sem exceção nova (RF10).
- **`e2e/contrast.spec.ts`:** os testes de `worstOverRegion` continuam passando pela reexportação.

### 9.2 Componente (Vitest + Testing Library, jsdom)

- **`components/month-summary.spec.tsx`** (CA15-CA18, CA20 estrutural):
  - região com nome "Resumo de outubro de 2026" e `h2` **sem** `sr-only` (B5);
  - o `section` não tem as classes `card`, `bg-*`, `border*` nem `shadow*`;
  - 3 filhos `.card` do `dl`;
  - todo `dt`/`dd` tem como pai o `dl` ou um `div` filho direto do `dl` (fato 4);
  - 6 valores em pares `dt`/`dd`;
  - ordem dos rótulos no `textContent`;
  - aviso de mês vazio **depois** do `dl` e fora de qualquer `.card`;
  - os testes atuais continuam passando.
- **`MonthSummarySkeleton`:** `aria-busy`; 3 `.card` com 1, 3 e 2 linhas; marcador de título; usa as constantes compartilhadas (as mesmas classes de grade/card do componente real).
- **`dashboard-blocks.spec.tsx`:** sem mudança, deve continuar verde.

### 9.3 E2E (Playwright, Chromium, build de produção, stub)

- **`glass.pw.ts`:**
  - **CA01/CA03/CA04:** em `/entries`, `/cards` e `/dashboard` × 2 temas × 360/1280 px, para navbar, `.card`, `.glass`, `.field` dos filtros (≥ md):
    - alfa do `background-color` computado = alfa do token resolvido;
    - `backdrop-filter` contém `blur(`;
    - borda = `--card-border` resolvido;
    - `.glass-flat` com `backdrop-filter` = `--item-filter` resolvido (§5.5);
    - a lista aberta do `<select>` não é verificável pelo DOM: fica coberta pelo estático de `option { background: var(--surface) }`.
  - **CA05:** drawer aberto com lista do combobox aberta; menu do seletor de mês, toast e tooltip. Todos com alfa 1, `backdrop-filter: none` e os campos do drawer com `--input-bg`.
  - **CA08:** CSSOM da regra `@supports`, injeção do `cssText` dela (§5.6), verificação de opacidade, `audit` e `auditPageGradient`.
  - **CA09/CA10:** `emulateReducedTransparency`, `emulateMedia({ contrast: "more" })` e `emulateMedia({ forcedColors: "active" })`. Nenhum elemento com alfa entre 0 e 1 entre as superfícies, nenhum `backdrop-filter ≠ none`. Com `contrast: more`, `audit` + `auditPageGradient`.
  - **CA11:** clique no tema e amostragem por rAF: `--card-bg` da navbar, do card e do campo muda no mesmo quadro (padrão de `theme.pw.ts`). Recarregar mantém o tema.
  - **CA12:** seletor de mês aberto acima dos cards do resumo (`/entries` e `/dashboard`, 360 e 1280 px). `elementFromPoint` em 5 pontos da grade devolve descendente dela, e um clique num mês navega. Toast disparado continua por cima. `glassStackingProblems(page) === []` em todas as telas (G7, G8, tooltip contido no card).
  - **CA13:** `.page-bg-window` com `backdrop-filter: none` e alfa 1 (o teste do 0003 continua).
  - **CA02:** cenário `many`, 360 e 1280 px, lista rolada até haver itens e linhas sob a navbar e sob o `thead`. `auditPageGradient` verde (classe `bar`).
- **`month-summary.pw.ts`:**
  - **CA15/CA16/CA21:** em `/entries` e `/dashboard`, 360 e 1280 px, o `section` com fundo `rgba(0, 0, 0, 0)`, borda 0 e `box-shadow: none`; 3 cards com vidro; `scrollWidth ≤ clientWidth` em 360 px; título visível (`toBeVisible`).
  - **CA17:** cenário vazio, aviso abaixo do último card e fora de `.card`.
  - **CA20:** stub com `delayMs`, `PerformanceObserver("layout-shift")` somando os deslocamentos durante a troca skeleton → dados (≤ 0,01), em 360 e 1280 px.
  - **CA22:** troca de mês, aba e filtro com valores da API (o teste existente de `entries.pw.ts` continua); "atualizando" sem opacidade (`dark-theme.pw.ts`).
- **`a11y.pw.ts`:** telas e estados atuais × 2 temas com `audit` + `auditPageGradient` estendido, mais os estados novos (CA07, CA19). A allowlist reduzida vale aqui.
- **Ajustes:** `dark-theme.pw.ts`, `theme.pw.ts`, `theme-charts.pw.ts`, `page-background.pw.ts` e `entries.pw.ts`, conforme o §8.2.

### 9.4 Manual

- **CA14 / RNF05:** Lighthouse e trace (§5.5), registrados em `docs/runs/`.
- **R5 / RNF04:** o ui-designer confere visualmente a separação card/fundo nas regiões dos brilhos, nos dois temas, em tela de 8 bits.

---

## 10. Violações de SOLID e defeitos no código atual que afetam a feature

1. **OCP quebrado pela cascata (`globals.css`):** as classes de componente ficam fora de layer e por isso são **fechadas para extensão** pelos utilitários. Quem compõe `card md:bg-transparent`, `field pr-11` ou `checkbox -ml-3` recebe um comportamento diferente do declarado, sem erro. Causa confirmada do "card dentro de card" e de outros dois defeitos latentes (fato 3). Correção: `@layer components`/`@layer base` (§5.7) e o teste que trava.
2. **SRP em `MonthSummary`:** um markup tentava ser dois layouts (card compacto no mobile e 3 cards no desktop), anulando um com utilitários de breakpoint. Correção: um layout só, sem nada a anular (§5.7). O skeleton passa a compartilhar as constantes de layout (DRY).
3. **DIP/SRP no material das superfícies:** cerca de 12 componentes escolhem o material concreto (`bg-surface`, `bg-surface-2`, `border-border`, `shadow-card`) no JSX. `InlineAlert`/`EmptyState` não têm como ser vidro na página e opacos no drawer sem receber prop ou duplicar classes. Correção: componentes dependem de **papéis** (`--card-bg`, `.glass`), e o contexto (overlay, fallback) decide o valor concreto num ponto só (`glass.css`).
4. **Nome de token acoplado a componente:** `--header-bg` descreve a navbar, mas o papel ("vidro de barra") vale para quatro elementos. Correção: `--glass-bar-bg` (§5.1).
5. **Acoplamento de gráfico ao material do card:** `stroke="var(--surface)"` supõe card opaco. Correção: papel `--chart-sep` (§5.8).
6. **OCP em `pageGradientFailures`:** a política "só cadeia transparente" estava embutida no `evaluate`, sem teste unitário. Correção: `classifyChain` puro e testado, com o conjunto sob a barra injetado (§5.3).
7. **Allowlist larga demais (`e2e/support.ts`):** `/\bheader\b/` e `/^header\b/` isentam qualquer `<header>`, inclusive o que contém o resumo. É uma regressão silenciosa de cobertura. Correção: só `[data-navbar]` (§5.3).
8. **Marcação inválida do `<dl>`** (não é SOLID, mas afeta RF15): `div` aninhado e `p` dentro do grupo. Correção no novo markup e teste estrutural (§9.2).
9. **`.row-selected`/`.row-highlight` com `--surface-2` fixo:** ficariam como placas opacas sobre o contêiner de vidro. Correção: `--card-bg-2`.

---

## 11. Alternativas descartadas e trade-offs

| Alternativa | Motivo do descarte |
|---|---|
| `color-mix(in srgb, var(--surface) 70%, transparent)` com um `--glass-alpha` numérico | Elegante (uma tinta só), mas `light-dark()` não aceita número, então o alfa não pode variar por tema, e o §3.1 mostra que precisa variar. `tokens.spec.ts` também teria que avaliar `color-mix`. |
| Tokens opacos "equivalentes ao vidro" para o cálculo de contraste | Um valor único não representa o gradiente nem o conteúdo sob a barra e esconderia o pior caso (contraria RNF01). |
| Componentes usando `--glass-*` direto, com classe `.field-glass` opcional na página | Cada uso precisaria lembrar o contexto. O reset por contexto implementa a regra RF01 ("opaco dentro de overlays") num lugar só. |
| Manter `.card` sem layer e usar utilitários `!important` (`md:!bg-transparent`) | Trata o sintoma, espalha `!` e mantém o defeito em `.field` e `.checkbox`. |
| Mover só `.card` para `@layer` | Deixa `combobox.tsx` e `expenses-list.tsx` quebrados e a armadilha armada. |
| Vidro via `::before` como padrão (contra R3) | Depende de todos os ancestrais serem transparentes, complica as barras sticky e não há hoje popover dentro de vidro. Fica como padrão reservado (§5.4). |
| Desfoque em todos os itens de lista | Até ~50 camadas desfocadas re-renderizadas por quadro, sem ganho visual sobre um gradiente suave. Fica como opção de um ponto (`--item-filter`) para a T10. |
| Manter `--header-bg` com novo alfa | Nome de componente para um papel compartilhado. A troca custa só os testes, que mudam de qualquer jeito. |
| Separador translúcido ou `--surface` | Translúcido enfraquece a separação entre séries. `--surface` vira contorno de outra cor sobre o vidro (R6). |
| Fatorar o fallback com style queries (`@container style()`) | Suporte insuficiente. A repetição controlada por teste (G9) é mais segura. |
| `pageGradientFailures` lendo pixels (screenshot) para o conteúdo sob a barra | Frágil (antialiasing, desfoque, tempo de rolagem). O conjunto fechado `BAR_UNDER` é determinístico e mais pessimista. |

**Trade-offs aceitos:**
- Barra mais opaca que a estimativa da spec (≈ 0,91/0,89) até o usuário decidir entre (a) e (b) do §3.1.
- Itens de lista e tabela sem desfoque (vidro plano), uma interpretação de CA03 a confirmar no gate.
- Três blocos CSS idênticos (fallback e contexto), mantidos iguais por teste.
- Pequena mudança visual no combobox (`pr-11`) e no checkbox mobile (`-ml-3 -mt-2`) como efeito da correção de cascata.
- O axe continua sem ver gradiente e desfoque. O pior caso depende de `tokens.spec.ts` e de `auditPageGradient`, que é mais código de teste próprio, como no 0003.
- `prefers-reduced-transparency` sem suporte em parte dos navegadores (R9). O fallback por `@supports`/alto contraste continua valendo.

---

## 12. Riscos remanescentes

- **R1/B1:** se o usuário escolher a opção (b) do §3.1, mudam as cores de texto da navbar e do `thead` (novos pares e revisão visual). Se escolher (a), o efeito de vidro na navbar fica discreto.
- **R5/RNF04:** a borda clara pode sumir no tema claro. G10 e a sombra cobrem, mas o valor de `R_SEP` e de `--shadow-color` é do ui-designer.
- **Build:** se o Lightning CSS reescrever `@supports`/`@media` de forma inesperada, o e2e do CSSOM falha alto (§5.6) em vez de passar em silêncio.
- **Backdrop root futuro:** qualquer `opacity`, `filter` ou `transform` com `will-change` adicionado num ancestral de vidro (por exemplo uma animação de entrada) anula o desfoque. G7 no e2e pega isso.
- **Safari antigo (R10):** coberto pela condição com e sem prefixo e pelo `-webkit-backdrop-filter` explícito. Não há Safari no CI (só Chromium). Fica para verificação manual na T11.

---

## Adendo – implementação (2026-10-27)

Registro do que o código realmente faz e do que diverge do texto acima. Onde este adendo e as seções 1-12 discordam, vale o adendo.

**Status do ADR: Aceito.** O CA14 (desempenho, T10) continua **pendente de medição manual** (§5.5); não bloqueia o aceite, mas o registro em `docs/runs/` ainda não existe.

### A1. `--glass-shadow` e o papel `--card-shadow` (divergência do §5.1)

- O §5.1 mantinha `box-shadow: var(--shadow-card)` no vidro. O design (rev. 1, V5) pediu uma sombra própria do vidro, com camada difusa e highlight interno. Foi criado o token composto `--glass-shadow` em `tokens.css`, declarado fora de `light-dark()` como `--shadow-card`: `0 1px 2px var(--shadow-color), 0 8px 24px -12px var(--shadow-color), inset 0 1px 0 var(--glass-border)`.
- `glass.css` ganhou o **papel `--card-shadow`**, que passa de 8 para 9 papéis: vidro (`:root` padrão) = `var(--glass-shadow)`; opaco e fallback (os três blocos idênticos do G9) = `var(--shadow-card)`. Sem vidro não há highlight.
- Os valores finais dos tokens de vidro são os de `docs/design/superficies-vidro-fosco.md` §1: alfa 0,70 nos três de card, barra 0,91 (claro) e **0,90** (escuro, não 0,89: a `--border-strong` do `thead` fica em 2,98 a 0,89), `--glass-border` branco a 0,80 / 0,10, `--glass-blur: 12px`, `--chart-separator` `#F9FAFE` / `#1B222E`.

### A2. G10 verificado por tema (divergência do §4.1)

O G10 como escrito (`contrastRatio(composite(--glass-bg, s), s) ≥ R_SEP` para todo tema) é inatingível no escuro: o vidro composto e o gradiente se cruzam em luminância (nos brilhos o card fica mais escuro que o fundo, no centro mais claro). O mesmo vale para o `--surface` opaco da rev. 6. O critério implementado é por tema:

- **Claro:** separação por luminância, `contrastRatio(composite(--glass-bg, s), s) ≥ 1,08` para toda amostra `s` (valor medido ~1,10).
- **Escuro:** separação pela borda, `contrastRatio(composite(--glass-border, composite(--glass-bg, s)), composite(--glass-bg, s)) ≥ 1,25` para toda amostra (valor medido ~1,35).
- **Nos dois:** `.glass`/`.card` declaram borda **e** sombra (teste estático em `glass-css.spec.ts`).

### A3. `:focus-visible` em `@layer base` (divergência do §5.7)

- O §5.7 listava `:focus-visible` entre as regras que ficariam **fora de layer**. Na implementação ela foi para `@layer base`.
- **Motivo:** com a regra sem layer, ela vencia `.checkbox:focus-visible { outline: none }` (agora em `@layer components`) e o checkbox ficava com **anel duplo** (o `outline` global mais o anel desenhado pelo `::before`).
- **Efeito colateral intencional:** utilitários passam a sobrescrever o anel global. Em particular o `outline-none` do `<main tabIndex={-1}>` em `web/app/(app)/layout.tsx` (foco programático após navegação), que antes era anulado pela regra sem layer, **passou a valer**. O `main` deixa de mostrar anel ao receber foco por script; controles interativos continuam com o anel.
- `html`, `body`, `body::before`, `.page-bg-window`, `::selection`, `data-theme-switching` e o ícone sol/lua continuam fora de layer, como no §5.7.

### A4. `z-[35]` na grade do `MonthPicker` (defeito preexistente)

- A grade do seletor de mês passou de `z-30` para **`z-[35]`** (`web/components/month-picker.tsx`). O §5.4 afirmava que o `z-30` bastava, mas o CA12 (e2e com `elementFromPoint`) mostrou que a faixa de abas sticky (`entries-tabs-bar.tsx`, `z-30`) e a barra de lote (`z-30`) cobriam parte da grade, por virem depois no DOM. Era um defeito **anterior** à feature, exposto pelo teste.
- Escala resultante: `thead` sticky z-10, combobox z-20, abas sticky e barra de lote z-30, **grade do seletor z-[35]**, navbar z-40, toast z-50. O `MonthPicker` deixa de ser "sem mudança" (design §7.3).

### A5. Auditoria de pior caso unificada

- `pageGradientFailures` (`web/e2e/support.ts`) é o único ponto de auditoria de pior caso. Usa `classifyChain` (§4.4) para decidir, por texto, entre `transparent`, `glass`, `bar`, `opaque` e `image`, e `worstOverLayers` para o veredito. A política (`PAGE_BG_TOKENS`, `BAR_UNDER`) é injetada por `WorstCaseOptions`.
- A composição da cadeia de `background-color` sobre um fundo foi extraída para **`compositeChain`** (exportada de `web/lib/theme/glass.ts`), usada por `worstOverLayers`. Não há duas implementações de composição.
- Como previsto no §5.3, o `INCOMPLETE_ALLOWLIST` ficou restrito a `[data-navbar]`; as regexes que casavam qualquer `<header>` saíram.

### A6. Linhas do Saldo no mobile com `min-h-11` (CLS)

- No mobile, os `dd` de "Saldo realizado" e "Saldo previsto" têm `min-h-11` (44 px), no componente real **e** no skeleton (`SkeletonRow tall`). Motivo: em 360 px o indicador de sinal ("Positivo") desce para uma segunda linha com valores comuns; reservar 44 px por linha mantém o CLS da troca skeleton → dados em **≤ 0,01** com valor curto ou longo. Em `md+` o `min-h-0` volta ao comportamento do design.
- O card do Saldo no mobile passa de ~78 px para ~116 px (2 x 44 + 4 + 24 de padding). A região completa vai de 286 px para ~324 px. O design (§5.3, §5.4) foi atualizado.
- O stub da API (`web/e2e/stub-api/server.mjs`) ganhou o cenário **`short`** (valores curtos), e `month-summary.pw.ts` mede o CLS com `PerformanceObserver("layout-shift")` nos cenários `default` e `short`, em 360 e 1280 px.

### A7. Demais observações

- **Espaçamento do resumo:** o `section` usa `flex flex-col gap-2` (8 px título → cards). O aviso de mês vazio tem `mt-1` além do gap, o que dá 12 px acima dele. Bate com o design §5.3.
- **Papéis:** 9 em `glass.css` (os 8 do §5.1 mais `--card-shadow`).
- **Sem mudança** em `api/`, contratos HTTP, Prisma, schema ou migrations.
- **Pendente:** CA14 / RNF05 (Lighthouse e trace, T10) e a conferência visual da separação card/fundo em tela de 8 bits (§9.4) são manuais e ainda não foram feitas. Se a medição reprovar, o ajuste é o do §5.5 (`--item-filter` e depois `--glass-blur: 8px`).
