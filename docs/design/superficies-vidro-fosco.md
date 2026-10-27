# Design: Superfícies em vidro fosco e resumo do mês sem card externo

- **Spec:** `docs/specs/superficies-vidro-fosco.md` (RF01-RF19, RNF01-RNF10, CA01-CA22, B1-B5, PA1-PA10, R1-R11)
- **ADR:** `docs/adr/0004-superficies-vidro-fosco.md` (tokens e papéis §5.1, fallback §5.2, contraste §5.3, empilhamento §5.4, desfoque §5.5, resumo §5.7, separadores §5.8, invariantes G1-G10)
- **Base:** `docs/design/design-system.md` rev. 6 e `docs/design/fundo-gradiente-temas.md` (método de cálculo §2.1, amostras do gradiente)
- **Tokens atuais:** `web/app/styles/tokens.css` (rev. 6)
- **Autor:** ui-designer
- **Status:** **Aprovado** (2026-10-27). Usuário aprovou a feature no gate: B1 = opção (a) (vidro de barra com alfa 0,91 no claro e 0,90 no escuro, nenhuma cor de texto muda); B2-B5 aprovados com as respostas padrão (resumo em 3 cards empilhados no mobile, mesmo layout em /dashboard, itens de lista e tabela em vidro com `thead` sticky em vidro de barra, título "Resumo de <mês>" visível no mobile). A rev. 7 do `design-system.md` foi publicada na T12 a partir deste documento. Revisão 2 deste documento alinhada ao código implementado.

### Histórico

| Revisão | Mudança |
|---|---|
| 1 | Versão inicial: valores finais dos tokens de vidro, pior caso de contraste por superfície, bordas e sombras, classificação das superfícies com estados, novo layout do `MonthSummary` e fallbacks. |
| 2 (2026-10-27) | Alinhado ao código implementado: linhas do Saldo com 44px no mobile (card ~116px, região ~324px), `MonthPicker` com `z-[35]`, espaço título → cards de 8px confirmado. Papéis e rev. 7 do `design-system.md` publicados. |

Este documento define estrutura visual, hierarquia, componentes, estados e interação. Não contém código. Os nomes de classes e papéis seguem o ADR 0004 §5.1.

---

## 0. Decisões de design

| # | Decisão | Motivo |
|---|---|---|
| V1 | **Vidro de card a 0,70 nos dois temas**, para `--glass-bg`, `--glass-bg-2` e `--glass-input-bg`. | É a referência escolhida pelo usuário. Todos os pares passam a 0,70 no pior caso (§2), então não há motivo para subir o alfa. Também não há motivo para descer: abaixo de 0,70 o texto ainda passaria no claro, mas a separação por luminância cai e o card começa a "sumir" sobre a lavanda (R5). |
| V2 | **Vidro de barra: 0,91 no claro e 0,90 no escuro.** | Opção (a) do ADR §3.1: menor alfa que passa AA no pior caso. No claro, o par limitante é `--accent` sobre a barra composta sobre `--text` (0,90 dá 4,43; 0,91 dá 4,52). No escuro, o ADR estimou 0,89 olhando só para `--text-muted`, que de fato passa a 0,89 (4,52). Mas `--border-strong` (borda da linha do `thead` sticky e borda superior da barra de lote) fica em **2,98** a 0,89 e só passa a 0,90 (3,08). Por isso o escuro fecha em **0,90**, não em 0,89. Nenhuma cor de texto muda. |
| V3 | **Mesma tinta das superfícies opacas** (G1). Só o alfa muda. | O fallback opaco vira "o mesmo material sem transparência", e a troca de modo não muda o tom. |
| V4 | **Borda de vidro clara nos dois temas:** branco a 0,80 no claro e branco a 0,10 no escuro. | É a "borda clara de 1px" da referência. No escuro ela é o principal sinal de separação (1,35:1 contra o card). No claro ela funciona como fio de luz e quase não aparece sobre o card branco. A separação no claro vem da luminância (1,10:1) e da sombra (§3). |
| V5 | **Sombra própria do vidro com highlight interno no topo**: token composto `--glass-shadow`, sem cor nova. | O fio de 1px mais claro na borda superior dá a leitura de "luz vindo de cima", que combina com a direção futurista do design system, sem animação nem brilho extra (spec §6). A sombra de profundidade, um pouco maior que a `--shadow-card`, cumpre RNF04 no claro, onde a borda branca some. |
| V6 | **Desfoque de 12px.** | O efeito só aparece de verdade onde há conteúdo com detalhe por baixo (navbar, `thead` sticky, barra de lote). Sobre o gradiente suave, 8px e 12px dão o mesmo resultado. 12px esconde melhor o texto que passa sob a navbar. Se a T10 reprovar, baixar para 8px sem mudar mais nada (ADR §5.5). |
| V7 | **Separador de gráfico opaco** igual ao vidro composto sobre `--bg`. | É indistinguível do card em todo o gradiente (G6) e não deixa a cor da série vazar. |
| V8 | **Resumo com um único layout**: título visível, 3 cards soltos (empilhados no mobile, 3 colunas a partir de `md`) e aviso abaixo. | B2, B3 e B5. A hierarquia interna de cada card muda entre mobile e `md+` só por CSS (§5.3). |
| V9 | **Classificação do inventário confirmada** como no ADR §5.5, com as decisões dos itens (*) no §4. | RF01. |

---

## 1. Tokens de vidro (valores finais)

Todos em `web/app/styles/tokens.css`, uma declaração cada. Tokens de cor com `light-dark()`, comprimento e sombra fora dele. `--header-bg` sai (ADR §5.1).

| Token | Claro | Escuro | Tinta (G1) | Uso |
|---|---|---|---|---|
| `--glass-bg` | `rgb(255 255 255 / 0.70)` | `rgb(28 35 48 / 0.70)` | `--surface` | Cards, itens de lista, contêiner da tabela, bloco de fatura, alertas, toolbar de seleção |
| `--glass-bg-2` | `rgb(244 246 249 / 0.70)` | `rgb(37 45 60 / 0.70)` | `--surface-2` | Hover, linha e item selecionados, `.row-highlight`, subtotal da aba |
| `--glass-input-bg` | `rgb(255 255 255 / 0.70)` | `rgb(21 27 38 / 0.70)` | `--input-bg` | `.field` sobre a página (filtros) |
| `--glass-bar-bg` | `rgb(255 255 255 / 0.91)` | `rgb(28 35 48 / 0.90)` | `--surface` | Navbar, `thead` sticky, barra de lote mobile, coluna sticky da tabela do gráfico |
| `--glass-border` | `rgb(255 255 255 / 0.80)` | `rgb(255 255 255 / 0.10)` | branco | Borda de 1px de todo vidro e highlight do topo (decorativa, PA5/G4) |
| `--glass-blur` | `12px` | idem | - | Raio único do desfoque (G5) |
| `--chart-separator` | `#F9FAFE` | `#1B222E` | `--glass-bg` sobre `--bg` | Contorno entre barras, fatias e pontos dos gráficos (G6) |
| `--glass-shadow` | `0 1px 2px var(--shadow-color), 0 8px 24px -12px var(--shadow-color), inset 0 1px 0 var(--glass-border)` | idem | - | Sombra das superfícies de vidro (§3). Composto, fora de `light-dark()`, como `--shadow-card` |

Notas:
- `--chart-separator` foi calculado compondo o vidro sobre a cor base: claro `0,7 x 255 + 0,3 x (236, 238, 252)` = `(249,3; 249,9; 254,1)` = `#F9FAFE`. Escuro `0,7 x (28, 35, 48) + 0,3 x (24, 30, 42)` = `(26,8; 33,5; 46,2)` = `#1B222E`.
- `--shadow-color` **não muda** (`rgb(15 23 42 / 0.06)` / `rgb(0 0 0 / 0.3)`). Mudar esse token afetaria menus e popovers opacos, que devem ficar como estão (RNF02).
- `--glass-shadow` é um token **novo** em relação ao ADR §5.1. Ele pede um papel a mais em `glass.css`: `--card-shadow` (vidro: `var(--glass-shadow)`; opaco: `var(--shadow-card)`). Ver §3.3 e §9.
- Os alfas ficam com duas casas e não animam (G5, RNF06).

### 1.1 Invariantes com os valores fechados

| Invariante | Valor |
|---|---|
| G2: `0 < α(card) < 1` | 0,70 em todos |
| G2: `α(bar) ≥ máx(α card)` e `≤ 0,95` | 0,91 / 0,90 |
| G6: `ratio(--chart-separator, vidro composto) ≤ 1,10` | claro ≤ 1,01; escuro ≤ 1,05 |
| G10: separação card x fundo | claro: luminância ≥ **1,10** (R_SEP proposto: **1,08**). Escuro: ver §3.2 (a luminância não separa; o critério passa a ser a borda, ≥ **1,25**, valor atual 1,35) |

---

## 2. Contraste no pior caso

### 2.1 Método

- Mesmo método do `fundo-gradiente-temas.md` §2.1: luminância relativa WCAG 2.x e razões **arredondadas para baixo** na 2ª casa. Composição em sRGB, canal a canal: `c = α·vidro + (1 − α)·atrás`. O desfoque não entra na conta.
- **"Atrás" do vidro de card, de campo e da variante 2:** todas as amostras do gradiente (cor base, as 3 paradas, as interpolações entre paradas, cada brilho com alfa de 0 a 1 sobre cada ponto linear e os **dois brilhos juntos** em todas as combinações de alfa). Para `--glass-bg-2` e `--glass-input-bg`, também o `--glass-bg` já composto (hover sobre o contêiner de vidro, campo sobre card).
- **"Atrás" do vidro de barra:** `BAR_UNDER` (ADR §5.3): amostras do fundo, `--surface`, `--surface-2`, os três vidros compostos, `--text`, `--on-primary` e `--primary-strong`.
- **Onde fica o pior caso.**
  - Escuro (texto claro, pior = composição **mais clara**): a linearização é convexa, então a composição sobre qualquer mistura de cores declaradas tem luminância menor ou igual à composição sobre uma das cores declaradas. O máximo está sempre num vértice: **brilho 1** (`#0C3044`) para os vidros de card e campo, e **`--on-primary`** (branco) para a barra.
  - Claro (texto escuro, pior = composição **mais escura**): o mínimo está na **parada 3** (`#F0ECFC`, L 0,8554). Conferi a interpolação parada 2 → parada 3, os dois brilhos sobre a parada 3 com alfas parciais e os dois brilhos juntos. Em todos, o ganho no canal G compensa a queda em R, e a luminância fica acima da parada 3. Na barra, o pior é a composição sobre `--text`.
- Os números são cálculo de design. A fonte de verdade é o `tokens.spec.ts` (T3), que varre todas as amostras. Diferença esperada ≤ 0,01.

### 2.2 Fundo efetivo no pior caso

| Superfície | Tema | Pior "atrás" | Composição (sRGB) | L |
|---|---|---|---|---|
| `--glass-bg` 0,70 | claro | parada 3 `#F0ECFC` | (250,5; 249,3; 254,1) | 0,9551 |
| `--glass-bg` 0,70 | escuro | brilho 1 `#0C3044` | (23,2; 38,9; 54,0) | 0,0190 |
| `--glass-bg-2` 0,70 | claro | parada 3 | (242,8; 243,0; 249,9) | 0,9001 |
| `--glass-bg-2` 0,70 | escuro | brilho 1 | (29,5; 45,9; 62,4) | 0,0257 |
| `--glass-input-bg` 0,70 | claro | parada 3 (igual a `--glass-bg`) | (250,5; 249,3; 254,1) | 0,9551 |
| `--glass-input-bg` 0,70 | escuro | brilho 1 | (18,3; 33,3; 47,0) | 0,0145 |
| `--glass-bar-bg` 0,91 | claro | `--text` `#1E293B` | (234,8; 235,7; 237,4) | 0,8360 |
| `--glass-bar-bg` 0,90 | escuro | `--on-primary` `#FFFFFF` | (50,7; 57,0; 68,7) | 0,0405 |

Referência: pior caso do fundo sem vidro (rev. 6): claro 0,8554; escuro 0,0261. Com vidro, o fundo efetivo fica **mais claro no claro e mais escuro no escuro** que o próprio gradiente. Por isso todo par que passava sobre `--bg` também passa sobre o vidro de card.

### 2.3 Vidro de card (`--glass-bg`, 0,70)

Mínimos: **T** 4,5 (texto), **C** 3 (não textual), **D** 3 (desabilitado, regra do projeto).

| Frente | Mín. | Claro | Escuro |
|---|---|---|---|
| `--text` | T | 14,00 | 12,27 |
| `--text-muted`, `--chart-axis` | T | 7,19 | 6,13 |
| `--accent` (texto e indicador), `--focus-color`, `--chart-1` | T / C | 5,12 | 7,78 |
| `--danger-text` | T | 6,19 | 5,50 |
| `--success-text` | T | 5,24 | 7,92 |
| `--warning-text` | T | 6,78 | 9,12 |
| `--income`, `--chart-income` | T / C | 6,41 | 5,98 |
| `--expense` | T | 6,01 | 5,65 |
| `--text-disabled` | D | 4,19 | 4,04 |
| `--border-strong`, `--tooltip-border` | C | 4,19 | 4,04 |
| `--primary-border`, `--chart-2` | C | 6,01 | 5,10 |
| `--danger` | C | 4,62 | 5,50 |
| `--success`, `--chart-paid` | C | **3,60** | 7,92 |
| `--warning`, `--chart-pending` | C | 4,80 | 9,12 |
| `--chart-balance-realized` | C | 6,80 | 5,59 |
| `--chart-balance-projected`, `--chart-3` | C | 5,78 | 5,74 |
| `--chart-zero-line` | C | 7,19 | 6,13 |
| `--chart-4` | C | 4,77 | 10,09 |
| `--chart-5` | C | 4,95 | 6,72 |
| `--chart-6` | C | 4,55 | 6,13 |

**Resultado: 0,70 passa em todos os pares.** Margens mais justas: claro `--success`/`--chart-paid` 3,60 (C) e escuro `--text-disabled`/`--border-strong` 4,04 (D/C).

### 2.4 Variante 2 (`--glass-bg-2`, 0,70): hover, seleção, subtotal

| Frente | Mín. | Claro | Escuro |
|---|---|---|---|
| `--text` | T | 13,23 | 11,18 |
| `--text-muted` | T | 6,79 | 5,58 |
| `--accent` (texto e barra da linha selecionada), `--focus-color` | T / C | 4,84 | 7,09 |
| `--success-text` | T | 4,96 | 7,21 |
| `--warning-text` | T | 6,41 | 8,30 |
| `--danger-text` | T | 5,85 | 5,01 |
| `--income` | T | 6,06 | 5,45 |
| `--expense` | T | 5,68 | 5,15 |
| `--text-disabled` | D | 3,96 | 3,68 |
| `--border-strong` | C | 3,96 | 3,68 |
| `--primary-border` | C | 5,68 | 4,65 |
| `--danger` | C | 4,36 | 5,01 |
| `--success` | C | **3,40** | 7,21 |
| `--warning` | C | 4,54 | 8,30 |

**Resultado: 0,70 passa em todos.** Composta sobre o `--glass-bg` já composto, a variante 2 fica mais clara no claro e mais escura no escuro do que composta direto sobre o gradiente. A tabela acima já é o pior caso. Margem mais justa: claro `--success` 3,40 (C) e escuro `--text-disabled`/`--border-strong` 3,68.

### 2.5 Campo (`--glass-input-bg`, 0,70)

| Frente | Mín. | Claro | Escuro |
|---|---|---|---|
| `--text` (valor digitado/selecionado) | T | 14,00 | 13,12 |
| `--text-muted` (placeholder) | T | 7,19 | 6,55 |
| `--border-strong` (borda do controle) | C | 4,19 | 4,32 |
| `--focus-color` (anel) | C | 5,12 | 8,32 |
| `--danger` (borda com erro) | C | 4,62 | 5,88 |
| `--danger-text` (mensagem) | T | 6,19 | 5,88 |

**Resultado: 0,70 passa em todos** (CA04).

### 2.6 Vidro de barra (`--glass-bar-bg`)

| Frente | Mín. | Claro 0,91 | Escuro 0,90 |
|---|---|---|---|
| `--text` (marca, valores na barra de lote, `th`) | T | 12,34 | 9,35 |
| `--text-muted` (itens inativos, `th` do `thead`) | T | 6,34 | **4,67** |
| `--accent` (item ativo) | T | **4,52** | 5,93 |
| `--focus-color` | C | 4,52 | 5,93 |
| `--border-strong` (linha do `thead`, borda da barra de lote, `.btn`) | C | 3,69 | **3,08** |
| `--primary-border` (botão primário na barra de lote) | C | 5,30 | 3,89 |

Por que esses alfas e não menos (os pares que limitam):

| Tema | α | Par limitante | Razão | Passa? |
|---|---|---|---|---|
| Claro | 0,90 | `--accent` sobre a barra composta sobre `--text` | 4,43 | não |
| Claro | **0,91** | idem | 4,52 | sim |
| Escuro | 0,88 | `--text-muted` sobre a barra composta sobre `--on-primary` | 4,37 | não |
| Escuro | 0,89 | `--text-muted` / `--border-strong` | 4,52 / **2,98** | não (borda) |
| Escuro | **0,90** | `--text-muted` / `--border-strong` | 4,67 / 3,08 | sim |

Com isso, o gradiente aparece atrás da navbar em 9% (claro) e 10% (escuro), mais o desfoque do conteúdo que passa por baixo. CA01 continua atendido (α < 1 e `blur`).

### 2.7 Texto simples sobre o gradiente (sem mudança)

O título e o aviso do resumo ficam direto sobre o fundo (CA19): `--text-muted` 6,48 (claro) / 5,55 (escuro), pior caso da rev. 6.

### 2.8 Superfícies opacas e fallback

Valores e razões da rev. 6 sem mudança (RNF02, RNF03). A navbar no fallback fica com `--surface` opaco (α 1). Os pares de `--surface` são os atuais e passam com folga maior que a dos 0,95 de hoje.

---

## 3. Bordas, sombras e separação

### 3.1 Anatomia do vidro (card)

```
 ┌───────────────────────────────┐  ← borda 1px --glass-border (branco 0,80 / 0,10), raio 12px
 │▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔│  ← highlight: inset 0 1px 0 --glass-border (topo fica com 2px de luz)
 │  fundo --glass-bg (0,70)       │
 │  + backdrop-filter blur(12px)  │
 └───────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ← 0 1px 2px + 0 8px 24px -12px, ambos --shadow-color
```

- **Borda:** 1px sólida, `--glass-border`, em todo o contorno. O fundo do card passa por baixo da borda (`background-clip` padrão), então a borda é composta sobre o próprio vidro e sempre fica **mais clara** que ele: fio de luz no escuro, fio quase branco no claro.
- **Highlight do topo:** sombra interna de 1px na mesma cor da borda. Somado à borda superior, o topo fica com 2px de luz e o resto com 1px. É sutil de propósito. Não há gradiente, brilho nem animação (spec §6). Só existe com o vidro ligado: no fallback, a sombra volta à `--shadow-card`, sem highlight.
- **Sombra de profundidade:** a mesma `0 1px 2px` de hoje mais uma camada difusa `0 8px 24px -12px`, ambas com `--shadow-color`. O espalhamento negativo mantém a sombra embaixo do card, sem halo nas laterais. No claro ela é o que separa o card branco translúcido da lavanda. No escuro ela escurece levemente a base do card.
- **Variações:**
  - Bloco de fatura: borda `--border-strong` (bloco de ação, como hoje) no lugar de `--glass-border`. Highlight e sombra iguais.
  - `InlineAlert`: borda colorida (`--danger` etc.) no lugar de `--glass-border`. Highlight e sombra iguais.
  - Item selecionado no mobile: borda `--accent` e fundo `--glass-bg-2`.
  - `.glass-flat` (itens de lista, contêiner da tabela): mesma borda, highlight e sombra do card, sem desfoque.

### 3.2 Separação card x fundo (RNF04, R5)

| Sinal | Claro | Escuro |
|---|---|---|
| Luminância do vidro x fundo (pior região) | **1,10:1**, card mais claro em todo o gradiente | ~1,00:1 em algum ponto. Nos brilhos o card fica mais escuro que o fundo, no centro fica mais claro, e na transição os dois se igualam. Isso já acontece hoje com o `--surface` opaco (rev. 6, §2.4) |
| Borda de vidro x vidro | 1,03:1 (fio de luz quase invisível) | **1,35:1** (fio claro bem visível, como a `--border` da rev. 6, que dá 1,31:1) |
| Sombra | difusa, visível na base | escurece a base |
| Sinais efetivos | luminância + sombra (+ highlight) | borda + sombra (+ highlight) |

Os dois temas têm sempre pelo menos dois sinais independentes, como pede a RNF04.

**Consequência para o G10 (pedido ao architect/tester):** o G10 como está no ADR (`contrastRatio(composite(--glass-bg, s), s) ≥ R_SEP` para toda amostra e **todo tema**) não pode ser cumprido no escuro com nenhum alfa < 1, nem mesmo com o opaco atual. Proposta:
- **Claro:** separação por luminância ≥ **1,08** (valor atual 1,10).
- **Escuro:** `contrastRatio(composite(--glass-border, composite(--glass-bg, s)), composite(--glass-bg, s)) ≥ 1,25` para toda amostra `s` (valor atual 1,35).
- Nos dois temas: o teste estático de borda **e** sombra continua valendo.

### 3.3 Barras

| Barra | Borda | Sombra | Highlight |
|---|---|---|---|
| Navbar | inferior 1px, papel `--card-border` (vidro: `--glass-border`; fallback: `--border`, como hoje) | nenhuma | não (encostada no topo da viewport) |
| `thead` sticky | linha inferior `--border-strong` (inalterada, não textual 3:1) | nenhuma | não |
| Barra de lote mobile | superior `--border-strong` (inalterada) | nenhuma | não |
| Coluna sticky do gráfico | nenhuma (fica dentro do card) | nenhuma | não |

A borda inferior da navbar em vidro, no claro, é um fio branco sobre a barra branca. O que separa a navbar do conteúdo é o próprio alfa (0,91) contra o conteúdo desfocado. No escuro o fio aparece. A 2ª linha da navbar no mobile continua sem fundo, com a borda `--border` atual (RF11).

---

## 4. Tabela de superfícies

### 4.1 Materiais

| Material | Classe / papel | Fundo | Borda | Sombra | Desfoque | Contexto opaco e fallback |
|---|---|---|---|---|---|---|
| **Vidro** | `.glass`, `.card`, `.field` | `--card-bg` (`--glass-bg`) · campos: `--field-bg` (`--glass-input-bg`) | `--card-border` 1px (campos: `--border-strong`) | `--card-shadow` (`--glass-shadow`) · campos: nenhuma | `blur(12px)` | `--surface` / `--input-bg`, `--border`, `--shadow-card`, sem desfoque |
| **Vidro plano** | `.glass-flat` | `--card-bg` | `--card-border` 1px | `--card-shadow` | nenhum (`--item-filter: none`) | igual ao vidro |
| **Vidro de barra** | `.glass-bar`, `bg-bar` | `--bar-bg` (`--glass-bar-bg`) | §3.3 | nenhuma | `blur(12px)` (a coluna do gráfico, sem) | `--surface` (α 1), sem desfoque |
| **Opaca** | classes atuais | `--surface`, `--surface-2`, `--input-bg`, `--tooltip-bg` | atuais | atuais | nenhum | não muda |

### 4.2 Classificação final

Itens com (*) na spec, aqui decididos.

| Superfície | Material | Observação |
|---|---|---|
| Navbar (linha 1) | Vidro de barra | 0,91 / 0,90 |
| 2ª linha da navbar (mobile) | Sem fundo | inalterada (RF11) |
| `.card` (3 cards do resumo, gráficos, `/cards`, `EmptyState`, `error.tsx`, `BlockErrorBoundary`, alerta de `expenses-panel`) | Vidro | |
| Skeletons do dashboard (dentro de `.card`) | Vidro (card) + blocos `--skeleton` opacos | |
| `EntryItem` mobile (despesas e receitas) | Vidro plano | selecionado: `--glass-bg-2` + borda `--accent` |
| Contêiner da tabela desktop | Vidro plano | raio 12, `overflow: clip`, borda e sombra do vidro (a borda e a sombra saem da `<table>`) |
| Linhas da tabela | Sem fundo | hover e seleção na §4.3 |
| (*) `thead` sticky | **Vidro de barra** | confirma o ADR. O `th` usa `--text-muted` (4,67 / 6,34) |
| (*) Barra de lote mobile | **Vidro de barra** | sai `--surface-2` e entra a tinta `--surface` da barra. Os botões dentro dela continuam `.btn` / `.btn-primary` opacos |
| Bloco de fatura | Vidro | borda `--border-strong` |
| (*) Totais do bloco de fatura (mobile, `dl`) | **Sem fundo** | separados por `border-t` `--border` (sem vidro sobre vidro) |
| (*) Subtotal da aba | **Vidro, variante 2** (`--glass-bg-2`) | raio 8, com desfoque |
| `InlineAlert` | Vidro na página, opaco em overlay | borda colorida |
| Toolbar de seleção desktop | Vidro | raio 8 |
| `.field` sobre a página (filtros ≥ md) | Vidro (campo) | lista nativa do `<select>` opaca |
| `.field` em drawer, folha ou modal (inclui filtros mobile na `BottomSheet`) | Opaca | contexto opaco (PA2) |
| `.field:disabled`, `[readonly]` | Opaca (`--surface-2`) | PA3 |
| `.checkbox` | Opaca (`--input-bg`) | PA3 |
| Drawer, folha, modal, scrim | Opaca | inalterados |
| Lista do combobox, popover do seletor de mês, toast, tooltip | Opaca | inalterados |
| Pílula "Sem lançamentos de…" no gráfico | Opaca (`--surface`) | |
| (*) Coluna sticky da tabela do gráfico | **Cor de barra, sem desfoque** (`bg-bar`) | confirma o ADR. Passa sobre `BAR_UNDER`. No claro fica um pouco mais branca que o card, o que marca a coluna fixa |
| Link "Pular para o conteúdo" | Opaca | |
| Faixa de abas `/entries` | `.page-bg-window` opaca | inalterada (RF11, CA13) |
| `.segmented`, `.tablist` | Transparentes | inalterados |
| (*) `.btn` hover/active/disabled | **Opacos** (`--surface-2`, `--surface-active`) | PA7 confirmada. Sobre o vidro, o hover opaco fica um pouco mais sólido que o card, o que ajuda a ler o estado. Não há incoerência visual |
| Separadores dos gráficos | `--chart-separator` (papel `--chart-sep`) | §1 |
| `--chart-cursor` | Opaco (inalterado) | Sobre o vidro aparece como faixa levemente mais escura (claro) ou mais clara (escuro). Esse é o papel dele, então fica como está |

### 4.3 Estados sobre o vidro

| Elemento | Repouso | Hover | Selecionado / ativo | Pressionado | Foco (teclado) | Desabilitado |
|---|---|---|---|---|---|---|
| Linha da tabela (desktop) | sem fundo (mostra o vidro plano do contêiner) | `--glass-bg-2` | `.row-selected`: `--glass-bg-2` + barra `--accent` 3px à esquerda (como hoje) | - | anel `--focus-ring` no controle focado (checkbox, ações). A linha não ganha anel próprio | linha sem checkbox habilitado: inalterada |
| `.row-highlight` (linha recém-criada/editada) | `--glass-bg-2` | `--glass-bg-2` | - | - | - | - |
| `EntryItem` (mobile) | vidro plano, borda `--glass-border` | sem hover (toque) | `--glass-bg-2` + borda `--accent` 1px | - | anel no controle focado | - |
| Card clicável (`/cards`, se houver link) | vidro | sem mudança de fundo. O link interno ganha sublinhado (regra atual) | - | - | anel 2px `--focus-color`, offset 2px | - |
| `.field` (página) | `--glass-input-bg`, borda `--border-strong` | borda inalterada | - | - | anel `--focus-ring`, offset 2px (5,12 / 8,32 sobre o campo; 4,62 / 7,05 sobre o gradiente no offset) | opaco `--surface-2`, sem desfoque |
| `.field` com erro | idem | idem | - | - | idem | - |
| Navbar: item | texto `--text-muted` | `--text` | ativo: `--accent` + indicador | - | anel `--focus-ring` (4,52 / 5,93) | - |
| `.btn` sobre vidro | transparente, borda `--border-strong` | `--surface-2` opaco | - | `--surface-active` opaco | anel | `--surface-2` + `--text-disabled` |
| Subtotal | `--glass-bg-2` | - | - | - | - | - |

Regras:
- Nenhuma transição de fundo, alfa ou desfoque (RNF06). Hover e seleção trocam de valor na hora.
- O anel de foco nunca depende do vidro: o offset de 2px mostra o que está atrás (vidro ou gradiente), e os dois passam 3:1.
- Seleção nunca é só cor: a linha selecionada mantém a barra `--accent` e o checkbox marcado, e o item mobile mantém a borda `--accent` e o checkbox.

---

## 5. Resumo do mês (`MonthSummary`)

### 5.1 Hierarquia de informação

1. **Título** "Resumo de <mês por extenso>": diz de qual mês são os números. É o nome da região.
2. **Receitas**: um valor.
3. **Despesas**: total (destaque), depois Pago e Pendente.
4. **Saldo**: realizado (destaque) e previsto, cada um com o indicador de sinal ("Positivo" / "Negativo" / "Zerado").
5. **Aviso de mês vazio**, só quando todos os totais são zero.

A ordem visual é igual à ordem de leitura (RF15) em todos os breakpoints.

### 5.2 Estrutura

```
section[aria-labelledby=<headingId>]            sem fundo, borda ou sombra
  h2#<headingId>  "Resumo de novembro de 2026"  texto simples
  dl  (grade)
    div.card  Receitas                          dt + dd
    div.card  Despesas                          dt/dd total · dt/dd Pago · dt/dd Pendente
    div.card  Saldo                             dt/dd realizado · dt/dd previsto
  p  "Sem lançamentos neste mês"                só se vazio; fora de qualquer card
```

Um único nível de `div` entre `dl` e `dt`/`dd` (ADR §5.7). As dicas "receitas − despesas pagas" / "receitas − todas as despesas" ficam **dentro** do `dd` correspondente. O `title` continua no `dd`.

### 5.3 Layout por breakpoint

**Medidas comuns**

| Item | Valor |
|---|---|
| Título | Inter 14px / altura de linha 20px, peso 500, `--text-muted`. Visível sempre (B5) |
| Espaço título → cards | 8px (`gap-2` da `section`, implementado) |
| Espaço cards → aviso | 12px (os mesmos 8px do `gap-2` mais `mt-1` no aviso) |
| Aviso | Inter 14px / 20px, peso 400, `--text-muted` |
| Card | vidro (§3.1), raio 12px |
| Espaço acima e abaixo da região | o mesmo de hoje (definido por `EntriesHeader` / `DashboardHeader`, sem mudança) |

**Mobile (< 768px): 3 cards empilhados**

```
Resumo de novembro de 2026                                   14/20 muted
                                                             8px
┌──────────────────────────────────────────────┐
│ ↙ Receitas                       R$ 8.500,00 │  linha 24px
└──────────────────────────────────────────────┘  card: 12px vertical / 16px horizontal
                                                             12px
┌──────────────────────────────────────────────┐
│ ↗ Despesas                       R$ 6.230,40 │  24px
│ ● Pago                           R$ 4.100,00 │  24px (4px entre linhas)
│ ● Pendente                       R$ 2.130,40 │  24px
└──────────────────────────────────────────────┘
                                                             12px
┌──────────────────────────────────────────────┐
│ Saldo realizado      R$ 4.400,00  ↑ Positivo │  44px (min-h-11)
│ Saldo previsto       R$ 2.269,60  ↑ Positivo │  44px (min-h-11)
└──────────────────────────────────────────────┘
                                                             12px
Sem lançamentos neste mês                                    (só se vazio)
```

- Grade de 1 coluna, 12px entre os cards. Largura total do container (padding da página 16px), sem rolagem horizontal em 360px (RNF08, CA16).
- Dentro do card: grade de 2 colunas (rótulo à esquerda, `minmax(0, 1fr)`; valor à direita, `auto`), 12px entre colunas, 4px entre linhas, alinhamento pela linha de base. É a "compactação interna atual" do B2.
- Rótulos: `dt` 14px peso 500 (Receitas em `--income` com ícone; Despesas em `--expense` com ícone; Pago e Pendente com `StatusDot`; Saldo em `--text-muted`). Valores: `display-num` 16px peso 600 `--text`, tabulares.
- Pago e Pendente passam a ter **uma linha cada**. Antes dividiam uma linha com quebra, e agora alinham pela mesma coluna de valor.
- Dicas de fórmula ocultas (o `title` continua).
- Alturas (implementadas): Receitas 50px, Despesas 106px, **Saldo ~116px**. Região com dados: 20 + 8 + 50 + 12 + 106 + 12 + 116 = **~324px**, contra ~200px do card compacto anterior (R11, +~124px). Aceito pelo B2. As abas continuam logo abaixo. (A versão inicial deste design previa Saldo 78px e região de 286px; ver a linha seguinte.)
- **Linhas do Saldo reservam 44px no mobile** (`min-h-11` nos dois `dd`, no real e no skeleton). Em 360px o indicador de sinal ("Positivo") desce para uma segunda linha, alinhado à direita, com valores comuns; reservar 44px por linha evita o salto de layout na troca skeleton → dados (CLS ≤ 0,01), tenha o valor uma ou duas linhas. Cálculo do card: 2 x 44 + 4 (gap) + 24 (padding vertical 12/12) = 116px. Receitas e Despesas continuam com linhas de 24px. Em `md+` o `min-h` é removido.

**`md` (768-1023px) e `lg+` (≥ 1024px): 3 cards lado a lado**

```
Resumo de novembro de 2026                                                    14/20 muted
                                                                              8px
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ ↙ Receitas            │ │ ↗ Despesas            │ │ Saldo realizado       │  dt 14/20
│ R$ 8.500,00           │ │ R$ 6.230,40           │ │ R$ 4.400,00 ↑ Positivo│  24/32 (lg: 28/36)
│                       │ │                       │ │ receitas − desp. pagas│  12/16 muted
│                       │ │ ● Pago     R$ 4.100,00│ │                       │  12px
│                       │ │ ● Pendente R$ 2.130,40│ │ Saldo previsto        │  18/28
│                       │ │                       │ │   R$ 2.269,60 ↑ Posit.│
│                       │ │                       │ │ receitas − todas desp.│
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
       16px entre cards (gap)          os 3 cards com a mesma altura (a do mais alto)
```

- Grade de 3 colunas iguais, 16px entre elas. Os cards esticam até a altura do mais alto, e o conteúdo fica alinhado ao topo.
- Padding do card: 16px.
- **Par principal** de cada card (Receitas, Despesas total, Saldo realizado): empilhado, com o `dt` em cima e o `dd` embaixo (4px entre eles). Valor em `display-num` 24px/32px (`lg`: 28px/36px), peso 600. O indicador de sinal fica na mesma linha do valor e quebra para baixo se faltar espaço.
- **Pares secundários** (Pago, Pendente, Saldo previsto): linha com rótulo à esquerda e valor à direita (grade de 2 colunas), valor 18px/28px peso 600, 4px entre linhas, 12px entre o par principal e o primeiro secundário.
- Dicas de fórmula visíveis (12px/16px, `--text-muted`) dentro do `dd`, logo abaixo do valor. No Saldo previsto, alinhadas à direita com o valor.
- Alturas aproximadas (`lg`): Receitas 16 + 20 + 4 + 36 + 16 = 92px de conteúdo; Despesas 16 + 20 + 4 + 36 + 12 + 28 + 4 + 28 + 16 = 164px; Saldo ~184px. Linha da grade: ~184px.
- Em `md` (≈ 214px por card), o valor principal de 24px cabe até "R$ 999.999,99". Valores maiores quebram no `dd` sem rolagem.

**`/dashboard`:** exatamente o mesmo componente e o mesmo layout (B3, CA21).

### 5.4 Skeleton (`MonthSummarySkeleton`)

Mesma estrutura, as mesmas constantes de layout (grade, card, título) e as mesmas alturas de linha. O resultado é CLS ≈ 0 na troca (CA20).

| Elemento | Mobile | `md+` |
|---|---|---|
| Container | `aria-busy`, texto oculto "Carregando resumo do mês" | idem |
| Título | bloco `--skeleton` 192 x 14px, centralizado numa linha de **20px** | idem |
| Espaço título → cards | 8px | 8px |
| Grade e cards | 1 coluna, 12px entre os cards, card de vidro com padding 12/16 | 3 colunas, 16px entre os cards, padding 16 |
| Card 1 (1 linha) | linha de 24px: rótulo 80 x 14 à esquerda, valor 112 x 16 à direita | rótulo 96 x 14 (linha de 20) + 4 + valor 160 x 24 (linha de 32; `lg` 36) |
| Card 2 (3 linhas) | 3 linhas de 24px, 4px entre elas | principal como no card 1 + 12 + 2 linhas de 28px (rótulo 72 x 14, valor 104 x 18), 4px entre elas |
| Card 3 (2 linhas) | 2 linhas de **44px** (reserva do `min-h-11` do Saldo real; card ~116px em vez de ~78px) | principal + linha de 16px da dica + 12 + linha secundária de 28px + linha de 16px da dica |
| Aviso de mês vazio | não reservado | não reservado |

- Os blocos usam `--skeleton` opaco dentro do card de vidro (inalterado). Sem animação nova.
- O aviso de mês vazio não é reservado, porque não se sabe de antemão se o mês está vazio. No mês vazio, o conteúdo abaixo do resumo desce 32px (12 + 20) quando os dados chegam. CA20 mede o cenário com dados. O caso vazio fica registrado como deslocamento conhecido e pequeno (§10, risco D2).

### 5.5 Estados do resumo

| Estado | O que aparece |
|---|---|
| Carregando | Skeleton (§5.4), nas duas telas (`loading.tsx` e `Suspense`) |
| Com dados | §5.3 |
| Mês vazio | Os 3 cards com R$ 0,00 e "Zerado" no saldo, mais o aviso "Sem lançamentos neste mês" **abaixo** dos cards, em texto simples (CA17) |
| Atualizando (troca de mês, aba ou filtro em `/entries`) | O conteúdo antigo continua visível, **sem opacidade reduzida** (`UpdatingRegion`, CA22). Nenhum véu sobre o vidro. O `aria-busy` fica na região que atualiza (comportamento atual) |
| Erro (`/dashboard`) | `BlockErrorBoundary compact`: um card de vidro com a mensagem e "Tentar novamente", no lugar dos 3 cards. O título do resumo não aparece no erro (comportamento atual do boundary) |
| Erro (`/entries`) | `error.tsx` da rota (card de vidro), sem mudança de conteúdo |
| Valores negativos | Saldo com "Negativo" em `--danger-text` (5,50 / 6,19 sobre o vidro) |

### 5.6 Acessibilidade do resumo

- Região `section` com `aria-labelledby` apontando para o `h2` visível. O nome acessível continua "Resumo de <mês por extenso>" e os testes continuam achando a região pelo papel e pelo nome (CA18).
- Um `dl` com 3 grupos `div`. Os 6 valores ficam em pares `dt`/`dd`, e a marcação passa a ser válida (corrige o fato 4 do ADR).
- O aviso de mês vazio fica **dentro** da `section`, depois do `dl`. Não é `aria-live`: aparece junto com os dados.
- Os ícones de Receitas e Despesas continuam `aria-hidden`. O texto do rótulo carrega a informação.
- Zoom de 200%: em `md+` os cards crescem em altura. Abaixo de 768 CSS px vale o layout mobile.
- Contraste: título e aviso 6,48 / 5,55 (gradiente). Conteúdo dos cards conforme o §2.3.

### 5.7 Fluxo de interação

O resumo é só leitura e não tem controle próprio.
1. A tela abre com o skeleton. Os dados entram no mesmo arranjo, sem salto.
2. Em `/entries`, a troca de mês (seletor ou setas) mantém o resumo antigo visível até os novos valores chegarem (estado "atualizando") e depois troca os números. O popover do seletor de mês abre **por cima** dos cards de vidro (CA12).
3. Troca de aba ou filtro não muda os valores (CA22). O resumo é sempre do mês inteiro.
4. Passar o mouse sobre o saldo mostra a fórmula pelo `title`. Em `md+` a fórmula também aparece em texto.

---

## 6. Fallbacks

Um único conjunto de valores opacos, aplicado em três situações (ADR §5.2, G9). Nada é animado na troca.

| Gatilho | Efeito | Observação visual |
|---|---|---|
| Sem `backdrop-filter` (com e sem `-webkit-`) | Todos os papéis voltam ao opaco da rev. 6: `--card-bg` → `--surface`, `--card-bg-2` → `--surface-2`, `--field-bg` → `--input-bg`, `--bar-bg` → `--surface` (α 1), `--card-border` → `--border`, `--card-shadow` → `--shadow-card`, `--glass-filter` e `--item-filter` → `none`, `--chart-sep` → `--surface` | Aparência da rev. 6, com uma diferença: a navbar passa de 0,95 para **opaca**. Não existe translucidez sem desfoque |
| `prefers-reduced-transparency: reduce` | idem | Sem translucidez nem desfoque. Borda e sombra da rev. 6, sem highlight (RF07). Onde o navegador não suporta a query, ela é ignorada (R9) |
| `prefers-contrast: more` | idem | Mesmo fallback (PA4). Pares da rev. 6 (RNF03). A borda decorativa volta a `--border`, que no claro é mais visível que o fio branco |
| `forced-colors: active` | idem, mais o que o navegador força | O navegador troca fundos, textos e bordas pelas cores do sistema e remove as sombras. Como o fallback zera a translucidez e o desfoque, nenhum card fica "lavado" sobre o fundo. As bordas de 1px de todos os cards, inclusive os 3 do resumo, viram linhas do sistema e mantêm a separação. O highlight some junto com as sombras |
| Contexto opaco (`dialog`, `.drawer`, `.modal`, `[data-surface="opaque"]`) | idem, só na subárvore | `InlineAlert`, `EmptyState` e `.field` dentro de overlays ficam opacos, sem prop nova |

---

## 7. Componentes

### 7.1 Novos

Nenhum componente React novo. São só classes e papéis de CSS (ADR §8.1):

| Item | Tipo | Responsabilidade |
|---|---|---|
| `.glass` | classe (`@layer components`) | Material de vidro: fundo, borda, sombra com highlight e desfoque |
| `.glass-flat` | classe | Vidro sem desfoque para itens repetidos |
| `.glass-bar` | classe | Vidro de barra para sticky/fixed |
| Papéis `--card-bg`, `--card-bg-2`, `--field-bg`, `--bar-bg`, `--card-border`, `--card-shadow`, `--glass-filter`, `--item-filter`, `--chart-sep` | custom properties em `glass.css` | Desacoplam o componente do material. `--card-shadow` é acréscimo deste design (§1) |
| Constantes de layout do resumo (grade, card, título) | módulo do `MonthSummary` | Compartilhadas pelo componente e pelo skeleton (§5.4) |

### 7.2 Existentes alterados

| Componente | Mudança visual |
|---|---|
| `MonthSummary`, `MonthSummarySkeleton` | §5 |
| `AppHeader` | vidro de barra, borda inferior no papel `--card-border` |
| `.card` (`EmptyState`, `ChartCard`, cards de `/cards`, `error.tsx`, `BlockErrorBoundary`) | vidro |
| `ExpensesList`, `IncomePanel` | contêiner da tabela em vidro plano; `thead` em barra; linhas sem fundo; `EntryItem` em vidro plano; barra de lote em barra; toolbar em vidro |
| `InvoiceBlock` | vidro com borda `--border-strong`; totais mobile sem fundo, com `border-t` |
| `TabSubtotal` | vidro, variante 2 |
| `InlineAlert` | vidro (opaco em overlays) |
| `.field` | vidro na página |
| `MonthlyChart`, `CategoryDonut` | separadores `--chart-sep`; coluna sticky `bg-bar` |

### 7.3 Existentes sem mudança

`Drawer`, `BottomSheet`, `ModalDialog`, `Combobox` (lista), `Toast`, tooltip do Recharts, `StatusBadge`, `StatusDot`, `SignIndicator`, `Money`, `Skeleton`, `.segmented`, `.tablist`, `.page-bg-window`, `.btn*`, `.checkbox`, `.chip`.

**Exceção (alterado na implementação):** `MonthPicker` não é mais "sem mudança". A grade do popover passou de `z-30` para `z-[35]`: fica acima da faixa de abas sticky e da barra de lote (z-30), abaixo da navbar (z-40) e do toast (z-50). Sem isso, as abas e a barra de lote cobriam parte da grade (defeito preexistente, pego pelo CA12). Visualmente nada muda; o popover continua opaco, sem vidro nem desfoque.

---

## 8. Estados globais sobre vidro

| Estado | Tratamento |
|---|---|
| Carregando (rotas) | Skeletons dentro de cards de vidro. Blocos `--skeleton` opacos e sem animação nova |
| Vazio (`EmptyState`) | Card de vidro com o texto atual |
| Erro de rota (`error.tsx`) | Card de vidro. Mensagem em `--text` / `--danger-text` (6,19 / 5,50) |
| Erro inline (`InlineAlert`) | Vidro com borda `--danger` (4,62 / 5,50) na página. Opaco no drawer |
| Atualizando | Sem véu e sem opacidade no texto. O vidro não muda |
| Drawer aberto | Scrim sobre a página com vidro. O drawer e tudo dentro dele ficam opacos |
| Troca de tema | Os papéis trocam no mesmo quadro. O desfoque não anima (RF09) |

---

## 9. Entregas para as próximas tarefas

- **T3 (tester):** `EXPECTED_VALUES` rev. 7 com os valores do §1. Os `expected` dos pares de barra no §2.6. G10 por tema conforme o §3.2.
- **Architect (adendo ao ADR 0004):**
  1. `--glass-bar-bg` escuro passa a **0,90**, e não 0,89 (motivo: `--border-strong` 2,98 a 0,89; §2.6).
  2. Token composto `--glass-shadow` e papel `--card-shadow` (vidro: `var(--glass-shadow)`; opaco: `var(--shadow-card)`), que entram nos três blocos idênticos do G9.
  3. G10 por tema (§3.2).
- **T8:** a `<table>` perde `border`, `rounded-xl` e `shadow-card`, que passam para o contêiner `.glass-flat`. A borda inferior da navbar usa o papel `--card-border`.
- **T9:** o layout do §5. As medidas do §5.3 e §5.4 são as referências do CLS.
- **T12:** a rev. 7 do `design-system.md` reproduz o §1, o §2 (tabelas resumidas), o §4 e o §6. A regra 3 passa a ser: "Transparência só em `--scrim`, `--shadow-color` e nos tokens de vidro (`--glass-*`), aplicados pelos papéis de `glass.css`." "Blur apenas em modais e headers fixos" passa a ser: "Blur (12px) em superfícies de vidro e barras. Nunca em overlays, popovers, toast ou tooltip."

---

## 10. Riscos visuais e pendências

| # | Risco | Mitigação |
|---|---|---|
| D1 | Borda branca invisível no claro (R5) | Separação por luminância (1,10) e sombra difusa. Conferir em monitor de 8 bits nas regiões dos brilhos (ADR §9.4) |
| D2 | Mês vazio desloca o conteúdo abaixo em 32px na troca skeleton → dados | Caso raro, fora do cenário do CA20. Se a medição mostrar CLS > 0,01 no vazio, reservar a linha do aviso no skeleton só em `/dashboard` (onde não há lista abaixo) não resolve `/entries`. A alternativa é aceitar e registrar |
| D3 | Saldo com indicador quebrando em 360px | **Resolvido na implementação:** as linhas do Saldo reservam 44px no mobile, no real e no skeleton (§5.3, §5.4). Custo: card ~116px em vez de ~78px |
| D4 | Margem curta da barra no claro (`--accent` 4,52) | Qualquer mudança futura de `--accent` claro ou de `--text` claro exige recalcular o alfa da barra (o teste de extremos do ADR §5.3 pega) |
| D5 | Altura do resumo no mobile +~124px (R11; era +~86px antes da reserva de 44px do Saldo) | Aceito pelo B2. As abas sticky continuam acessíveis logo abaixo |
| D6 | Efeito da correção de cascata (`pr-11` no combobox e `-ml-3 -mt-2` no checkbox mobile) | Os dois ajustes eram a intenção original do layout. Conferir na T11 que o checkbox do `EntryItem` continua com o alvo de 44px dentro do card, sem encostar na borda de vidro |
