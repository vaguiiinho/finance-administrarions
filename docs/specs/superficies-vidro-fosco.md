# Spec: Superfícies em vidro fosco e resumo do mês sem card externo

**Impacto em UI: sim.** A feature muda a aparência da navbar, dos cards, dos campos e selects e de outras superfícies nos dois temas, e muda o layout do resumo do mês. O ui-designer participa: define os tokens de vidro, a classificação final das superfícies (vidro ou opaca) e o novo layout do resumo.

- Data: 2026-10-26
- Branch: `feat/ui-vidro`
- Status: **Implementada** (2026-10-27; aprovada no code review). **CA14 (desempenho, T10) permanece pendente de medição manual** (Lighthouse e trace, a registrar em `docs/runs/`). Desvios do ADR: adendo do ADR 0004. Histórico: **Aprovado** no gate em 2026-10-27. Usuário aprovou a feature no gate: B1 = opção (a) (vidro de barra com alfa 0,91 no claro e 0,90 no escuro, nenhuma cor de texto muda); B2-B5 aprovados com as respostas padrão (resumo em 3 cards empilhados no mobile, mesmo layout em /dashboard, itens de lista e tabela em vidro com `thead` sticky em vidro de barra, título "Resumo de <mês>" visível no mobile).
- Escopo: só `[web]`. Sem mudanças em `api/`, contratos HTTP, Prisma ou banco.
- Continua: `docs/specs/fundo-gradiente-temas.md` (revoga a decisão **B1** daquela spec), `docs/adr/0003-fundo-gradiente-temas.md` e `docs/design/design-system.md` (rev. 6).
- Referências de código: `web/app/styles/tokens.css`, `web/app/globals.css`, `web/components/app-header.tsx`, `web/components/month-summary.tsx`, `web/app/(app)/entries/_components/entries-header.tsx`, `web/lib/theme/contrast-pairs.ts`, `web/lib/theme/tokens.spec.ts`, `web/lib/theme/page-background.spec.ts`, `web/e2e/*`.

### Feedback do usuário (depois de ver o app rodando)

> "a navbar, os cards e alguns select não tiveram efeito nas mudança do tema, nos resumos tem 3 cards dentro de um card ficou aspecto meio estranho"

### Decisões do usuário (já tomadas, não reabrir)

1. **Superfícies em vidro fosco**: fundo translúcido com `backdrop-filter: blur`, para o gradiente aparecer atrás.
   - Vale para a navbar, os cards (`.card` e similares) e os selects/inputs.
   - Referência visual: card com vidro de ~70% de opacidade e borda clara de 1px.
   - O contraste AA continua obrigatório no pior caso, com a superfície translúcida composta sobre as amostras do gradiente.
2. **Resumo do mês em `/entries` sem o card externo**:
   - Os 3 cards (Receitas, Despesas, Saldo) ficam soltos sobre o fundo.
   - "Resumo de <mês>" e "Sem lançamentos neste mês" viram texto simples, acima e abaixo dos cards.
   - O agrupamento mantém semântica e acessibilidade: região/landmark com nome acessível.

---

## 1. Contexto

### 1.1 Estado atual (levantado no código)

**Fundo.** O gradiente é uma camada fixa `body::before` (`--bg-gradient`, montado a partir de `--bg-stop-1..3` e `--bg-glow-1..2`). O axe não enxerga essa camada e mede o texto contra `--bg`. O pior caso real é coberto por `tokens.spec.ts` (amostrador próprio) e por `auditPageGradient` (`e2e/support.ts`). Hoje essa auditoria só mede textos cuja cadeia de ancestrais até o `body` é **toda transparente**.

**Por que a navbar "não teve efeito".** `--header-bg` tem alfa 0,95 e `backdrop-blur-md` (`app-header.tsx`). Com 95% de opacidade, o gradiente quase não aparece.

**Por que cards e selects "não tiveram efeito".** Pela decisão B1 da spec anterior, todas as superfícies ficaram opacas (`--surface`, `--surface-2`, `--input-bg`). A regra 3 do design system diz: "Transparência só em `--scrim`, `--header-bg` e sombras". A regra de forma e profundidade diz: "Blur apenas em modais e headers fixos".

**Por que o resumo mostra "3 cards dentro de um card".**
- `MonthSummary` (`web/components/month-summary.tsx`) é **um só markup**. No mobile ele é um card único compacto, com os grupos separados por `border-t`. A partir de `md` deveria virar 3 cards: o `<section>` recebe `card ... md:border-0 md:bg-transparent md:p-0 md:shadow-none` e cada grupo recebe `md:bg-surface md:border md:shadow-card`.
- **Provável causa (a confirmar pelo architect):** `.card` é declarado em `globals.css` **fora** de cascade layer. Os utilitários do Tailwind 4 ficam em `@layer utilities`, e uma regra sem layer vence uma regra com layer, independentemente da especificidade. Por isso `md:bg-transparent`, `md:border-0` e `md:shadow-none` não anulam o fundo, a borda e a sombra do `.card`, e o card externo continua visível no desktop.
- No `MonthSummarySkeleton`, `md:card` também não deve gerar nada, porque `.card` não é um utilitário registrado.

**Onde o resumo aparece.** `MonthSummary` e `MonthSummarySkeleton` são usados em `/entries` (`entries-header.tsx` e `entries/loading.tsx`) **e** em `/dashboard` (`dashboard-blocks.tsx`, `dashboard/page.tsx` e `dashboard/loading.tsx`).
- O nome acessível atual da região é "Resumo de <mês por extenso>", via `aria-labelledby` + `<h2>`. Esse `<h2>` é `sr-only` no mobile e visível a partir de `md`.
- Testes que dependem da região: `month-summary.spec.tsx`, `dashboard-blocks.spec.tsx` e `e2e/entries.pw.ts` (`getByRole("region", { name: /Resumo/ })`).

### 1.2 Inventário de superfícies

A coluna "Proposta" aplica a regra geral da §3. Os itens marcados com (*) precisam de confirmação do ui-designer.

| Superfície | Onde | Fundo hoje | O que fica atrás | Proposta |
|---|---|---|---|---|
| Navbar | `app-header.tsx` (`[data-navbar]`, sticky) | `--header-bg` 0,95 + `backdrop-blur-md` | conteúdo que rola (texto, cards) | **Vidro de barra** (B1) |
| `.card` | resumo (grupos), `cards-list.tsx`, `chart-card.tsx`, `EmptyState`, `error.tsx` de cada rota, `expenses-panel.tsx` (alerta), skeletons do dashboard | `--surface` | gradiente | **Vidro** |
| Itens de lista no mobile | `expenses-list.tsx` e `income-panel.tsx` (`EntryItem` com `bg-surface`, `shadow-card`) | `--surface` (selecionado: `--surface-2`) | gradiente | **Vidro** (B4) |
| Tabela no desktop | `expenses-list.tsx` e `income-panel.tsx` (`<table>` com linhas `bg-surface`) | `--surface` por linha | gradiente | **Vidro no contêiner, linhas sem fundo próprio** (B4) (*) |
| Cabeçalho sticky da tabela | `thead` sticky com `bg-surface` | `--surface` | linhas que rolam por baixo | **Vidro de barra** (*) |
| Barra de ações em lote (mobile) | `expenses-list.tsx`, `fixed bottom-0`, `bg-surface-2` | `--surface-2` | conteúdo que rola | **Vidro de barra** (*) |
| Bloco de fatura | `invoice-block.tsx` (`bg-surface`, `border-strong`) | `--surface` | gradiente | **Vidro** |
| Totais dentro do bloco de fatura (mobile) | `invoice-block.tsx` `dl` com `bg-surface-2` | `--surface-2` | o bloco de vidro | Variante interna (*) |
| Subtotal da aba | `tab-subtotal.tsx` (`bg-surface-2`) | `--surface-2` | gradiente | **Vidro** (variante 2) (*) |
| Banner de alerta | `InlineAlert` (`states.tsx`, `bg-surface`) | `--surface` | gradiente ou drawer | Vidro sobre o fundo; opaco dentro de drawer/modal |
| Barra de seleção do desktop | `expenses-list.tsx` (`bg-surface`, `md:flex`) | `--surface` | gradiente | **Vidro** |
| Inputs e selects sobre o fundo | filtros de despesas (`expense-filters.tsx`, `.field`) | `--input-bg` | gradiente | **Vidro** |
| Inputs, selects e combobox dentro de drawer/modal | `new-entry-drawer.tsx`, `card-drawer.tsx`, `combobox.tsx` (input) | `--input-bg` | `--surface` opaco | **Opaco** (PA2) |
| Campo desabilitado ou somente leitura | `.field:disabled`, `.field[readonly]` | `--surface-2` | — | **Opaco** (PA3) |
| Checkbox | `.checkbox::before` | `--input-bg` | linha/card | **Opaco** (PA3) |
| Drawer, folha (bottom sheet), modal | `drawer.tsx`, `bottom-sheet.tsx`, `modal-dialog.tsx`, `.drawer`, `.modal` | `--surface` | scrim + página | **Opaco** |
| Scrim | `dialog::backdrop` | `--scrim` | página | Inalterado |
| Lista do combobox | `combobox.tsx` (`listbox`, `bg-surface`, `shadow-lg`) | `--surface` | campos do drawer | **Opaco** (lista longa) |
| Popover do seletor de mês | `month-picker.tsx` (`bg-surface`) | `--surface` | conteúdo da página | **Opaco** (popover) |
| Lista nativa do `<select>` | `option { background: var(--surface) }` | `--surface` | renderizada pelo SO | **Opaco** (fora do controle do CSS) |
| Toast | `toast.tsx` (`bg-surface-2`, `shadow-lg`) | `--surface-2` | qualquer conteúdo | **Opaco** |
| Tooltip dos gráficos | Recharts (`--tooltip-bg`) | `--tooltip-bg` | gráfico | **Opaco** |
| Pílula "Sem lançamentos de…" no gráfico | `monthly-chart.tsx` (`bg-surface`) | `--surface` | linhas do gráfico | **Opaco** |
| Coluna sticky da tabela do gráfico | `monthly-chart.tsx` (`th` sticky com `bg-surface`) | `--surface` | células que rolam na horizontal | **Opaco** (*) |
| Link "Pular para o conteúdo" | `app-header.tsx` (`focus:bg-surface`) | `--surface` | qualquer conteúdo | **Opaco** |
| Faixa de abas de `/entries` | `entries-tabs-bar.tsx` (`.page-bg-window`) | gradiente opaco (janela) | conteúdo que rola | **Inalterada** (opaca, já mostra o gradiente) |
| `.segmented` / `.tablist` | `globals.css` | `transparent` | gradiente/drawer | Inalterado |
| `StatusBadge`, `StatusDot`, `SignIndicator` | `status.tsx` | sem fundo (só texto/ponto) | a superfície que os contém | Inalterado. Os pares de cor passam a ser verificados sobre o vidro |
| Skeleton | `.skeleton` (`--skeleton`) | `--skeleton` | card de vidro | Opaco, dentro de card de vidro |
| Estados de botão (`.btn` hover/active/disabled) | `globals.css` | `--surface-2` / `--surface-active` | card ou fundo | Inalterado (*) |
| Separadores dos gráficos | Recharts `stroke="var(--surface)"` (barras, donut, pontos) | cor de `--surface` | card de vidro | Revisar (R6) |

---

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Vidro fosco** | Superfície com fundo translúcido (opacidade < 1) e desfoque do que está atrás (`backdrop-filter: blur`), separada do fundo por uma borda clara de 1px. |
| **Superfície de vidro** | Superfície que fica sobre o fundo da página e recebe o vidro fosco: cards, itens de lista, bloco de fatura, subtotal, campos sobre o fundo. Referência: ~70% de opacidade. |
| **Vidro de barra** | Variante de vidro para elementos sticky ou fixos com **conteúdo rolando por baixo** (navbar, cabeçalho sticky de tabela, barra de ações em lote). A opacidade pode ser maior que a do card, porque o pior caso inclui texto passando atrás (B1). |
| **Superfície opaca** | Superfície que continua com fundo sólido: overlays (drawer, folha, modal), popovers e listas (combobox, seletor de mês, lista nativa do select), toast, tooltip e controles dentro de overlays opacos. |
| **Overlay** | Camada modal sobre a página com scrim (`dialog` no top layer): drawer, folha e modal. |
| **Popover** | Camada não modal ancorada em um controle: lista do combobox, menu do seletor de mês, tooltip. |
| **Borda de vidro** | Borda clara de 1px que delimita a superfície de vidro (referência visual do usuário). É decorativa: a separação card/fundo não pode depender só dela (RNF04). |
| **Composição de vidro** | Cor efetiva sob o texto: a cor translúcida da superfície composta sobre o que está atrás. Para contraste, o "atrás" é **cada amostra do gradiente** e, no vidro de barra, também o conteúdo que rola por baixo. O desfoque **não** entra no cálculo. |
| **Pior caso de contraste (vidro)** | Menor razão entre um primeiro plano e todas as composições de vidro possíveis. |
| **Fallback opaco** | Aparência adotada quando o vidro não deve ou não pode ser aplicado: sem suporte a `backdrop-filter`, com `prefers-reduced-transparency: reduce`, com `prefers-contrast: more` ou com `forced-colors: active`. As superfícies voltam aos valores opacos da rev. 6. |
| **Resumo do mês** | Região com os totais do mês (Receitas; Despesas total/pago/pendente; Saldo realizado/previsto). Componente `MonthSummary`. |
| **Título do resumo** | Texto "Resumo de <mês por extenso>", que nomeia a região. |
| **Aviso de mês vazio** | Texto "Sem lançamentos neste mês", exibido abaixo dos cards quando todos os totais são zero. |
| **Card externo** | O contêiner `card` que hoje envolve os 3 grupos do resumo. Deixa de existir. |

---

## 3. Requisitos funcionais

### Vidro fosco

- **RF01 – Regra geral de classificação.**
  - Recebe **vidro**: toda superfície que fica sobre o fundo da página e não é overlay, popover nem notificação.
  - Recebe **vidro de barra**: todo elemento sticky ou fixo sob o qual o conteúdo rola.
  - Continua **opaco**: overlays (drawer, folha, modal), popovers e listas (combobox, seletor de mês, lista nativa do `<select>`), toast, tooltip, link "Pular para o conteúdo" e controles dentro de overlays opacos.
  - A classificação final por componente é a do inventário (§1.2), confirmada pelo ui-designer na T1.
- **RF02 – Navbar em vidro de barra.** O gradiente fica visivelmente perceptível atrás da navbar nos dois temas, com desfoque. A opacidade é definida pelo ui-designer para passar AA no pior caso (B1).
- **RF03 – Cards em vidro.**
  - `.card` e as superfícies equivalentes do inventário passam a ter fundo translúcido (referência ~70%), desfoque e borda clara de 1px, nos dois temas.
  - O efeito vale em `/entries`, `/cards` e `/dashboard` e nos estados de carregamento, vazio, erro e atualizando.
- **RF04 – Campos sobre o fundo em vidro.** Inputs e selects (`.field`) que ficam sobre o fundo da página ou sobre uma superfície de vidro (ex.: filtros de despesas) recebem vidro. O texto digitado, o placeholder, a borda do controle e o anel de foco mantêm AA. A lista aberta do `<select>` nativo continua opaca, pois é desenhada pelo sistema.
- **RF05 – Superfícies opacas inalteradas.** Overlays, popovers, toast e tooltip mantêm os valores atuais (rev. 6) e continuam com sombra marcada. O scrim não muda.
- **RF06 – Fallback sem `backdrop-filter`.** Em navegadores sem suporte a `backdrop-filter` (com ou sem prefixo `-webkit-`), toda superfície de vidro e de vidro de barra usa o **fallback opaco**. Não pode existir superfície translúcida sem desfoque se isso derrubar o contraste ou a legibilidade.
- **RF07 – `prefers-reduced-transparency: reduce`.** Com essa preferência, onde o navegador a suporta, todas as superfícies usam o fallback opaco: sem translucidez e sem desfoque. A borda e a sombra ficam como na rev. 6.
- **RF08 – Alto contraste.** Com `prefers-contrast: more` ou `forced-colors: active`, vale o mesmo fallback opaco do RF07 (PA4).
- **RF09 – Troca de tema.** A troca de tema (botão ou sistema) troca as cores do vidro no mesmo quadro, sem transição nem flash, mantendo as garantias de CA12 e CA13 da spec anterior. O desfoque não é animado.
- **RF10 – Fonte única de cores.** Toda cor nova (vidro, borda de vidro, vidro de barra) fica **só** em `web/app/styles/tokens.css`, declarada com `light-dark()`. `test/no-literal-colors.spec.ts` continua verde.
- **RF11 – Faixa de abas.** A faixa de abas de `/entries` (`.page-bg-window`) continua opaca: ela já mostra o gradiente e esconde o conteúdo que rola por baixo. A 2ª linha da navbar no mobile continua sem fundo.

### Resumo do mês

- **RF12 – Sem card externo.** O resumo deixa de ter o contêiner com fundo, borda e sombra de card. Os 3 grupos (Receitas, Despesas, Saldo) viram 3 cards de vidro independentes sobre o fundo, em todos os breakpoints (B2).
- **RF13 – Título como texto simples.** "Resumo de <mês por extenso>" aparece como texto simples (sem card) **acima** dos 3 cards e é visível em todos os breakpoints (B5). Continua sendo o elemento que nomeia a região.
- **RF14 – Aviso de mês vazio.** "Sem lançamentos neste mês" aparece como texto simples **abaixo** dos 3 cards, só quando todos os totais são zero (regra atual).
- **RF15 – Semântica.** O resumo continua sendo uma região com nome acessível "Resumo de <mês por extenso>": `<section>` com `aria-labelledby` apontando para o título, que é um heading do nível atual (`h2`). A lista de definição (`dl`/`dt`/`dd`) e a ordem de leitura (título → Receitas → Despesas → Saldo → aviso de mês vazio) se mantêm.
- **RF16 – Skeleton coerente.** O estado de carregamento do resumo (`MonthSummarySkeleton`) reproduz o novo layout (título + 3 cards soltos), sem card externo e sem salto de layout ao trocar para os dados.
- **RF17 – Mesmo componente em `/dashboard`.** Como o componente é compartilhado, o novo layout vale também para o resumo de `/dashboard` (B3).
- **RF18 – Valores intactos.** Os valores continuam vindo da API (nunca calculados no web), formatados em pt-BR com `Money`. Nenhuma mudança de dado, rótulo ou ordem dos valores dentro de cada card.

### Documentação

- **RF19 – Design system rev. 7.** Atualizar `docs/design/design-system.md`:
  - novos tokens de vidro e regras de uso;
  - revisão da regra 3 ("Transparência só em…") e de "Blur apenas em modais e headers fixos";
  - tabela de classificação das superfícies;
  - fallbacks e razões de contraste no pior caso;
  - novo layout do resumo.

---

## 4. Requisitos não funcionais

- **RNF01 – Acessibilidade (WCAG 2.1 AA) no pior caso.**
  - Texto normal ≥ 4,5:1, texto grande ≥ 3:1, não textual (borda de controle, foco, indicadores) ≥ 3:1.
  - Para superfícies de vidro, todo par que hoje é verificado contra `--surface` / `--surface-2` / `--input-bg` naquele contexto passa a ser verificado contra a **composição de vidro sobre cada amostra do gradiente** (`PAGE_BACKGROUND_TOKENS` + `sampleGradient`). Isso inclui textos, semânticas, `--income`/`--expense`, `--chart-*`, `--border-strong`, `--primary-border`, `--focus-color` e os indicadores de status.
  - Para o vidro de barra, o pior caso também inclui o conteúdo que rola por baixo, nos termos do `HEADER_UNDER` atual (`--surface`, `--surface-2`, `--text`, agora também as superfícies de vidro).
  - O desfoque **não** conta a favor no cálculo.
  - Nenhum mínimo é afrouxado.
- **RNF02 – Pares opacos preservados.** Os pares das superfícies que continuam opacas (drawer, modal, popovers, toast, tooltip, campos em overlays) mantêm os valores e as razões atuais.
- **RNF03 – Fallback opaco também passa.** No fallback opaco (RF06–RF08), todos os pares passam com os valores da rev. 6, os mesmos de hoje.
- **RNF04 – Separação card/fundo.**
  - Cada superfície de vidro continua distinguível do fundo em todas as regiões do gradiente, nos dois temas.
  - A separação vem da borda de vidro + sombra + diferença de luminância. Não pode depender só de uma delas, em especial no tema claro, onde a borda clara pode sumir sobre o fundo claro.
- **RNF05 – Desempenho.**
  - O desfoque não pode degradar a rolagem nem a interação.
  - Referência sugerida (TQ5): Lighthouse mobile em `/entries` com queda ≤ 5 pontos em relação à rev. 6 e CLS sem aumento.
  - Trace de rolagem da lista longa (cenário `many`, CPU 4x mais lenta) sem quadros longos recorrentes (> 50 ms) atribuídos a paint/composição do desfoque.
  - Raio de desfoque e quantidade de elementos desfocados simultâneos são decisão técnica (TQ3).
- **RNF06 – Sem movimento novo.** Nenhuma animação ou transição de opacidade/desfoque. `data-theme-switching` continua desligando transições.
- **RNF07 – Sem regressão de empilhamento.** Popovers (seletor de mês, combobox), toasts e overlays continuam aparecendo por cima de qualquer superfície de vidro. `backdrop-filter` cria contexto de empilhamento e bloco de contenção, e isso não pode prender um popover atrás de um card vizinho (R3).
- **RNF08 – Responsividade.** O vidro e o novo resumo funcionam de 360 px a ≥ 1280 px. No mobile, os 3 cards do resumo empilham sem rolagem horizontal.
- **RNF09 – Testes.** Todo código novo tem teste. As suítes de tokens e de contraste são atualizadas antes da implementação (fase red), sem afrouxar mínimos. Cobertura ≥ 80% nos arquivos novos de `lib/`.
- **RNF10 – Sem cor literal fora de `tokens.css`** (RF10).

---

## 5. Critérios de aceite

### Vidro fosco

**CA01 – Navbar em vidro**
- Given uma tela do app (`/entries`, `/cards` ou `/dashboard`) em cada tema
- When observo a navbar no topo, sem rolar
- Then o gradiente do fundo aparece atrás dela, desfocado
- And a cor de fundo computada da navbar tem alfa < 1, com o valor definido no design rev. 7
- And `backdrop-filter` contém `blur`.

**CA02 – Navbar legível com conteúdo rolando**
- Given `/entries` com a lista longa (cenário `many`), rolada de modo que cards e texto passem sob a navbar
- When verifico o contraste do texto, do item ativo, dos inativos e do foco da navbar
- Then todos atingem o mínimo da categoria no pior caso calculado (tokens) e na auditoria do navegador.

**CA03 – Cards em vidro**
- Given `/entries`, `/cards` e `/dashboard` em cada tema
- When observo qualquer `.card` ou superfície classificada como vidro na §1.2
- Then o fundo computado tem alfa igual ao token de vidro (referência ~0,70), `backdrop-filter` contém `blur` e a borda é a borda de vidro de 1px
- And o gradiente é perceptível através do card.

**CA04 – Campos sobre o fundo em vidro**
- Given a aba Despesas de `/entries` com os filtros visíveis
- When observo os selects de categoria/cartão e os demais campos de filtro
- Then o fundo deles é o vidro definido para campos, com borda de controle visível (≥ 3:1 no pior caso)
- And o texto selecionado e o placeholder atingem ≥ 4,5:1 no pior caso
- And ao abrir um select a lista de opções é opaca.

**CA05 – Overlays e popovers continuam opacos**
- Given o drawer de novo lançamento aberto, com a lista do combobox aberta
- When inspeciono o drawer, os campos dentro dele, a lista do combobox, o popover do seletor de mês, um toast e o tooltip de um gráfico
- Then todos têm fundo opaco (alfa 1) com os valores da rev. 6 e não usam `backdrop-filter`
- And os campos dentro do drawer continuam com `--input-bg` (CA de troca de tema da `theme.pw.ts` segue válido).

**CA06 – Contraste no pior caso (tokens)**
- Given os novos tokens de vidro
- When `lib/theme/tokens.spec.ts` roda
- Then todo par declarado sobre uma superfície de vidro passa com o mínimo da categoria contra a composição sobre **cada amostra** do gradiente, nos dois temas
- And os pares de vidro de barra passam também compostos sobre o conteúdo que rola por baixo
- And os pares das superfícies opacas mantêm as razões atuais.

**CA07 – Contraste no navegador**
- Given cada tela principal em cada tema, nos estados já auditados (dados, vazio, erro, atualizando, drawer aberto)
- When rodo `a11y.pw.ts` e a auditoria de pior caso do gradiente
- Then não há violação de contraste
- And os textos sobre superfícies de vidro são auditados contra a composição sobre as amostras do gradiente, e não só contra `--bg`.

**CA08 – Fallback sem `backdrop-filter`**
- Given um navegador (ou emulação) sem suporte a `backdrop-filter`
- When abro qualquer tela
- Then navbar, cards e campos usam o fallback opaco (alfa 1, valores da rev. 6)
- And todos os pares de contraste passam.

**CA09 – Transparência reduzida**
- Given `prefers-reduced-transparency: reduce` ativo (emulado)
- When abro qualquer tela
- Then nenhuma superfície tem fundo translúcido nem `backdrop-filter`
- And a aparência é a do fallback opaco.

**CA10 – Alto contraste**
- Given `prefers-contrast: more` ou `forced-colors: active`
- When abro qualquer tela
- Then vale o fallback opaco, como no CA09.

**CA11 – Troca de tema**
- Given uma tela no tema claro
- When clico no botão de tema
- Then o vidro de navbar, cards e campos passa para os valores do escuro no mesmo quadro, sem transição
- And recarregar mantém o tema desde o primeiro quadro.

**CA12 – Empilhamento**
- Given o seletor de mês e o combobox abertos perto de cards de vidro, em mobile e desktop
- When observo a sobreposição
- Then o popover fica inteiro por cima dos cards vizinhos e é clicável
- And toasts e overlays continuam por cima de tudo.

**CA13 – Faixa de abas inalterada**
- Given `/entries` rolada, com a faixa de abas grudada
- Then a faixa continua opaca (`.page-bg-window`), sem `backdrop-filter`, como na rev. 6.

**CA14 – Desempenho**
- Given o build de produção
- When meço o Lighthouse mobile de `/entries` (3 execuções, mediana) e o trace de rolagem da lista longa
- Then a pontuação cai no máximo 5 pontos em relação à rev. 6, o CLS não aumenta e não há quadros longos recorrentes atribuídos ao desfoque
- And o resultado fica registrado em `docs/runs/`.

### Resumo do mês

**CA15 – Sem card externo (desktop)**
- Given `/entries` em viewport ≥ 768 px, com dados
- When observo o resumo
- Then vejo o texto "Resumo de <mês>" e, abaixo, 3 cards de vidro lado a lado (Receitas, Despesas, Saldo)
- And o contêiner que envolve os 3 cards não tem fundo, borda nem sombra (computados: fundo transparente, borda 0, `box-shadow: none`).

**CA16 – Sem card externo (mobile)**
- Given `/entries` em 360 px, com dados
- When observo o resumo
- Then vejo o título visível e os 3 cards empilhados, cada um com o próprio vidro, sem card externo e sem rolagem horizontal.

**CA17 – Mês vazio**
- Given um mês sem lançamentos
- When o resumo é exibido
- Then os 3 cards mostram R$ 0,00 (e "Zerado" no saldo, regra atual)
- And "Sem lançamentos neste mês" aparece como texto simples **abaixo** dos cards, fora de qualquer card.

**CA18 – Semântica preservada**
- Given o resumo renderizado
- When consulto a árvore de acessibilidade
- Then existe uma `region` com nome "Resumo de <mês por extenso>", que contém os 3 grupos e o aviso de mês vazio
- And o título é um heading de nível 2
- And os 6 valores continuam em pares `dt`/`dd`
- And `month-summary.spec.tsx`, `dashboard-blocks.spec.tsx` e `e2e/entries.pw.ts` passam sem mudar a forma de localizar a região.

**CA19 – Contraste do texto simples**
- Given o título e o aviso de mês vazio sobre o fundo
- When rodo a auditoria de pior caso do gradiente
- Then ambos atingem ≥ 4,5:1 contra todas as amostras (par `--text-muted`/`--text` sobre `--bg`).

**CA20 – Skeleton sem salto**
- Given `/entries` e `/dashboard` em carregamento
- When o skeleton do resumo dá lugar aos dados
- Then o skeleton já mostra o título (ou o espaço dele) e 3 cards soltos no mesmo arranjo
- And o CLS da troca é ≤ 0,01.

**CA21 – Dashboard**
- Given `/dashboard`
- When observo o resumo do mês
- Then ele segue o mesmo layout de CA15–CA18.

**CA22 – Valores e atualização intactos**
- Given a troca de mês, de aba ou de filtro em `/entries`
- When o resumo atualiza
- Then os valores vêm da API e não dependem de aba, filtro ou página (CA47 da spec de lançamentos)
- And o estado "atualizando" continua sem opacidade reduzida no texto (`dark-theme.pw.ts`).

---

## 6. Fora de escopo

- Qualquer mudança em `api/`, Prisma, banco ou contratos HTTP.
- Vidro em overlays (drawer, folha, modal), popovers, toast e tooltip, salvo se B1–B5 mudarem a classificação.
- Mudar o gradiente do fundo (tokens `--bg*`) ou a faixa de abas (`.page-bg-window`).
- Animações de vidro (brilho, reflexo, "shine" no hover).
- Seletor de "intensidade do vidro" ou opção de desligar o vidro no app. O usuário usa a preferência do sistema (RF07).
- Redesenho dos cards além de fundo, borda e sombra (tipografia, espaçamentos internos e ícones ficam como estão).
- Mudança nas cores semânticas e nas séries dos gráficos, salvo se algum par deixar de passar AA sobre o vidro (nesse caso, o ajuste é registrado na rev. 7).
- Mudança no conteúdo do resumo (novos totais, comparativos com o mês anterior etc.).

---

## 7. Riscos

| # | Risco | Mitigação sugerida |
|---|---|---|
| R1 | **Contraste da navbar com conteúdo por baixo.** Hoje a navbar passa porque tem alfa 0,95, inclusive composta sobre `--text`. A ~70%, texto escuro passando por baixo (tema claro) derruba o contraste, e o desfoque não conta no cálculo. | Vidro de barra com opacidade própria (B1); pior caso com `HEADER_UNDER` estendido. |
| R2 | **Axe não vê o gradiente nem o desfoque.** O axe compõe a cor translúcida sobre `--bg` (base), e não sobre as amostras. Hoje `auditPageGradient` ignora textos com qualquer ancestral com fundo. Textos em vidro ficariam sem verificação de pior caso no navegador. | Estender a auditoria de pior caso para superfícies translúcidas (TQ2). |
| R3 | **Empilhamento.** `backdrop-filter` cria contexto de empilhamento e bloco de contenção para descendentes `position: fixed`. Um popover dentro de um card de vidro pode ficar atrás do card seguinte, e um elemento `fixed` dentro de um card pode ficar contido nele. | CA12; o architect mapeia os popovers que ficam dentro de superfícies de vidro. |
| R4 | **Desempenho do desfoque.** Com o fundo fixo, cada card de vidro visível precisa refazer o desfoque a cada quadro de rolagem. Isso é caro em listas longas no mobile (até ~50 `EntryItem`). | RNF05/CA14; TQ3 (raio pequeno, desfoque só em contêineres, ou translucidez sem desfoque nos itens de lista, já que sobre um gradiente suave o desfoque quase não aparece). |
| R5 | **Separação card/fundo no tema claro.** Branco translúcido com borda clara sobre lavanda clara pode "sumir" em algumas regiões. | RNF04; o ui-designer valida as regiões dos brilhos nos dois temas. |
| R6 | **Separadores dos gráficos.** Barras, fatias do donut e pontos usam `stroke="var(--surface)"` para se separar. Sobre um card translúcido, uma linha de cor opaca `--surface` fica visível como contorno de outra cor. | O ui-designer define o separador sobre vidro; pares de gráfico verificados sobre a composição. |
| R7 | **Suítes rígidas.** `tokens.spec.ts` proíbe tokens extras, fixa valores e só admite alfa em `--header-bg`, `--scrim` e `--shadow-color`. Qualquer token de vidro quebra a suíte. | O tester atualiza a suíte na fase red, sem afrouxar mínimos (T3). |
| R8 | **Causa do "card dentro de card".** Se a causa for a ordem de cascata (`.card` fora de layer vs. utilitários em `@layer`), outros lugares que tentam anular `.card` com utilitários `md:` podem ter o mesmo defeito. | O architect confirma a causa e varre usos de `card` combinados com utilitários que o anulam. |
| R9 | **Suporte a `prefers-reduced-transparency`.** A media query tem suporte parcial (não existe em todos os navegadores). Sem suporte, a preferência do usuário é ignorada. | Aceitar como limitação documentada; o fallback por `@supports` e alto contraste continua valendo. |
| R10 | **Safari e prefixo.** Versões antigas do Safari só aceitam `-webkit-backdrop-filter`. Uma detecção feita só pela propriedade sem prefixo cairia no fallback sem necessidade, ou mostraria translucidez sem desfoque. | TQ4 (detecção com e sem prefixo). |
| R11 | **Mudança de layout no mobile.** O resumo compacto no mobile (card único com linhas) era uma decisão de design anterior (D10/D20). Três cards empilhados ocupam mais altura acima das abas. | B2; o ui-designer valida a altura no mobile. |

---

## 8. Perguntas em aberto

### Bloqueantes (mudam a regra de negócio ou o resultado visível)

| # | Pergunta | Resposta padrão sugerida |
|---|---|---|
| **B1** | A navbar (e as demais barras sticky/fixas com conteúdo rolando por baixo) pode ter **opacidade maior** que os cards (~70%), se for necessário para passar AA com texto rolando por trás? | Sim. "Vidro de barra" com opacidade própria, definida pelo ui-designer como o menor valor que passa AA no pior caso (estimativa: 0,80–0,85), com o mesmo desfoque e borda. O gradiente continua visível atrás da navbar no topo da página. |
| **B2** | No **mobile**, o resumo também vira 3 cards empilhados (abandonando o card compacto único com linhas)? | Sim. Mesmo arranjo em todos os breakpoints: título, 3 cards de vidro empilhados (gap de 12 px) e aviso de mês vazio. Os cards no mobile mantêm a compactação interna atual (valores em uma linha). |
| **B3** | O novo layout do resumo vale também para `/dashboard`, que usa o mesmo componente? | Sim. O componente é único; o resumo fica igual nas duas telas. |
| **B4** | Os itens de lista (cards de lançamento no mobile) e a tabela de lançamentos no desktop também ficam em vidro? | Sim. Os itens de lista no mobile são cards de vidro. Na tabela do desktop, o contêiner é de vidro, as linhas não têm fundo próprio e hover/seleção usam uma variante translúcida definida pelo ui-designer. O cabeçalho sticky da tabela usa vidro de barra. |
| **B5** | O título "Resumo de <mês>" passa a ser **visível também no mobile** (hoje é só para leitor de tela abaixo de `md`)? | Sim. Visível em todos os breakpoints, em texto simples `--text-muted`, 14 px, peso 500 (estilo atual do desktop). |

### Técnicas (decisão do architect)

| # | Pergunta | Resposta padrão sugerida |
|---|---|---|
| **TQ1** | Como representar o vidro nos tokens, se `tokens.spec.ts` só aceita `light-dark(cor, cor)` e restringe tokens com alfa? | Tokens de cor com alfa em `light-dark()` (ex.: `--surface-glass`, `--surface-glass-2`, `--input-glass`, `--bar-glass`, `--glass-border`), adicionados à lista de tokens com alfa. Os tokens opacos atuais continuam existindo para overlays e para o fallback. O raio de desfoque fica como token composto fora de `light-dark()`, como `--shadow-card`. |
| **TQ2** | Como garantir no navegador o pior caso de texto sobre vidro, se o axe compõe só contra `--bg`? | Estender a auditoria de pior caso (`auditPageGradient` / `pageGradientFailures` em `e2e/support.ts`) para textos cuja cadeia até o `body` tem apenas fundos translúcidos: compor as camadas translúcidas sobre cada amostra do gradiente. `INCOMPLETE_ALLOWLIST` da navbar não cresce. |
| **TQ3** | Onde aplicar o desfoque e com que raio, para cumprir RNF05? | Raio pequeno (8–12 px). Desfoque em cards, navbar e campos. Nos itens de lista repetidos (mobile) e nas linhas de tabela, só translucidez, porque o fundo atrás é um gradiente suave e o desfoque não muda o resultado visual. Se a medição da T10 passar com desfoque em tudo, mantém-se o desfoque em tudo. |
| **TQ4** | Como detectar suporte e aplicar os fallbacks? | `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`, mais `@media (prefers-reduced-transparency: reduce)`, `(prefers-contrast: more)` e `(forced-colors: active)`, todos voltando aos tokens opacos, em um único ponto do CSS. Testes estáticos garantem a presença das quatro condições. |
| **TQ5** | Referência de desempenho para RNF05? | A mesma do ADR 0003 §5.7: Lighthouse mobile em `/entries?month=2026-11`, 3 execuções, mediana, contra a rev. 6, com queda ≤ 5 e ΔCLS ≤ 0,01. Mais um trace do Chrome rolando o cenário `many` com CPU 4x mais lenta. Execução manual, registrada em `docs/runs/`. |
| **TQ6** | Como corrigir o "card dentro de card" de forma que não se repita (R8)? | Confirmar a causa (cascata `.card` sem layer vs. `@layer utilities`). Remover o card externo do markup do resumo, em vez de anulá-lo com utilitários, e decidir se `.card` vai para `@layer components`, varrendo os demais usos. |
| **TQ7** | Como emular `prefers-reduced-transparency` e a ausência de `backdrop-filter` no Playwright? | `prefers-reduced-transparency` por CDP (`Emulation.setEmulatedMedia` com `features`) no Chromium. A ausência de suporte é coberta por teste estático da regra `@supports` mais um e2e que injeta a mesma regra de fallback. `prefers-contrast`/`forced-colors` via `page.emulateMedia`. |
| **TQ8** | Como os separadores dos gráficos (`stroke="var(--surface)"`) se comportam sobre vidro (R6)? | Token próprio de separador, definido pelo ui-designer, verificado sobre a composição de vidro. Os componentes Recharts trocam `var(--surface)` pelo novo token. |

### Premissas adotadas

- **PA1** – A referência "~70%" vale para o vidro de card nos dois temas. O ui-designer pode ajustar por tema (ex.: 0,72 no claro, 0,68 no escuro), desde que os pares passem no pior caso. O valor final fica no design rev. 7.
- **PA2** – Campos e selects **dentro de overlays opacos** (drawer, folha, modal) continuam opacos com `--input-bg`: atrás deles não há gradiente, e o vidro não teria efeito. O pedido do usuário ("alguns select") se refere aos selects sobre a página (filtros).
- **PA3** – Campos desabilitados ou somente leitura (`--surface-2`) e o checkbox (`--input-bg`) continuam opacos, para o estado ficar inequívoco e a borda manter 3:1.
- **PA4** – `prefers-contrast: more` e `forced-colors: active` usam o mesmo fallback opaco de `prefers-reduced-transparency` (RF08).
- **PA5** – A borda de vidro é decorativa (não entra no mínimo de 3:1 para não texto, como `--border` hoje). Bordas de **controles** (campos) continuam com `--border-strong` e 3:1 no pior caso.
- **PA6** – A sombra `--shadow-card` continua nas superfícies de vidro. O ui-designer pode intensificá-la para cumprir RNF04.
- **PA7** – Estados de botão (`.btn` hover/active/disabled com `--surface-2` / `--surface-active`) continuam opacos. Mudam só se o ui-designer apontar incoerência visual sobre vidro.
- **PA8** – Banners (`InlineAlert`), `EmptyState` e os cards de erro das rotas seguem a regra geral: vidro sobre o fundo, opacos dentro de overlays.
- **PA9** – A ordem de leitura e o texto do resumo não mudam. Só muda o contêiner e a visibilidade do título no mobile (B5).
- **PA10** – Navegadores sem `light-dark()` continuam fora do suporte (design system). O fallback opaco trata só da falta de `backdrop-filter`.

---

## 9. Testes existentes afetados

| Arquivo | Impacto |
|---|---|
| `web/lib/theme/tokens.spec.ts` | Lista de tokens com alfa ("`--header-bg`, `--scrim` e `--shadow-color` são os únicos") passa a incluir os tokens de vidro. `EXPECTED_VALUES` passa à rev. 7. "Nenhum token extra" e "todo token aparece em um par" passam a cobrir os novos tokens. `HEADER_UNDER` local e os `expected` dos pares da navbar (`[13.32, 11.17]` etc.) mudam com a nova opacidade. Novos pares de vidro compostos sobre as amostras do gradiente (amostrador próprio do teste). O invariante "alfa de `--header-bg` ≤ 0,95" continua válido. |
| `web/lib/theme/contrast-pairs.ts` | Novos pares para cada token de vidro com `over` = amostras do fundo (e conteúdo rolando, no vidro de barra). `HEADER_UNDER` inclui as superfícies de vidro. Descrições (`where`) separam "opaco (overlay)" de "vidro". |
| `web/lib/theme/page-background.spec.ts` | `.page-bg-window` continua opaca e sem `backdrop-filter` (teste existente segue válido). "`var(--bg)` só aparece em…" exige que o fallback opaco não use `var(--bg)`. Pode receber, ou ganhar um irmão com, os testes estáticos de vidro (`@supports`, `prefers-reduced-transparency`, `prefers-contrast`, `forced-colors`, ausência de animação). |
| `web/test/no-literal-colors.spec.ts` | Continua verde, sem exceções novas. |
| `web/e2e/support.ts` | `auditPageGradient` / `pageGradientFailures` estendidos para cadeias translúcidas (TQ2). `INCOMPLETE_ALLOWLIST` não cresce. |
| `web/e2e/contrast.ts` e `web/e2e/contrast.spec.ts` | Se o axe passar a devolver `incomplete` para textos sobre vidro, `incompleteVerdict` precisa resolvê-los pela composição sobre as amostras, mantendo o rigor atual: opacidade < 1 no texto e sobreposição real continuam reprovando. |
| `web/e2e/a11y.pw.ts` | Mesmas telas e estados nos dois temas, com a auditoria estendida. Novos estados: resumo em mês vazio (texto abaixo dos cards) e lista rolada sob a navbar. |
| `web/e2e/dark-theme.pw.ts` | `expectDark(".card")` passa a ler cores com alfa. O teste precisa considerar a composição, e não só os canais RGB. Drawer, campos no drawer, listbox, menu de mês, toast e tooltip continuam opacos e com as mesmas expectativas. |
| `web/e2e/theme.pw.ts` | `expectDialogTokens` (drawer = `--surface`, campo = `--input-bg`) continua válido por PA2. Novas verificações de troca no mesmo quadro para o vidro (CA11). |
| `web/e2e/theme-charts.pw.ts` | Lê `--surface` entre os tokens dos gráficos. Muda se os separadores ganharem token próprio (TQ8). |
| `web/e2e/page-background.pw.ts` | CA10/CA11 da spec anterior verificam que os cards "continuam com `--border` e `--shadow-card`" e precisam passar a refletir a borda de vidro. |
| `web/components/month-summary.spec.tsx` | Continua localizando a região pelo nome. Ganha casos para: ausência de card externo, título visível, aviso abaixo dos cards. |
| `web/app/(app)/dashboard/_components/dashboard-blocks.spec.tsx` | Continua verde (região "Resumo de novembro de 2026"). |
| `web/e2e/entries.pw.ts` | Compara `innerText` da região antes e depois. Com o título visível no mobile (B5) o texto muda, mas a comparação continua coerente. Conferir. |

---

## 10. Tarefas (ordenadas)

Todas `[web]`. Nenhuma tarefa `[api]` ou `[db]`.

1. **[web] T1 – Design (ui-designer).**
   - Definir os tokens de vidro (card, variante 2, campo, vidro de barra, borda de vidro, raio de desfoque) nos dois temas e confirmar a classificação do inventário (§1.2), incluindo os itens marcados com (*).
   - Definir o separador dos gráficos sobre vidro (R6) e o fallback opaco.
   - Desenhar o novo resumo (título, 3 cards, aviso) em mobile e desktop, e o skeleton correspondente.
   - Calcular as razões de pior caso.
   - Registrar tudo como rascunho da rev. 7 em `docs/design/design-system.md`.
2. **[web] T2 – Arquitetura (architect).**
   - Responder TQ1–TQ8.
   - Confirmar a causa do "card dentro de card" (TQ6, R8) e varrer usos equivalentes.
   - Mapear popovers dentro de superfícies de vidro (R3).
   - Registrar a decisão em um ADR (0004).
   - **Gate: aprovação do usuário** (respostas B1–B5 e visual da T1).
3. **[web] T3 – Testes (red) de tokens e contraste.** Atualizar `lib/theme/tokens.spec.ts` (alfa permitido, `EXPECTED_VALUES` rev. 7, pares de vidro sobre amostras, navbar com nova opacidade) e `lib/theme/contrast-pairs.ts`. Cobre CA06.
4. **[web] T4 – Testes (red) estáticos de CSS.**
   - Fallbacks (`@supports`, `prefers-reduced-transparency`, `prefers-contrast`, `forced-colors`).
   - Superfícies opacas sem `backdrop-filter` (drawer, modal, `.page-bg-window`, popovers, toast).
   - Ausência de animação no vidro.
   - Cobre CA05, CA08–CA10 e CA13 no nível estático.
5. **[web] T5 – Testes (red) do resumo.**
   - Unitário/componente de `MonthSummary` e `MonthSummarySkeleton`: sem card externo, título visível, aviso abaixo, região nomeada, `dl` preservada.
   - Ajuste de `dashboard-blocks.spec.tsx` se necessário.
   - Cobre CA15–CA18, CA20 e CA21 no nível de componente.
6. **[web] T6 – Testes (red) e2e.**
   - Estender `e2e/support.ts` (auditoria de pior caso para cadeias translúcidas) e `e2e/contrast.ts`.
   - Atualizar `a11y.pw.ts`, `dark-theme.pw.ts`, `theme.pw.ts`, `theme-charts.pw.ts` e `page-background.pw.ts`.
   - Novos cenários para CA01–CA05, CA07–CA13, CA15–CA17, CA19, CA20 e CA22.
7. **[web] T7 – Tokens de vidro** em `web/app/styles/tokens.css` (CA06, RF10).
8. **[web] T8 – Aplicação do vidro.**
   - Navbar, `.card` e superfícies equivalentes, campos sobre o fundo, barras sticky/fixas e separadores dos gráficos.
   - Fallbacks em um único ponto do CSS.
   - Correção da cascata do `.card`, se confirmada (CA01–CA05, CA08–CA13).
9. **[web] T9 – Novo layout do resumo.** `MonthSummary` sem card externo, com título visível, aviso abaixo e skeleton coerente, valendo para `/entries` e `/dashboard` (CA15–CA22).
10. **[web] T10 – Desempenho.** Medição Lighthouse e trace de rolagem conforme TQ5. Se reprovar, aplicar a alternativa da TQ3 e medir de novo. Registrar em `docs/runs/` (CA14).
11. **[web] T11 – Verificação final.** `npm test`, cobertura, lint, `tsc`, build e Playwright + axe nos dois temas, inclusive com transparência reduzida e alto contraste emulados.
12. **[web] T12 – Documentação.**
    - `docs/design/design-system.md` rev. 7: tokens, classificação, regras 3 e "Blur…" revistas, fallbacks, contraste e resumo.
    - Nota de revogação do B1 em `docs/specs/fundo-gradiente-temas.md` e no ADR 0003.
    - Entrada no `CHANGELOG.md`.
