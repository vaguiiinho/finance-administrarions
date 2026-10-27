# ADR 0003 - Fundo em gradiente nos temas claro e escuro

- **Nota (2026-10-27):** a premissa B1 deste ADR ("superfícies e navbar sem vidro") foi **revogada** pelo `docs/adr/0004-superficies-vidro-fosco.md`. O restante continua valendo.
- **Status:** **Aceito** em 2026-10-26. Presets escolhidos pelo usuário: **dark-5** (Grafite com brilho ciano) no tema escuro e **light-2** (Lavanda → azul-gelo) no tema claro. B1-B5 seguiram a resposta padrão da spec (§3). TQ1-TQ7 decididas pelo architect (§5); os desvios da implementação estão no §13.
- **Data:** 2026-10-26
- **Spec:** `docs/specs/fundo-gradiente-temas.md` (RF01-RF18, RNF01-RNF11, CA01-CA22, B1-B5, TQ1-TQ7, PA1-PA8)
- **Base:** `docs/adr/0001-lancamentos-financeiros.md` §9.5 (tokens de tema, `light-dark()`, `color-scheme`, cookie lido no servidor) e `docs/adr/0002-lancamentos-financeiros-fechamento.md` T2 (contraste computado e resolução de `incomplete` do axe). Onde este ADR contradiz o 0002 T2 sobre `incomplete`, vale o que está aqui (§5.5).
- **Escopo:** só `web/`. **Nenhuma** mudança em `api/`, contratos HTTP, Prisma, schema ou migrations.
- **Autor:** architect

---

## 1. Contexto

O fundo da página hoje é uma cor sólida (`--bg`) aplicada em `html` e `body`. O usuário quer um gradiente "futurista" nos dois temas (escuro não preto, claro não branco) e uma página temporária com sugestões para escolher antes da aplicação. A feature tem duas fases separadas por um gate de aprovação do usuário:

- **Fase A:** página `/background-preview` com 4-6 presets por tema, dados estáticos, amostra de UI real e indicador de contraste. Isolada e removível.
- **Fase B:** o preset escolhido de cada tema vira token em `tokens.css`, o gradiente é aplicado ao fundo da página, as faixas opacas são tratadas e a Fase A é apagada.

Pontos do código atual que condicionam as decisões (verificados no repositório):

1. `web/test/no-literal-colors.spec.ts` permite cor literal **só** em `app/styles/tokens.css` (constante única `TOKENS_FILE`) e varre `app/` e `components/` (arquivos `*.spec|test|pw.*` são ignorados).
2. `web/lib/theme/tokens.spec.ts` só entende `--x: light-dark(cor, cor);`, fixa valores exatos, proíbe tokens extras e restringe tokens com alfa a `--header-bg`, `--scrim`, `--shadow-color`. Declarações fora de `light-dark()` (como `--shadow-card`) são ignoradas pelo parser e validadas por teste estrutural próprio.
3. `ratioOf()` usa `--bg` como fundo padrão de composição, e `HEADER_UNDER = ["--bg", "--surface", "--surface-2", "--text"]` está **duplicado** em `tokens.spec.ts` e `contrast-pairs.ts`.
4. O Playwright roda contra **build de produção** (`next build && next start`, `playwright.config.ts`), não `next dev`.
5. `e2e/support.ts#audit` reprova qualquer `incomplete` de `color-contrast` cujo `messageKey` não seja `imgNode`/`elmPartiallyObscured*`. Um `background-image` em qualquer ancestral real de um texto gera `bgGradient` (axe-core 4.14, `axe.js` l. 22368) e **reprovaria todas as telas**.
6. O axe ignora pseudo-elementos que **não** têm `position: absolute` (`getPseudoElementArea`, `axe.js` l. 31674) e não os vê no empilhamento de fundo. Um `body::before` com `position: fixed` é invisível ao axe, que passa a medir contra a `background-color` do `body`.
7. `--bg` é usado como fundo opaco em `.segmented`, `.tablist` (mobile), `entries-tabs-bar.tsx` (`bg-bg`, sticky) e na segunda linha da navbar mobile em `app-header.tsx` (`bg-bg`, **não** sticky: rola com a página).
8. `e2e/theme.pw.ts`, `theme-charts.pw.ts` e `dark-theme.pw.ts` leem `getComputedStyle(body).backgroundColor` e comparam com `BG` (`e2e/support.ts`).
9. `global-error.tsx` substitui o layout raiz (tem `<html>`/`<body>` próprios) e importa `globals.css`.

---

## 2. Bounded context e linguagem ubíqua

**Bounded context:** *Apresentação / Design System* do `web` (tema visual). Não há regra de negócio nem dado persistido; o contexto financeiro (lançamentos, cartões, faturas) não é tocado. A linguagem ubíqua é a da spec §2, com estes acréscimos:

| Termo | Definição | Artefato |
|---|---|---|
| **Cor base do fundo** | Token `--bg`. Cor sólida opaca, dentro da faixa de luminância das paradas. Pinta `html`/`body` (`background-color`), aparece no overscroll e é o valor lido pelos testes de `background-color`. | `--bg` |
| **Parada linear** | Cor de uma parada do gradiente linear. | `--bg-stop-1..N` (N = 2 a 4) |
| **Brilho** | Cor no centro de um gradiente radial que esmaece até `transparent`. | `--bg-glow-1..M` (M = 0 a 2) |
| **Receita do gradiente** | Composição CSS (camadas, ângulo, posições) que usa só `var(--bg-stop-*)`, `var(--bg-glow-*)` e `transparent`. Não é cor; não entra em `light-dark()`. | `--bg-gradient` |
| **Camada de fundo** | Pseudo-elemento `body::before` fixo na viewport que pinta `--bg-gradient`. | `globals.css` |
| **Janela de fundo** | Elemento opaco (faixa sticky) que pinta o **mesmo** gradiente com `background-attachment: fixed`, alinhado à camada de fundo, para não parecer uma barra chapada. | classe `.page-bg-window` |
| **Conjunto do fundo da página** | `--bg` + todas as paradas + todos os brilhos. Todo par cujo fundo é `--bg` é verificado contra **amostras** desse conjunto (pior caso). | `PAGE_BACKGROUND_TOKENS` |
| **Amostras do gradiente** | Paradas, brilhos, interpolações sRGB entre paradas adjacentes (17 pontos por segmento) e cada brilho composto sobre cada amostra linear em 17 opacidades. Cobre o mínimo interior de luminância, que pode ficar abaixo das duas pontas no claro. | `sampleGradient()` |
| **Moldura de preset** | Contêiner da Fase A com `color-scheme` forçado e o gradiente do preset como fundo, que recebe a amostra de UI. | `PresetFrame` |
| **Conjunto da pré-visualização** | Tudo que a Fase A cria e a T11 apaga (§8.1). | — |

---

## 3. Premissas (respostas padrão adotadas para B1-B5; aprovadas na escolha dos presets)

| # | Premissa adotada | Consequência técnica |
|---|---|---|
| **B1** | O gradiente vale **só para o fundo da página**. Cards, drawer, modal, tooltip e inputs continuam opacos com os valores atuais. Navbar mantém `--header-bg` com alfa 0.95. Faixas opacas ganham tratamento coerente **sem vidro**. | Superfícies e `--header-bg` não mudam (PA1). Faixa sticky usa janela de fundo (§5.6). |
| **B2** | A escolha é informada **na conversa pelos ids** (ex.: "claro `light-3`, escuro `dark-1`"). A página não persiste nada e não altera as telas reais. | Nenhum cookie, localStorage, server action ou API na Fase A. |
| **B3** | Claro e escuro são escolhidos **de forma independente**. A página agrupa por família de cor só para orientar. | `Preset.family` é só rótulo de agrupamento; nenhuma validação de par. |
| **B4** | A página existe **só fora de produção** e é removida na mesma branch antes do merge em `main` (PA6). | Gate por ambiente com exceção explícita para o build do Playwright (§5.4). |
| **B5** | **Estático**: linear + até 2 brilhos radiais, sem animação. | Nenhuma `animation`/`transition` no fundo; CA19 verificado com as duas preferências de movimento. |

Se o usuário responder diferente em B1 ou B5, este ADR precisa de revisão (§5.6 e §5.3 mudam). B2-B4 mudam só a Fase A.

---

## 4. Modelo (equivalente de domínio para uma feature só de apresentação)

Não existe domínio no sentido da `api` (sem aggregates persistidos, repositórios, domain events, use cases de aplicação). Para manter a disciplina das camadas, o código da feature separa **modelo puro** (tipos e funções sem React, sem DOM, sem Next) de **apresentação** (componentes). O modelo puro não importa nada de framework.

### 4.1 Value objects

**`BackgroundPreset`** (Fase A, temporário, em `_preview/model.ts`):

```ts
export type PresetTheme = "light" | "dark";
export type PresetId = `${PresetTheme}-${1 | 2 | 3 | 4 | 5 | 6}`;

export interface LinearLayer {
  angleDeg: number;                       // 0..360
  stops: readonly { color: string; at?: number }[]; // 2..4 paradas, `at` em % (0..100), crescente
}
export interface GlowLayer {
  color: string;                          // opaca
  x: number; y: number;                   // posicao do centro em % da area
  radius: number;                         // % em que chega a transparent (20..80)
}
export interface BackgroundPreset {
  id: PresetId;
  theme: PresetTheme;                     // igual ao prefixo do id
  name: string;                           // pt-BR, ex.: "Indigo profundo"
  family: string;                         // agrupamento (B3), ex.: "indigo"
  base: string;                           // cor base (futuro --bg)
  linear: LinearLayer;
  glows: readonly GlowLayer[];            // 0..2
  /** Ajuste de token necessario para passar AA (RF06); ausente = nenhum */
  requiredAdjustments?: readonly { token: string; value: string; reason: string }[];
}
```

**Invariantes** (verificadas por `assertValidPreset()` e pelo teste de dados):

- I1. `id` único, segue `^(light|dark)-[1-6]$` e o prefixo é igual a `theme`.
- I2. 4 a 6 presets por tema.
- I3. 2 a 4 paradas lineares, posições crescentes; 0 a 2 brilhos.
- I4. Toda cor é **opaca** e em `#RRGGBB` (o literal fica só no módulo de dados; ver TQ1).
- I5. Escuro: toda parada, brilho e a base com luminância relativa >= 0,005 (não preto, RNF04) e < 0,25 (`dark-theme.pw.ts`).
- I6. Claro: nenhuma cor igual a `#FFFFFF`; luminância < a de `--surface` claro; croma `max(r,g,b) - min(r,g,b) >= 8` (matiz perceptível, RNF05). O ui-designer pode subir o limiar na T1.
- I7. `base` dentro de `[min, max]` da luminância das amostras do próprio preset.
- I8. Pior caso >= mínimo da categoria para **todos** os pares de `CONTRAST_PAIRS` cujo `bg` é `--bg` e para os pares de navbar (`--header-bg` composto sobre cada amostra), usando os valores **atuais** de `tokens.css` mais `requiredAdjustments`. Preset que falha não entra na lista (RF06).

**`PageBackground`** (Fase B, permanente, só como tokens): `--bg`, `--bg-stop-1..N`, `--bg-glow-1..M`, `--bg-gradient`. Invariantes I3-I8 passam a valer sobre os tokens, verificadas em `tokens.spec.ts` (§9.2).

**`PresetEvaluation`** (resultado puro): `{ token: string; worst: number; required: number; ok: boolean }[]`.

### 4.2 Entities, aggregates, domain events

Nenhum. Presets não têm ciclo de vida nem identidade mutável (o id é rótulo estável); não há eventos. Registrado para deixar explícito que a ausência é intencional.

### 4.3 "Repositórios" e ports

- **Sem repositório.** Os presets são uma constante de módulo (`PRESETS: readonly BackgroundPreset[]`).
- **Port `TokenColorResolver`** (DIP): o indicador de contraste não lê CSS diretamente; recebe uma função que resolve tokens para `Rgba` no contexto de tema da moldura. Em produção, implementação de navegador (sonda DOM); em teste, um mapa fixo.

```ts
/** Resolve tokens CSS para cor efetiva no contexto (tema) do elemento dado. */
export type TokenColorResolver = (tokens: readonly string[]) => Readonly<Record<string, Rgba>>;
```

- **Gate de ambiente** como função pura com o ambiente injetado (sem `process.env` dentro da regra):

```ts
export function isPreviewEnabled(env: { NODE_ENV?: string; BACKGROUND_PREVIEW?: string }): boolean;
```

### 4.4 Casos de uso (funções puras)

| Função | Entrada | Saída | Fase |
|---|---|---|---|
| `sampleGradient(stops, glows, steps = 16)` | `Rgba[]` lineares (>= 2), `Rgba[]` brilhos | `Rgba[]` amostras (pontas, interpolações sRGB, brilhos compostos via `composite` de `lib/theme/contrast.ts`) | A (em `_preview/`), **movida** para `lib/theme/gradient.ts` na B |
| `worstCaseRatio(fg, backgrounds)` | `Rgba`, `Rgba[]` | `number` (mínimo de `contrastRatio(composite(fg, bg), bg)`) | idem |
| `presetToCss(preset)` | `BackgroundPreset` | `{ backgroundColor: string; backgroundImage: string }` (camadas de brilho primeiro, linear por último) | A |
| `evaluatePreset(preset, tokens, pairs)` | preset, `Record<token, Rgba>`, pares `{fg, kind}` | `PresetEvaluation` | A |
| `presetsByTheme(theme)` | `PresetTheme` | presets agrupados por `family`, na ordem do id | A |
| `isPreviewEnabled(env)` | ambiente | `boolean` | A |

```ts
// lib/theme/gradient.ts (Fase B; mesma assinatura da Fase A)
export function sampleGradient(stops: readonly Rgba[], glows?: readonly Rgba[], steps?: number): Rgba[];
export function worstCaseRatio(fg: Rgba, backgrounds: readonly Rgba[]): number;
```

---

## 5. Decisões técnicas (TQ1-TQ7)

### 5.1 TQ1 - Cores literais dos presets na Fase A

**Decisão:** um **único** arquivo de dados `web/app/(app)/background-preview/_preview/presets.ts` concentra todos os literais (`#RRGGBB`). Nenhum outro arquivo da pré-visualização tem literal: componentes recebem cores só por props e montam o estilo com `presetToCss()` (`model.ts`, sem literais).

Mudança em `web/test/no-literal-colors.spec.ts` (fica permanente o **mecanismo**, sai na T11 só a **entrada**):

```ts
/** Arquivos autorizados a ter cor literal. tokens.css e permanente; qualquer outra entrada e TEMPORARIA e justificada. */
const ALLOWED_FILES: readonly { path: string; reason: string }[] = [
  { path: join("app", "styles", "tokens.css"), reason: "fonte unica de cores (RF27)" },
  // TEMPORARIO - remover junto com /background-preview (ADR 0003 T11)
  { path: join("app", "(app)", "background-preview", "_preview", "presets.ts"), reason: "presets da escolha do fundo" },
];
```

E dois testes novos no mesmo spec:
- toda entrada de `ALLOWED_FILES` aponta para arquivo existente (força a limpeza: apagar a rota sem apagar a entrada deixa o teste vermelho);
- toda entrada diferente de `tokens.css` tem `reason` não vazia.

**Por que dentro da rota e não em `lib/`:** `lib/` não é varrido pelo scanner, então colocar os presets ali "passaria" sem exceção, mas burlaria a regra em silêncio e espalharia o conjunto (RF09/CA09). A exceção explícita é auditável e autodestrutiva.

### 5.2 TQ2 - Representação do gradiente em tokens

**Decisão:** cada cor do gradiente vira um token de cor com `light-dark(claro, escuro)`; a receita vira um token **composto** declarado uma vez, fora de `light-dark()`, como `--shadow-card`.

Formato em `web/app/styles/tokens.css`. Os valores abaixo são os **reais** (claro = light-2, escuro = dark-5), idênticos aos de `tokens.css` e do design system rev. 6:

```css
  /* fundo da pagina (design rev. 6): cor base + paradas + brilhos; todos opacos */
  --bg: light-dark(#ECEEFC, #181E2A);
  --bg-stop-1: light-dark(#EEEEFE, #141A24);
  --bg-stop-2: light-dark(#E8F0FC, #181E2A);
  --bg-stop-3: light-dark(#F0ECFC, #12182A);
  --bg-glow-1: light-dark(#E4F0FE, #0C3044);
  --bg-glow-2: light-dark(#F4ECFE, #20244D);
  /* receita: so var() dos tokens acima + transparent; o tema resolve no elemento que usa (light-dark) */
  --bg-gradient:
    radial-gradient(circle at 12% 8%, var(--bg-glow-1), transparent 55%),
    radial-gradient(circle at 88% 92%, var(--bg-glow-2), transparent 50%),
    linear-gradient(160deg, var(--bg-stop-1), var(--bg-stop-2) 55%, var(--bg-stop-3));
```

- **Contagem fixa por tema:** os dois temas compartilham N e M (os tokens são `light-dark`). Se o preset claro escolhido tiver 2 paradas e o escuro 3, o ui-designer completa o claro repetindo uma cor (sem efeito visual) ou ajusta a receita. A receita (ângulo, posições, raios) também é única para os dois temas; se os presets escolhidos tiverem geometrias diferentes, a T7 unifica a geometria e o ui-designer confirma com o usuário antes da T9.
- **Por que funciona com tema forçado e troca instantânea:** custom properties não registradas guardam tokens sem resolver; `light-dark()` só é resolvido no elemento que usa a propriedade real (`background-image`), conforme o `color-scheme` dele. A troca de `data-theme` troca o gradiente no mesmo quadro (RF13/CA12), e `:root[data-theme-switching] *::before` já desliga transições.
- **`--bg` continua existindo** como cor base: `html`/`body` `background-color`, overscroll, `BG` dos testes, fallback se `--bg-gradient` falhar.
- **Descartado:** um token por tema com o gradiente inteiro (`--bg-gradient-light`/`-dark` + seletores por tema): duplica a receita e exige seletores `:root[data-theme]` + `@media (prefers-color-scheme)` (o mesmo padrão frágil do ícone sol/lua). A razão original "não funciona com `color-scheme` por seção (TQ7)" **não se confirmou**: na Fase A o `color-scheme` por seção não funcionou (ver adendo em §5.8), então esse argumento deixou de ser um motivo contra `--bg-gradient-light/-dark`. Os outros dois motivos (duplicação da receita e seletores de tema frágeis) continuam valendo, e a decisão de manter `--bg-gradient` único foi mantida. `@property` registrado como `<color>`: resolveria `light-dark()` na raiz e quebraria o tema por seção.

### 5.3 TQ3 - Fixo na viewport, em pseudo-elemento do `body`

**Decisão:** camada `body::before` com `position: fixed`, atrás do conteúdo, sem animação.

```css
html { background: var(--bg); }          /* inalterado: canvas e overscroll */
body {
  background-color: var(--bg);            /* inalterado: testes leem esta cor */
  isolation: isolate;                     /* contexto de empilhamento: o ::before (z -1) pinta acima do fundo do body e abaixo do conteudo */
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-color: var(--bg);
  background-image: var(--bg-gradient);
}
```

- **Fixo, não rolando:** sem emendas, repetição ou área sem gradiente em páginas longas (RF12/CA17), sem depender da altura do documento. O brilho fica sempre visível no mobile (RNF11), porque as posições são % da viewport.
- **Pseudo-elemento, não `background-attachment: fixed` no `body`:** `attachment: fixed` é ignorado no iOS Safari e força repaint em toda rolagem no Chrome; uma camada `position: fixed` é composta pela GPU e não repinta na rolagem (RNF07). Também cobre **todas** as rotas, `loading.tsx`, `error.tsx` e `global-error.tsx` sem tocar em marcação (RF11/CA18), porque `global-error.tsx` importa `globals.css`.
- **Pseudo-elemento, não `<div>` no layout:** um elemento real entra no empilhamento do axe e geraria `bgGradient` em todo texto sobre o fundo; também exigiria editar `layout.tsx` **e** `global-error.tsx`.
- **`inset: 0` (viewport atual):** alinha a camada com o referencial de `background-attachment: fixed` usado na janela de fundo (§5.6). Custo aceito: um repaint quando a barra de endereço do mobile recolhe.
- **Banding (R7):** mitigado por paradas próximas em luminância (faixa estreita) e pelos brilhos; textura de ruído raster está fora de escopo. O ui-designer valida em tela de 8 bits.
- **Consequência para o axe (fato 6 do §1):** o axe mede o texto sobre o fundo contra `--bg` (base), não contra o gradiente. A garantia de pior caso fica com (a) `tokens.spec.ts` e (b) a auditoria nova `auditPageGradient` no navegador (§5.5). Se uma versão futura do axe passar a ver o `::before`, o `audit()` falha alto com `bgGradient` (não passa em silêncio).

### 5.4 TQ4 - Local da rota e gate de ambiente

**Decisão:** `web/app/(app)/background-preview/page.tsx`, dentro do grupo `(app)` (navbar real e `NavProvider`, necessário para o componente `Tabs` real), **sem** entrada em `MainNav` nem link em lugar nenhum (RF07).

- **Gate (B4):** `page.tsx` (Server Component) chama `await connection()` (`next/server`) e, se `!isPreviewEnabled(process.env)`, `notFound()`. Regra: habilitada quando `NODE_ENV !== "production"` **ou** `BACKGROUND_PREVIEW === "1"`.
- **Por que a variável extra:** o Playwright roda contra `next build && next start` (produção); sem ela, CA01-CA08 seriam impossíveis de testar no e2e. `playwright.config.ts` ganha `BACKGROUND_PREVIEW: "1"` no `env` do `webServer` do web, com comentário `TEMPORARIO - ADR 0003 T11`. Essa linha faz parte do conjunto removido.
- `export const metadata = { title: "Escolha do fundo", robots: { index: false, follow: false } }`.
- Sem server actions, sem `fetch`, sem import de `@/lib/api` (CA02, verificado por teste de isolamento).

### 5.5 TQ5 - Suítes de contraste com o fundo em gradiente

**Camada 1 (`tokens.spec.ts` + `contrast-pairs.ts`):**

- `contrast-pairs.ts` exporta a lista do conjunto do fundo e passa a derivar `HEADER_UNDER` dela (remove a duplicação interna do `--bg`):

```ts
/** Tokens que compoem o fundo da pagina (design rev. 6). Pares com bg "--bg" valem contra as amostras de todos eles. */
export const PAGE_BACKGROUND_TOKENS = ["--bg", "--bg-stop-1", "--bg-stop-2", "--bg-stop-3", "--bg-glow-1", "--bg-glow-2"] as const;
const HEADER_UNDER = [...PAGE_BACKGROUND_TOKENS, "--surface", "--surface-2", "--text"] as const;
```

- `tokens.spec.ts` (o teste continua **independente** da implementação):
  - deriva o conjunto do próprio `tokens.css` (regex `--bg-stop-\d+` e `--bg-glow-\d+`) e exige igualdade com `PAGE_BACKGROUND_TOKENS`;
  - `ratioOf()`: quando `bg === "--bg"`, devolve o **mínimo** sobre `sampleGradient(paradas, brilhos)` acrescido de `--bg`; quando `over` contém `--bg`, ele é expandido para as amostras (navbar composta sobre cada amostra). Os pares em `REQUIRED`/`CONTRAST_PAIRS` continuam escritos como `bg: "--bg"`; a semântica "pior caso do fundo" fica no cálculo, sem duplicar 11 pares por parada;
  - `HEADER_UNDER` do teste passa a incluir as amostras do fundo;
  - novos testes: "escuro não preto" (toda cor do conjunto no escuro com luminância em `[0,005; 0,25)`), "claro não branco" (I6), "base dentro da faixa" (I7), estrutura de `--bg-gradient` (declarado uma vez, fora de `light-dark()`, só `var(--bg-stop-*|--bg-glow-*)` e `transparent`, referencia **todos** os tokens de parada/brilho declarados, sem cor literal);
  - "todo token aparece em um par": paradas e brilhos contam como cobertos pelos pares de `--bg`;
  - `EXPECTED_VALUES` passa a "design rev. 6"; os `expected` dos pares com `--bg` são recalculados pelo ui-designer (T7) no pior caso. Nenhum mínimo de categoria é afrouxado;
  - a lista de tokens com alfa **não muda** (paradas e brilhos são opacos).

**Camada 2 (navegador, `e2e/`):**

- `e2e/contrast.ts` ganha a resolução de **gradiente declarado**, sem abrir `bgGradient`/`bgImage` em geral:

```ts
export interface GradientRegion {
  /** Seletor do elemento que pinta o gradiente (ex.: ".page-bg-window", "[data-preview-frame]") */
  selector: string;
  /** Tokens das cores do gradiente; ausente = ler o atributo `data-gradient-tokens` do elemento */
  tokens?: readonly string[];
}
export interface TextContrastResult { /* campos atuais + */ gradientRegion: boolean; worstOverGradient?: number }
export function incompleteVerdict(messageKey: string | undefined, result: TextContrastResult): string | null;
export async function textContrastOf(locator: Locator, overlays?: readonly string[], gradients?: readonly GradientRegion[]): Promise<TextContrastResult>;
/** Texto cujo fundo, subindo a cadeia ate o body, e todo transparente: pior caso contra as amostras do fundo da pagina */
export async function pageGradientFailures(page: Page, tokens: readonly string[]): Promise<string[]>;
```

  - `bgGradient`/`bgImage` passam a ser resolvíveis **somente** se o primeiro `background-image` da cadeia pertence a uma `GradientRegion` declarada; o veredito usa `worstOverGradient` (amostras das cores resolvidas por sonda dentro da região, no tema dela) contra 4,5/3. Opacidade < 1 e sobreposição real continuam reprovando. Qualquer outro `background-image` continua falhando.
  - `audit(page, label, { overlays, gradients })` repassa as regiões. A allowlist da navbar **não cresce**.
  - `auditPageGradient(page, label)` (novo, em `support.ts`): roda `pageGradientFailures` com `PAGE_BACKGROUND_TOKENS` e espera `[]`. Cobre o ponto cego do axe (§5.3).
- `support.ts#BG` passa a refletir o novo `--bg` (se a T7 mudar a base).

### 5.6 Faixas opacas (RF14, R4, CA16)

| Elemento | Hoje | Decisão |
|---|---|---|
| `entries-tabs-bar.tsx` (sticky, conteúdo passa por baixo) | `bg-bg` | Classe **`.page-bg-window`**: `background-color: var(--bg); background-image: var(--bg-gradient); background-attachment: fixed;`. Mostra exatamente o trecho do gradiente que a camada fixa teria ali (mesma receita, mesmo referencial de viewport), então não há barra chapada, e esconde o conteúdo que rola por baixo. Mantém `border-b border-border`. |
| `app-header.tsx`, 2ª linha mobile (rola com a página, nada passa por baixo) | `bg-bg` | **Sem fundo** (`bg-bg` removido). O fundo visível é a camada fixa. Mantém `border-b`. |
| `.segmented` (`globals.css`) | `background: var(--bg)` | `background: transparent`. Fica sobre o gradiente (ou sobre `--surface` no drawer); contorno `--border-strong` e texto já cobertos pelos pares de `--bg` (pior caso) e de `--surface`. |
| `.tablist` mobile (`globals.css`) | `background: var(--bg)` | `background: transparent` (no `md+` já é). Fica dentro da janela de fundo. |

- **Custo aceito:** `background-attachment: fixed` em uma faixa de 52-56 px repinta só a faixa na rolagem (barato). No iOS, onde `fixed` é tratado como `scroll`, a faixa mostra o gradiente relativo a ela própria: pequena diferença de tom, sem barra sólida. Registrado como limitação conhecida no design rev. 6.
- **Descartados:** vidro (`--header-bg` + blur) na faixa (contraria B1); faixa transparente (conteúdo ilegível sob a faixa sticky); token novo `--strip-bg` sólido (continua sendo barra chapada, contraria RF14).
- Regressão travada por teste estático: nenhum arquivo em `app/` e `components/` usa `bg-bg`, e `.segmented`/`.tablist` não usam `var(--bg)` (§9.2).

### 5.7 TQ6 - Desempenho

**Decisão:** Lighthouse **mobile** (preset padrão, throttling simulado) em `/entries?month=2026-11` contra `next start` + stub, cenário `default`, **3 execuções, mediana**, antes (commit base `7959f12`) e depois. Critério: queda de no máximo **5 pontos** e CLS sem aumento (delta <= 0,01). Complemento: trace de Performance do Chrome rolando a lista do cenário `many`, sem "Paint" por quadro na camada de fundo. Execução manual com `npx lighthouse` (sem nova dependência), resultado em `docs/runs/`. Não entra em CI (coerente com 0002 T3).

### 5.8 TQ7 - Tema forçado por seção na pré-visualização

**Decisão:** cada moldura tem `color-scheme` próprio com os utilitários do Tailwind 4.3 (`scheme-dark` / `scheme-light`), sem tocar em `data-theme` da raiz. Como os tokens usam `light-dark()` resolvido no elemento que os usa, toda a amostra dentro da moldura assume o tema dela.

Cuidados obrigatórios (causa comum de bug):
- `color` é herdado já **resolvido** do `body` (tema da raiz). A moldura precisa declarar `text-text` (`color: var(--text)`) para o texto herdado seguir o tema da moldura.
- A moldura não pode depender de seletores `:root[data-theme=...]` (só o ícone sol/lua usa; ele não entra na amostra).
- Atributos na moldura: `data-preview-frame`, `data-preset-id="<id>"`, `data-theme-context="light|dark"` e `data-gradient-tokens` (para o `audit`, §5.5). As cores do preset entram como custom properties inline (`--pv-stop-1`, `--pv-glow-1`, `--pv-base`), e o fundo da moldura é montado a partir delas por `presetToCss()`. O valor vem do módulo de dados em tempo de execução; o fonte TSX não tem literal.
- Molduras com proporção próxima de 16:10 e altura mínima de 420 px. Trade-off: as posições em % dos brilhos são relativas à moldura, não à viewport, então a aparência final em tela cheia pode variar levemente. Mitigação: a T7 confirma a aparência real nas telas antes da T11 (rodada de ajuste prevista em B2).

**Adendo (Fase A, resultado real do TQ7):** a premissa desta seção **não se confirmou**. `scheme-dark`/`scheme-light` por moldura não trocaram o tema da amostra, porque o Lightning CSS do Tailwind 4 transpila `light-dark()` para `var(--lightningcss-light, ...) var(--lightningcss-dark, ...)`, e essas variáveis são resolvidas **no `:root`** (onde está o `color-scheme` da raiz), não no elemento que usa o token. O `color-scheme` de uma seção interna não as altera. Solução usada na Fase A: o módulo `_preview/theme-scope.ts`, que gerava um `<style>` com os tokens **já resolvidos** para o tema de cada moldura (escopo por seletor da moldura). A Fase A inteira foi removida na T11; o mecanismo não existe mais no código. Consequência para a produção: nenhuma. O tema efetivo continua vindo só do `color-scheme` da raiz (sistema ou `data-theme`), e o `light-dark()` dos tokens funciona como no restante do design system. Consequência para o §5.2: o argumento "quebra o `color-scheme` por seção" saiu da lista de motivos (§5.2 e §11).

---

## 6. Endpoints e impacto no Next.js

- **API/HTTP:** nenhum endpoint novo ou alterado. Nenhum DTO.
- **Server actions:** nenhuma.
- **Páginas:**
  - Fase A: `/background-preview` (Server Component, dinâmico por `connection()` e pelo layout `(app)` que lê cookie). Estrutura: aviso de página temporária no topo (RF08, `role="note"`), `h1` "Escolha do fundo", `h2` "Tema escuro" e "Tema claro", `h3` por preset com id, nome e paradas (RF02), molduras agrupadas por família (B3). Componente cliente só no indicador de contraste.
  - Fase B: nenhuma página nova. Mudança visual global por CSS (`globals.css`, `tokens.css`) e duas classes trocadas em `entries-tabs-bar.tsx` e `app-header.tsx`.
- **Erros:** fora de dev (sem a variável) a rota responde com a 404 padrão (`notFound()`). Depois da T11 a rota não existe (CA21).

---

## 7. Prisma, schema e migrations

Nenhuma mudança. A feature é só `[web]` (spec §6).

---

## 8. Arquivos por fase

### 8.1 Fase A (T2-T5) - conjunto da pré-visualização

Criar (todos sob `web/app/(app)/background-preview/`, exceto onde indicado):

| Arquivo | Conteúdo |
|---|---|
| `page.tsx` | Gate (`connection()` + `isPreviewEnabled` + `notFound()`), `metadata`, aviso, seções por tema. |
| `_preview/model.ts` | Tipos do §4.1, `assertValidPreset`, `presetToCss`, `presetsByTheme`. Sem literais. |
| `_preview/presets.ts` | **Único** arquivo com literais: `PRESETS` (4-6 por tema, da T1). |
| `_preview/gradient-samples.ts` | `sampleGradient`, `worstCaseRatio` (usa `lib/theme/contrast.ts`). Movido para `lib/theme/gradient.ts` na T9. |
| `_preview/evaluate.ts` | `evaluatePreset`, constante dos pares avaliados (derivada de `CONTRAST_PAIRS` com `bg === "--bg"` e dos pares de `--header-bg`). |
| `_preview/enabled.ts` | `isPreviewEnabled(env)`. |
| `_preview/preset-frame.tsx` | Moldura (`scheme-*`, `text-text`, atributos `data-*`, custom properties do preset). |
| `_preview/sample-ui.tsx` | Amostra com componentes e classes reais: título, parágrafo, texto secundário, link, `.card` com `<Money value="1234.56" />`, badge (`components/ui/status.tsx`), `.btn.btn-primary`, `.btn`, `.field` com `<label>`, `.chip`, `Tabs` real com `idPrefix` por preset e `tabpanel` correspondente a cada aba (ARIA válido no axe completo). |
| `_preview/contrast-badge.tsx` | `"use client"`. Resolve `--text`, `--text-muted`, `--accent` por sonda dentro da moldura (implementa `TokenColorResolver`) e mostra "AA ok" / "abaixo de AA" com a razão. Antes da hidratação mostra "calculando…". |
| `_preview/*.spec.ts(x)` | Testes do §9.1 (incluindo o de isolamento). |
| `web/e2e/background-preview.pw.ts` | CA01-CA08 no navegador. |

Alterar:

| Arquivo | Mudança |
|---|---|
| `web/test/no-literal-colors.spec.ts` | `TOKENS_FILE` vira `ALLOWED_FILES` + 2 testes (§5.1). Entrada temporária de `presets.ts`. |
| `web/playwright.config.ts` | `BACKGROUND_PREVIEW: "1"` no `env` do web (temporário). |
| `web/e2e/contrast.ts`, `web/e2e/support.ts`, `web/e2e/contrast.spec.ts` | `GradientRegion`, extensão de `incompleteVerdict`/`textContrastOf`/`audit` (§5.5). **Permanente**: a Fase B usa o mesmo mecanismo. |

**Conjunto removido na T11** (CA09 interpretado assim: rota + módulo de dados + o e2e próprio + as duas linhas temporárias): `web/app/(app)/background-preview/` inteiro, `web/e2e/background-preview.pw.ts`, a entrada temporária de `ALLOWED_FILES` e a linha `BACKGROUND_PREVIEW` do `playwright.config.ts`. Nenhum componente de produção é editado na Fase A.

### 8.2 Fase B (T8-T11)

| Arquivo | Mudança |
|---|---|
| `web/app/styles/tokens.css` | `--bg` (possível novo valor), `--bg-stop-1..N`, `--bg-glow-1..M`, `--bg-gradient` (§5.2). |
| `web/app/globals.css` | `body { isolation: isolate }`, `body::before` (§5.3); `.page-bg-window` (§5.6); `.segmented` e `.tablist` com `background: transparent`. |
| `web/app/(app)/entries/_components/entries-tabs-bar.tsx` | `bg-bg` -> `page-bg-window`; atualizar o comentário ("fundo opaco `--bg`"). |
| `web/components/app-header.tsx` | Remover `bg-bg` da 2ª linha mobile. |
| `web/lib/theme/gradient.ts` + `gradient.spec.ts` | **Movidos** de `_preview/gradient-samples.ts` (com os testes) antes da T11. |
| `web/lib/theme/contrast-pairs.ts` | `PAGE_BACKGROUND_TOKENS`; `HEADER_UNDER` derivado; descrições (`where`) dos pares com `--bg` mencionam "pior caso do gradiente". |
| `web/lib/theme/tokens.spec.ts` | §5.5 camada 1. |
| `web/lib/theme/page-background.spec.ts` (novo) | Testes estáticos de CSS (§9.2). |
| `web/e2e/support.ts` | `BG` novo (se mudar), `auditPageGradient`. |
| `web/e2e/a11y.pw.ts` | `auditPageGradient` em cada tela x tema; `gradients: [{ selector: ".page-bg-window", tokens: PAGE_BACKGROUND_TOKENS }]` no `audit` de `/entries`. |
| `web/e2e/theme.pw.ts` | Primeiro quadro e troca: além de `background-color`, `getComputedStyle(body, "::before").backgroundImage` muda no mesmo quadro. |
| `web/e2e/dark-theme.pw.ts` | Cores resolvidas do conjunto do fundo com luminância em `[0,005; 0,25)`. |
| `web/e2e/page-background.pw.ts` (novo) | CA10-CA13, CA16-CA19. |
| `docs/design/design-system.md` (rev. 6), `CHANGELOG.md`, `docs/runs/` | T13. |

T11 (remoção): apagar o conjunto do §8.1 e rodar `rg -n "background-preview|\b(light|dark)-[1-6]\b|BACKGROUND_PREVIEW" web --glob '!node_modules' --glob '!.next'`, que deve voltar vazio (CA22). O mecanismo `ALLOWED_FILES` permanece só com `tokens.css`. Não se escreve um teste permanente com essa busca, porque o próprio teste conteria as strings proibidas. **(Desvio, ver §13.1: foi escrito, sim, um teste permanente.)**

---

## 9. Plano de testes por camada

Ordem: tester escreve red antes de cada fase (T2, T8). Cobertura >= 80% nos arquivos novos de `lib/`. Os `_preview/` ficam fora do `coverage.include` atual (`app/**/_components/**`); a cobertura deles é exigida no próprio PR da Fase A (`--coverage.include` pontual) e eles somem na T11.

### 9.1 Fase A

**Unitários (Vitest, node, sem I/O exceto leitura de `tokens.css`):**
- `presets.spec.ts`: I1-I7 para cada preset; 4-6 por tema; ids estáveis e únicos; `family` não vazia. I8: lê `tokens.css` com regex mínima local (sem importar o parser de `tokens.spec.ts`) e, para cada preset, exige pior caso >= mínimo em todos os pares de `--bg` e de `--header-bg` (aplicando `requiredAdjustments`).
- `gradient-samples.spec.ts`: pontas incluídas; interpolação em t = 0,5 é a média sRGB; brilho composto com alfa 0 e 1 devolve a amostra e o brilho; caso com mínimo interior de luminância abaixo das pontas (prova que só as paradas não bastam); `worstCaseRatio` igual ao mínimo calculado à mão.
- `evaluate.spec.ts`: `evaluatePreset` com mapa de tokens fixo; rótulo `ok` no limite exato (4,5 passa; 4,49 falha).
- `model.spec.ts`: `presetToCss` gera camadas na ordem brilhos -> linear, com `transparent` e posições; `assertValidPreset` rejeita cada violação de I1-I7.
- `enabled.spec.ts`: matriz `NODE_ENV` x `BACKGROUND_PREVIEW`.
- `isolation.spec.ts`: varre `app/`, `components/` e `lib/` fora de `background-preview/` e falha se algum arquivo importa `background-preview` ou `_preview` (CA09); varre `_preview/` e `page.tsx` e falha com import de `@/lib/api`, `fetch(`, `cookies(`/`localStorage` (CA02, B2); `presets.ts` é o único arquivo do conjunto com literal (roda `findColorLiterals` exportado do scanner).
- `test/no-literal-colors.spec.ts`: entradas de `ALLOWED_FILES` existem e têm motivo.

**Componente (Vitest + Testing Library, jsdom):**
- `page.spec.tsx`: com gate desligado chama `notFound` (mock de `next/navigation`); ligado renderiza aviso (CA07), duas seções com 4-6 molduras cada, id/nome/paradas (CA01), amostra completa por moldura (CA03), molduras com `scheme-dark`/`scheme-light` e `text-text` conforme o tema do preset (CA04 estrutural).
- `contrast-badge.spec.tsx`: com `TokenColorResolver` falso, mostra os três tokens com "AA ok"/"abaixo de AA" em texto (não só cor) e a razão; estado "calculando…" antes do efeito.

**E2E (Playwright, build de produção com `BACKGROUND_PREVIEW=1`, stub):**
- `background-preview.pw.ts`:
  - CA01, CA03, CA07 por papel/nome;
  - CA02: `setScenario("error500")` e a página carrega sem banner de erro; nenhuma requisição do navegador para `/api`;
  - CA04: com cookie `light` e depois `dark`, o fundo do `.card` de molduras escuras tem luminância < 0,25 e o das claras > 0,5, e a cor do texto segue o tema da moldura;
  - CA05: depois da hidratação, todo badge exibe "AA ok" para os três tokens;
  - CA06: em `/entries`, `/cards` e `/dashboard`, `a[href*="background-preview"]` tem contagem 0;
  - CA08: axe completo (`wcag2a/aa/21a/21aa`, todas as regras, não só `color-contrast`) nos dois temas, com `gradients: [{ selector: "[data-preview-frame]" }]`.

### 9.2 Fase B

**Unitários:**
- `lib/theme/tokens.spec.ts`: §5.5 camada 1, novos `EXPECTED_VALUES` e `expected` da rev. 6.
- `lib/theme/gradient.spec.ts`: os testes movidos.
- `lib/theme/page-background.spec.ts` (estático, lê `globals.css` e varre `app/`/`components/`): `body::before` com `position: fixed`, `inset: 0`, `z-index: -1`, `pointer-events: none`, `background-image: var(--bg-gradient)` e **sem** `animation`/`transition` (CA19); `body` com `isolation: isolate` e `background-color: var(--bg)`; `.page-bg-window` com `background-attachment: fixed` e `var(--bg-gradient)`; `.segmented`/`.tablist` sem `var(--bg)`; nenhum `bg-bg` em `app/`/`components/`.
- `e2e/contrast.spec.ts`: `incompleteVerdict` resolve `bgGradient`/`bgImage` só com `gradientRegion: true` e `worstOverGradient` >= mínimo; reprova `bgGradient` fora de região, região com pior caso abaixo do mínimo, opacidade < 1 e sobreposição real; mantém os casos atuais.
- `test/no-literal-colors.spec.ts`: verde **sem** exceção da feature (CA20).

**E2E:**
- `page-background.pw.ts`:
  - CA10/CA11: em `/entries`, `/cards` e `/dashboard`, nos dois temas, `::before` do `body` tem `background-image` com `gradient`, e as cores resolvidas de `PAGE_BACKGROUND_TOKENS` batem com a rev. 6 (nenhuma preta no escuro, nenhuma `rgb(255, 255, 255)` no claro); cards continuam com `--border` e `--shadow-card`;
  - CA12: troca pelo botão; o `background-image` do `::before` e o `background-color` do `body` mudam no mesmo quadro (mesmo padrão de `theme.pw.ts`); recarregar mantém;
  - CA13: `page.emulateMedia({ colorScheme })` sem cookie troca ao vivo;
  - CA16: viewport 360x640 e 1280x800, `/entries` rolada; a faixa usa `.page-bg-window` (`background-attachment: fixed`, mesmo `background-image` do `::before`); a 2ª linha mobile tem fundo transparente; `audit` com a região da faixa sem falhas;
  - CA17: cenário `many`, viewport 360x640, rolar até o fim; `::before` continua `position: fixed` com retângulo igual à viewport, e `elementsFromPoint` no rodapé da viewport não encontra área sem a camada (fundo do `body` coberto);
  - CA18: `delayMs` no stub para `loading.tsx` e `error500` para `error.tsx`, com o mesmo `::before`. `global-error.tsx` coberto pelo teste estático (importa `globals.css`, que define o `::before`), porque forçar erro no layout raiz em produção não é determinístico;
  - CA19: com `reducedMotion: "reduce"` e `"no-preference"`, `animationName` do `::before` é `none`.
- `a11y.pw.ts`: telas e estados atuais nos dois temas + `auditPageGradient` (CA14/CA15 no navegador).
- `dark-theme.pw.ts` e `theme*.pw.ts`: §8.2.
- **Desempenho:** §5.7, manual, registrado em `docs/runs/`.

---

## 10. Violações de SOLID no código atual que afetam a feature

1. **SRP no token `--bg`:** o mesmo token é "fundo da página" e "fundo de faixa/controle opaco" (`.segmented`, `.tablist`, faixa de abas, 2ª linha mobile). Trocar o fundo para gradiente obriga a separar os papéis. Correção: §5.6 (janela de fundo e `transparent`), travada por teste estático.
2. **DRY/OCP em `HEADER_UNDER`:** a lista está duplicada em `tokens.spec.ts` e `contrast-pairs.ts`, e `ratioOf()` tem `["--bg"]` fixo como fundo padrão. Incluir as paradas exigiria editar três pontos. Correção: `PAGE_BACKGROUND_TOKENS` exportado e `HEADER_UNDER` derivado em `contrast-pairs.ts`. No teste, a lista é derivada de `tokens.css` e comparada com a exportada, o que preserva a independência do teste.
3. **OCP em `no-literal-colors.spec.ts`:** a única exceção é uma constante (`TOKENS_FILE`) usada direto no filtro; qualquer exceção exige reescrever o filtro. Correção: `ALLOWED_FILES` com motivo e verificação de existência (§5.1).
4. **OCP em `e2e/contrast.ts#incompleteVerdict`:** a lista fechada `RESOLVABLE_MESSAGE_KEYS` mistura política e cálculo; abrir `bgGradient` "na mão" liberaria qualquer gradiente. Correção: resolução condicionada a `GradientRegion` declarada pela tela, como já é feito com `overlays` (§5.5).
5. **Decisão de apresentação espalhada (SRP/DRY):** `entries-tabs-bar.tsx` e `app-header.tsx` codificam o fundo da faixa como utilitário (`bg-bg`) no JSX. Correção: classe semântica `.page-bg-window` em `globals.css`, dona da regra.
6. **Valores de token duplicados nos testes e2e:** `support.ts#BG` repete o valor de `--bg` em `rgb()`. É aceitável (o e2e verifica o valor final), mas precisa ser atualizado na T8 junto com `EXPECTED_VALUES`. Registrado para não virar falha "misteriosa".

---

## 11. Alternativas descartadas e trade-offs

| Alternativa | Motivo do descarte |
|---|---|
| Gradiente em `background-image` do `body` com `attachment: fixed` | iOS ignora `fixed`; repaint a cada rolagem no Chrome; axe veria `bgGradient` em toda tela. |
| `<div>` de fundo no layout raiz | Entra no empilhamento do axe; exige editar `layout.tsx` e `global-error.tsx`. |
| Gradiente rolando com o conteúdo | Emendas/esticamento em páginas longas (CA17); aparência muda com a altura da página. |
| Token único com o gradiente por tema (`--bg-gradient-dark`) | Duplica a receita e depende de seletores de tema. (A razão "quebra o `color-scheme` por seção" foi retirada: a premissa não se confirmou, ver §5.8.) |
| Presets em `lib/` para escapar do scanner | Burla RF27 em silêncio e quebra o isolamento. |
| Indicador de contraste calculado no servidor lendo `tokens.css` | Exigiria um segundo parser de `light-dark()` em produção (o atual é do teste, por decisão do 0001 §9.5) e acesso a arquivo em tempo de execução. A sonda no navegador mede o valor real. |
| Página sempre acessível com flag em runtime em `main` | Contraria B4/PA6 (risco R6). |
| Afrouxar `incompleteVerdict` para aceitar `bgGradient` | Perderia a garantia do 0002 T2; a região declarada mantém o rigor. |

Trade-offs aceitos:
- O axe mede o texto sobre o fundo contra a cor base; o pior caso real depende de `tokens.spec.ts` e de `auditPageGradient` (mais código de teste próprio).
- `background-attachment: fixed` na faixa sticky: repaint localizado; no iOS, tom levemente diferente na faixa.
- A moldura da Fase A não é a viewport; a aparência final pode variar levemente (mitigado pela rodada de ajuste).
- A geometria da receita é única para os dois temas (limitação de `light-dark()` só para cores).

---

## 12. Riscos remanescentes

- **R1 (contraste):** se um preset escolhido exigir ajuste de `--text-muted`/`--accent`, isso muda pares em superfícies também. O `requiredAdjustments` torna o custo visível na Fase A, e a T7 registra no design rev. 6 (PA1).
- **Dependência de comportamento do axe** (`position: absolute` em `getPseudoElementArea`): se mudar, o `audit()` falha alto, e a correção é declarar a região do `body` em `gradients`.
- **`isolation: isolate` no `body`:** não muda a ordem relativa de `header` (z-40), faixa (z-30), toasts e `dialog` (top layer). O e2e atual de drawer/modal/toast cobre regressões.
- **Amostragem dos brilhos em `lib/theme/gradient.ts`:** ver §13.4.

---

## 13. Desvios da implementação em relação a este ADR

Registro do que o código final faz de diferente do que o ADR planejava. Escrito a partir do código em `web/`, não do plano.

### 13.1 Teste permanente de remoção (desvio do §8.2 / T11)

O §8.2 dizia para **não** escrever um teste permanente com a busca de resíduos. Foi escrito: `web/test/background-preview-removed.spec.ts`. Ele verifica que a rota `(app)/<preview>/` e o e2e próprio não existem, que `playwright.config.ts` não habilita a rota, que `no-literal-colors.spec.ts` não tem exceção para os presets e que nenhum arquivo de `web/` cita a rota, a variável de ambiente temporária ou um id de preset. Para o teste não ser resíduo do que ele procura, os padrões são **montados em tempo de execução** (`["background", "preview"].join("-")` etc.). `package-lock.json` é excluído da varredura (junto com `node_modules`, `.next`, `coverage`, `playwright-report`, `test-results`), porque a dependência `decimal.js-light` casa com o padrão de id de preset.

### 13.2 Onde ficaram `pageGradientFailures` e `auditPageGradient`

O §5.5 previa `pageGradientFailures` em `e2e/contrast.ts` e `auditPageGradient` em `e2e/support.ts`. Ficaram **as duas em `web/e2e/support.ts`**. `contrast.ts` continua com `GradientRegion`, `incompleteVerdict` e `textContrastOf`. `support.ts` também exporta `PAGE_BG_TOKENS` (alias de `PAGE_BACKGROUND_TOKENS`) e `PAGE_BG_REGION` (`{ selector: ".page-bg-window", tokens }`), usados em `a11y.pw.ts` e `page-background.pw.ts`. A auditoria só mede texto cuja cadeia de ancestrais até o `body` (exclusive) é transparente e sem `background-image`; os demais textos ficam com o axe.

### 13.3 Valores reais e presets

Claro = light-2 (Lavanda → azul-gelo), escuro = dark-5 (Grafite com brilho ciano). Valores em §5.2 e no design system rev. 6. Os dois presets têm 3 paradas e 2 brilhos, então a receita única do §5.2 coube sem ajuste. Nenhum `requiredAdjustments` foi necessário: `--surface*`, textos e `--accent` mantêm os valores da rev. 5. `--chart-cursor` (claro, `#EEF1F5`) e `--input-bg` (escuro, `#151B26`) também mantêm os valores da rev. 5 e deixaram de ser "iguais ao `--bg`".

### 13.4 Amostrador de brilhos (correção da revisão)

A revisão apontou que os dois brilhos **se sobrepõem** na viewport (centros em 12% 8% e 88% 92%, alcances de 55% e 50% do raio até o canto mais distante: a soma dos alcances supera a distância entre os centros; ~12% da viewport em 1280x800, alfa combinado até ~0,17). Por isso o pior caso também compõe um brilho sobre o outro:

- `web/lib/theme/gradient.ts#sampleGradient` (usado por `e2e/support.ts` e `e2e/contrast.ts`): além de cada brilho sobre cada amostra linear, compõe cada par de brilhos (o de índice maior por cima) em todas as combinações de opacidade. `samplesFromTokenColors` ordena paradas e brilhos pelo sufixo numérico, e `worstCaseRatio`/`worstOverRegion` lançam erro com lista de amostras vazia (falha fechada).
- `web/lib/theme/tokens.spec.ts` mantém um amostrador **próprio**, independente da implementação, com a mesma composição dupla (oráculo do CA14).
- Com os tokens atuais, o pior caso de nenhum par muda com a composição dupla (verificado numericamente na revisão).

### 13.5 O que se manteve como no ADR

`body::before` fixo com `isolation: isolate` no `body` (§5.3); `.page-bg-window` na faixa de abas e 2ª linha mobile sem fundo (§5.6); `.segmented` e `.tablist` com `background: transparent`; `PAGE_BACKGROUND_TOKENS` e `HEADER_UNDER` derivado em `contrast-pairs.ts` (§5.5); `--bg-gradient` declarado uma vez fora de `light-dark()` (§5.2). Nenhuma mudança em `api/`, Prisma ou contratos HTTP.
