# Design: Fundo em gradiente nos temas claro e escuro

- **Spec:** `docs/specs/fundo-gradiente-temas.md` (RF01-RF18, RNF01-RNF11, CA01-CA22, B1-B5, TQ1-TQ7, PA1-PA8)
- **ADR:** `docs/adr/0003-fundo-gradiente-temas.md` (receita única do gradiente §5.2, camada `body::before` §5.3, gate §5.4, suítes de contraste §5.5, faixas opacas §5.6, moldura com `color-scheme` próprio §5.8)
- **Design system:** `docs/design/design-system.md` (rev. 5, paleta suavizada); contrastes de referência em `docs/design/lancamentos-financeiros.md` §1.9
- **Tokens:** `web/app/styles/tokens.css` (valores atuais da rev. 5, usados em todos os cálculos abaixo)
- **Autor:** ui-designer
- **Status:** Concluído. O usuário escolheu **dark-5** (Grafite com brilho ciano) e **light-2** (Lavanda → azul-gelo); os demais presets foram descartados. A página `/background-preview` (seção 3) foi removida. Os valores finais estão em `web/app/styles/tokens.css` e no `docs/design/design-system.md` rev. 6. As tabelas e a seção 3 abaixo ficam como registro histórico da Fase A.

### Histórico

| Revisão | Mudança |
|---|---|
| 1 | Versão inicial: geometria única, 5 presets por tema com pior caso de contraste calculado, página `/background-preview` e tratamento das faixas opacas na Fase B. Serve como rascunho da rev. 6 de `design-system.md` (T1); a rev. 6 propriamente dita é escrita na T13 com o par escolhido. |

Este documento define estrutura visual, hierarquia, componentes, estados e interação. Não contém código. Nomes de componentes seguem o ADR 0003 §8.1.

---

## 0. Decisões de design

| # | Decisão | Motivo |
|---|---|---|
| G1 | **Uma única geometria** para todos os presets dos dois temas (seção 1). Os presets diferem só nas cores. | ADR §5.2: a receita `--bg-gradient` é declarada uma vez, fora de `light-dark()`; só as cores variam por tema. Comparar presets com a mesma geometria também isola a variável que o usuário está escolhendo (a cor). |
| G2 | Todo preset tem **exatamente 3 paradas lineares e 2 brilhos**, mais a cor base. | Os dois temas compartilham N e M (`--bg-stop-1..3`, `--bg-glow-1..2`). Com a mesma contagem em todos, qualquer combinação claro x escuro (B3) vira token sem reajuste. |
| G3 | Presets numerados **por família**: `dark-N` e `light-N` são da mesma família de cor. | B3: escolha independente, mas o par "mesmo número" é sempre coerente. Facilita a escolha ("claro `light-3`, escuro `dark-3`"). |
| G4 | O "futurista" vem de **brilhos radiais frios e saturados** sobre uma base escura e quase neutra (escuro) e de **véus pastel** com matiz perceptível (claro). Sem animação, sem textura, sem grade decorativa. | B5 (estático), spec §6 (sem raster). O brilho saturado é o que dá a sensação de "luz de tela"; a base quase neutra mantém o contraste. |
| G5 | **Limites de luminância derivados do token mais justo**, não arbitrários (seção 2.1): escuro `0,005 <= L <= 0,030`; claro `L >= 0,845`. | Escuro: o par limitante é `--danger-text` sobre `--bg` (exige L <= 0,0343). Claro: `--accent` sobre `--bg` (exige L >= 0,8319). Margem para o mínimo interior das interpolações. |
| G6 | **Nenhum preset exige ajuste de token** (`requiredAdjustments` vazio em todos). | PA1: superfícies, textos e accent ficam com os valores da rev. 5. |
| G7 | Croma mínimo no claro **>= 12** (max(r,g,b) - min(r,g,b)), acima do mínimo 8 do ADR (I6). | RNF05: com 8 o fundo ainda parece cinza em telas comuns; 12 já é perceptível como lavanda, menta etc. |
| G8 | Na pré-visualização, `.segmented` e `.tablist` dentro da moldura são exibidos **com fundo transparente**, como ficarão na Fase B. | Sem isso, eles pintariam o `--bg` atual (rev. 5) dentro da moldura e o usuário avaliaria uma barra que não vai existir. O ajuste é só de classe utilitária na própria moldura (seção 3.4), sem cor literal e sem tocar no CSS de produção. |

---

## 1. Geometria única do gradiente (receita)

Mesma receita para os 10 presets e, depois, para `--bg-gradient` (ADR §5.2). Camadas, de cima para baixo:

| Camada | Forma | Centro | Alcance | Cor |
|---|---|---|---|---|
| Brilho 1 | radial, círculo | 12% x, 8% y (canto superior esquerdo) | esmaece até `transparent` em 55% | `--bg-glow-1` |
| Brilho 2 | radial, círculo | 88% x, 92% y (canto inferior direito) | esmaece até `transparent` em 50% | `--bg-glow-2` |
| Linear | 160 graus (de cima-esquerda para baixo-direita, levemente vertical) | - | paradas em 0%, 55% e 100% | `--bg-stop-1`, `--bg-stop-2`, `--bg-stop-3` |
| Cor base | sólida, por baixo de tudo | - | - | `--bg` |

Leitura visual: a luz "entra" pelo canto superior esquerdo (atrás da marca e do título da página) e uma segunda luz, de outro matiz, sobe do canto inferior direito. O centro da tela fica na parada 2, que é a mais próxima da cor base, então os cards do meio da página ficam sobre a região mais calma. Como as posições são em % da viewport (camada fixa), os dois brilhos ficam visíveis também em 360 px (RNF11).

---

## 2. Presets

### 2.0 Resultado da escolha

| Tema | Escolhido | Descartados |
|---|---|---|
| Escuro | **`dark-5`** Grafite com brilho ciano | `dark-1` Índigo profundo, `dark-2` Marinho → roxo, `dark-3` Petróleo noturno, `dark-4` Violeta → magenta |
| Claro | **`light-2`** Lavanda → azul-gelo | `light-1` Azul-névoa, `light-3` Menta → céu, `light-4` Pêssego → lilás, `light-5` Aurora suave |

Nas tabelas 2.2 a 2.4, as linhas e colunas de `dark-5` e `light-2` são as que viraram tokens; todas as outras são histórico. O par escolhido não é do mesmo número (G3 é só orientação; B3 permite escolha independente). Nenhum ajuste de token foi necessário (G6 confirmado). Pior caso do par escolhido: escuro `--text` 11,12, `--text-muted` 5,55, `--accent` 7,05; claro `--text` 12,61, `--text-muted` 6,48, `--accent` 4,62 (margem mais justa do par: `--accent`/`--focus-color` no claro).

### 2.1 Critérios e método de cálculo

- **Luminância relativa** WCAG 2.x, sRGB linearizado (`((c + 0,055) / 1,055)^2,4`, ou `c / 12,92` se `c <= 0,04045`). Razões **arredondadas para baixo** na 2a casa, como na §1.9 do design de lançamentos.
- **Pior caso no escuro = maior luminância** entre base, paradas e brilhos. Como a linearização é convexa, qualquer mistura sRGB entre duas cores (interpolação de paradas ou brilho composto com qualquer alfa) tem luminância **menor ou igual** à da cor mais clara. Logo o máximo das amostras do `sampleGradient()` é sempre uma das cores declaradas, e o número da tabela é exato.
- **Pior caso no claro = menor luminância.** Aqui a convexidade trabalha contra: o meio de uma interpolação pode ficar um pouco abaixo das pontas. Foram calculados os pontos médios dos pares de matiz mais distante de cada preset (ex.: brilho menta x parada céu; brilho pêssego x parada lilás): todos ficaram **acima** da menor cor declarada, e a queda máxima estimada perto da ponta é < 0,0002 de luminância (efeito < 0,01 nas razões). As tabelas usam a menor cor declarada; o teste `presets.spec.ts` (I8) recalcula com as amostras completas e é a fonte de verdade.
- **Limites de luminância** (G5), com as luminâncias dos tokens da rev. 5:

| Tema | Par limitante | L do primeiro plano | Limite do fundo para o mínimo | Faixa adotada |
|---|---|---|---|---|
| Escuro | `--danger-text` `#F87171` sobre `--bg` (T, 4,5) | 0,3296 | L <= 0,0343 | 0,005 <= L <= 0,030 |
| Escuro | `--text-disabled` / `--border-strong` `#7A8497` (C, 3) | 0,2288 | L <= 0,0429 | (coberto acima) |
| Escuro | `--text-muted` `#9BA5B7` (T, 4,5) | 0,3730 | L <= 0,0440 | (coberto acima) |
| Claro | `--accent` / `--focus-color` `#0E7490` (T, 4,5) | 0,1460 | L >= 0,8319 | L >= 0,845 |
| Claro | `--text-disabled` / `--border-strong` `#6F798C` (C, 3) | 0,1895 | L >= 0,6684 | (coberto acima) |

- Referência rev. 5 (fundo sólido atual): `--bg` claro `#EEF1F5` L = 0,8768; escuro `#151B26` L = 0,0108.
- **Consequência para o claro:** como o `--accent` claro exige L >= 0,832, o tom claro não pode ser escurecido; a cor vem dos canais R e B (pesos 0,21 e 0,07), com G sempre alto. Por isso os presets claros mais saturados são os de família menta/ciano e pêssego (onde G pode ficar alto com croma 30+), e os de lavanda/lilás são mais sutis (croma 16-26). Ver P2 na seção 7.

### 2.2 Tema escuro

Todas as cores opacas, `#RRGGBB`. L = luminância relativa.

| Id | Nome | Família | Base (`--bg`) | Parada 1 (0%) | Parada 2 (55%) | Parada 3 (100%) | Brilho 1 (sup. esq.) | Brilho 2 (inf. dir.) | L mín. | L máx. (pior caso) |
|---|---|---|---|---|---|---|---|---|---|---|
| `dark-1` | Índigo profundo | índigo | `#161A40` | `#101438` | `#181C48` | `#1C1644` | `#24266E` índigo elétrico | `#3C1E64` violeta | 0,0090 | 0,0289 (brilho 1) |
| `dark-2` | Marinho → roxo | violeta | `#141838` | `#0C1A30` | `#141838` | `#241640` | `#0E2C5C` azul-marinho vivo | `#3C1C60` roxo | 0,0103 | 0,0267 (brilho 1) |
| `dark-3` | Petróleo noturno | ciano | `#0C2228` | `#0A1C24` | `#0C2228` | `#101A2C` | `#0C3040` petróleo-ciano | `#142050` azul profundo | 0,0102 | 0,0256 (brilho 1) |
| `dark-4` | Violeta → magenta | magenta | `#241440` | `#1A1238` | `#241440` | `#2E1238` | `#481A5C` magenta | `#28226E` índigo | 0,0094 | 0,0289 (brilho 1) |
| `dark-5` | Grafite com brilho ciano | aurora | `#181E2A` | `#141A24` | `#181E2A` | `#12182A` | `#0C3044` ciano | `#20244D` índigo | 0,0095 | 0,0261 (brilho 1) |

Luminâncias por cor (para conferência do teste):

| Id | Base | P1 | P2 | P3 | B1 | B2 |
|---|---|---|---|---|---|---|
| `dark-1` | 0,0128 | 0,0090 | 0,0149 | 0,0124 | 0,0289 | 0,0281 |
| `dark-2` | 0,0109 | 0,0103 | 0,0109 | 0,0132 | 0,0267 | 0,0264 |
| `dark-3` | 0,0138 | 0,0102 | 0,0138 | 0,0103 | 0,0256 | 0,0176 |
| `dark-4` | 0,0125 | 0,0094 | 0,0125 | 0,0130 | 0,0289 | 0,0272 |
| `dark-5` | 0,0129 | 0,0101 | 0,0129 | 0,0095 | 0,0261 | 0,0210 |

Verificações do ADR §4.1: I5 (todas as cores em `[0,005; 0,25)`: nenhuma preta nem quase preta); I7 (base dentro de `[mín.; máx.]` em todos). Nenhuma cor escura é cinza neutro puro: todas têm matiz azul, violeta, petróleo ou magenta.

Descrição visual:
- **`dark-1` Índigo profundo:** azul-noite com leve deriva para violeta embaixo; luz índigo no topo e violeta no canto oposto. É o mais próximo do primário (`--primary` índigo) e o mais "cockpit".
- **`dark-2` Marinho → roxo:** começa num marinho frio quase petróleo e termina em roxo; brilho azul-marinho vivo no topo. Transição de matiz mais evidente dos cinco.
- **`dark-3` Petróleo noturno:** verde-azulado escuro, harmoniza com o `--accent` ciano; brilho petróleo no topo e azul profundo embaixo. O mais calmo.
- **`dark-4` Violeta → magenta:** o mais quente e "neon"; magenta no topo, índigo embaixo.
- **`dark-5` Grafite com brilho ciano:** base quase neutra (grafite azulado, a mais próxima da rev. 5) com um brilho ciano no topo e índigo embaixo. A opção mais sóbria.

### 2.3 Tema claro

| Id | Nome | Família | Base (`--bg`) | Parada 1 (0%) | Parada 2 (55%) | Parada 3 (100%) | Brilho 1 (sup. esq.) | Brilho 2 (inf. dir.) | L mín. (pior caso) | L máx. |
|---|---|---|---|---|---|---|---|---|---|---|
| `light-1` | Azul-névoa | índigo | `#EAF0FC` | `#E8EEF8` | `#EAF0FC` | `#E8EEFC` | `#DEF0FE` azul-gelo | `#EAEEFE` pervinca | 0,8500 (brilho 1) | 0,8684 |
| `light-2` | Lavanda → azul-gelo | violeta | `#ECEEFC` | `#EEEEFE` | `#E8F0FC` | `#F0ECFC` | `#E4F0FE` azul-gelo | `#F4ECFE` lilás | 0,8554 (parada 3) | 0,8650 |
| `light-3` | Menta → céu | ciano | `#E2F4F4` | `#E0F8EE` | `#E2F4F4` | `#E0F0FA` | `#D4FAE8` menta | `#DCF2FE` céu | 0,8506 (parada 3) | 0,8904 |
| `light-4` | Pêssego → lilás | magenta | `#FCEEF0` | `#FFF0E6` | `#FCEEF0` | `#F2EEFC` | `#FFEADC` pêssego | `#F0ECFE` lilás | 0,8527 (brilho 1) | 0,8929 |
| `light-5` | Aurora suave | aurora | `#F0F0FC` | `#E2F6F8` | `#F0F0FC` | `#FCEEF6` | `#D8F8F0` ciano-menta | `#FFE8F4` rosa | 0,8550 (brilho 2) | 0,8886 |

Luminâncias e croma (max - min dos canais) por cor:

| Id | Base | P1 | P2 | P3 | B1 | B2 | Croma mín. / máx. |
|---|---|---|---|---|---|---|---|
| `light-1` | 0,8684 | 0,8508 | 0,8684 | 0,8533 | 0,8500 | 0,8580 | 16 / 32 |
| `light-2` | 0,8601 | 0,8648 | 0,8650 | 0,8554 | 0,8597 | 0,8638 | 16 / 26 |
| `light-3` | 0,8740 | 0,8904 | 0,8740 | 0,8506 | 0,8819 | 0,8588 | 18 / 38 |
| `light-4` | 0,8814 | 0,8929 | 0,8814 | 0,8705 | 0,8527 | 0,8567 | 14 / 35 |
| `light-5` | 0,8787 | 0,8886 | 0,8787 | 0,8850 | 0,8802 | 0,8550 | 12 / 32 |

Verificações do ADR §4.1: I6 (nenhuma `#FFFFFF`; todas abaixo de `--surface` branco, L = 1; croma >= 12 em todas, G7); I7 (base dentro da faixa). Separação card x fundo (RNF03): `--surface` branco sobre o pior fundo dá 1,16:1 (rev. 5: 1,13), mais a borda `--border` e `--shadow-card`, sem mudança.

Descrição visual:
- **`light-1` Azul-névoa:** azul muito claro e frio, com brilho azul-gelo no topo. O mais próximo da rev. 5, só que com matiz.
- **`light-2` Lavanda → azul-gelo:** lavanda no topo passando a azul-gelo e voltando a lilás; brilhos azul e lilás. Harmoniza com o índigo do primário.
- **`light-3` Menta → céu:** o mais colorido dos claros; menta no topo, céu embaixo. Combina com o `--accent` ciano.
- **`light-4` Pêssego → lilás:** o único quente; pêssego no topo, lilás embaixo.
- **`light-5` Aurora suave:** três matizes (ciano, lilás, rosa) bem diluídos; o mais "futurista" dos claros.

### 2.4 Pior caso de contraste por preset

Mínimos: **T** 4,5 (texto), **C** 3 (componente, borda, foco, indicador, desabilitado). Todos os pares de `CONTRAST_PAIRS` com `bg: "--bg"`. `--focus-color` e `--accent` (indicador da aba) têm o mesmo valor de `--accent` em ambos os temas, então repetem a coluna `--accent`.

**Tema escuro** (contra a cor mais clara do preset):

| Frente | Min. | rev. 5 (`#151B26`) | `dark-1` | `dark-2` | `dark-3` | `dark-4` | `dark-5` |
|---|---|---|---|---|---|---|---|
| `--text` | T | 13,91 | 10,73 | 11,04 | 11,19 | 10,73 | 11,12 |
| `--text-muted` | T | 6,95 | 5,36 | 5,51 | 5,59 | 5,36 | 5,55 |
| `--accent` (texto) / `--accent` (indicador) / `--focus-color` | T / C / C | 8,82 | 6,80 | 7,00 | 7,10 | 6,80 | 7,05 |
| `--danger-text` | T | 6,24 | 4,81 | 4,95 | 5,01 | 4,81 | 4,98 |
| `--text-disabled` | C | 4,58 | 3,53 | 3,63 | 3,68 | 3,53 | 3,66 |
| `--border-strong` | C | 4,58 | 3,53 | 3,63 | 3,68 | 3,53 | 3,66 |
| `--primary-border` | C | 5,78 | 4,46 | 4,59 | 4,65 | 4,46 | 4,62 |
| **Resultado** | | | AA ok | AA ok | AA ok | AA ok | AA ok |

**Tema claro** (contra a cor mais escura do preset):

| Frente | Min. | rev. 5 (`#EEF1F5`) | `light-1` | `light-2` | `light-3` | `light-4` | `light-5` |
|---|---|---|---|---|---|---|---|
| `--text` | T | 12,91 | 12,53 | 12,61 | 12,54 | 12,57 | 12,60 |
| `--text-muted` | T | 6,63 | 6,44 | 6,48 | 6,44 | 6,46 | 6,47 |
| `--accent` (texto) / `--accent` (indicador) / `--focus-color` | T / C / C | 4,72 | 4,59 | 4,62 | 4,59 | 4,60 | 4,61 |
| `--danger-text` | T | 5,71 | 5,54 | 5,57 | 5,55 | 5,56 | 5,57 |
| `--text-disabled` | C | 3,87 | 3,75 | 3,78 | 3,76 | 3,76 | 3,77 |
| `--border-strong` | C | 3,87 | 3,75 | 3,78 | 3,76 | 3,76 | 3,77 |
| `--primary-border` | C | 5,54 | 5,38 | 5,42 | 5,39 | 5,40 | 5,41 |
| **Resultado** | | | AA ok | AA ok | AA ok | AA ok | AA ok |

**Margens mais justas** (monitorar na T7/T9): escuro `--danger-text` em `dark-1` e `dark-4` (4,81) e `--text-disabled`/`--border-strong` (3,53); claro `--accent`/`--focus-color` em `light-1` e `light-3` (4,59). Nenhum preset precisou de `requiredAdjustments` (G6), então nenhum foi descartado (RF06).

**O que o indicador da página mostra (RF05):** só `--text`, `--text-muted` e `--accent`, medidos no navegador. Os valores esperados são as três primeiras linhas das tabelas acima.

**Outros tokens já listados sobre `--bg` na §1.9** (não estão em `CONTRAST_PAIRS`; conferidos por garantia, pior caso entre os cinco presets de cada tema; luminâncias derivadas das razões arredondadas para baixo da §1.9, portanto conservadoras):

| Frente | Min. | Claro (pior: `light-1`) | Escuro (pior: `dark-1`/`dark-4`) |
|---|---|---|---|
| `--success-text` | T | 4,70 | 6,91 |
| `--warning-text` | T | 6,06 | 7,96 |
| `--income` | T | 5,73 | 5,22 |
| `--expense` | T | 5,38 | 4,94 |
| `--success` | C | 3,22 | 6,91 |
| `--warning` | C | 4,30 | 7,96 |

**Composições translúcidas (não pioram):**
- **Navbar** (`--header-bg` alfa 0,95): composta sobre qualquer amostra do gradiente, fica entre a cor da navbar e a amostra; o pior caso continua sendo a composição sobre `--text` (já em `HEADER_UNDER`), com os valores atuais da §1.9 (`--text` 13,09 claro / 10,99 escuro; `--text-muted` 6,72 / 5,49; `--accent` 4,79 / 6,97).
- **Scrim** (drawer/modal): no claro, o fundo mais escuro escurece a composição e aumenta o contraste de `--surface` contra ela (>= 3,24 da rev. 5). No escuro, o pior caso é o scrim sobre o brilho mais claro (`#24266E` em `dark-1`, composição aprox. `#10132B`, L 0,0075): `--border-strong` do drawer fica em 4,85 (mín. 3; rev. 5: 5,07).
- **Superfícies** (`--surface`, `--surface-2`, `--surface-active`, `--input-bg`, `--tooltip-bg`): sem mudança de valor, pares sem mudança (RNF02).
- **Observação visual (escuro):** os brilhos (L até 0,029) são mais claros que `--surface` escuro `#1C2330` (L 0,0166). Um card que fique sobre o centro de um brilho fica levemente **mais escuro** que o fundo ao redor. Isso é aceitável e até reforça a leitura de "painel sobre luz", mas a separação continua dependendo de `--border` + `--shadow-card` (RNF03), não do contraste fundo x card. Conferir na T7 nas telas reais.

---

## 3. Página `/background-preview` (Fase A) - REMOVIDA

> Seção histórica: a página, o módulo de dados e o e2e da Fase A foram removidos (ADR 0003 T11). Na Fase A, `scheme-dark`/`scheme-light` por moldura não funcionaram (o Lightning CSS do Tailwind resolve `light-dark()` no `:root`); a solução foi um `<style>` com tokens já resolvidos por moldura (ver ADR 0003 §5.8, adendo). A G8 (segmented/tablist transparentes) virou regra de produção em `globals.css`.

### 3.1 Hierarquia de informação

1. **Aviso de página temporária** (RF08): o usuário precisa saber que isto não é uma tela do produto.
2. **Título e instrução de escolha**: o que fazer e como informar a escolha (ids na conversa, B2).
3. **Seção "Tema escuro"** e **seção "Tema claro"**, cada uma com os 5 presets, na ordem do id (= ordem de família, G3).
4. Em cada preset, nesta ordem de leitura: **id + nome** (o que o usuário vai citar), família e paradas (com hex), **indicador de contraste** ("AA ok"), e a **amostra de UI** sobre o gradiente.

### 3.2 Estrutura

```
[navbar real (shell (app)), sem link para esta página]
main#conteudo
  p[role=note]  "Página temporária de escolha do fundo. Será removida após a decisão."
  h1  "Escolha do fundo"
  p   "Escolha um preset para cada tema e informe os ids na conversa, por exemplo: claro light-3, escuro dark-3.
       Presets com o mesmo número são da mesma família de cor."
  nav[aria-label="Seções"]  links-âncora: "Tema escuro" · "Tema claro"
  section[aria-labelledby=h2-escuro]
    h2 "Tema escuro"
    p (muted) "Cada moldura usa os tokens do tema escuro, qualquer que seja o tema ativo."
    grade de molduras
      article[aria-labelledby=<id>-titulo]  x5  (PresetFrame + SampleUi)
  section[aria-labelledby=h2-claro]
    h2 "Tema claro"
    ... idem, x5
```

O aviso, o `h1`, a instrução e os `h2` ficam **fora das molduras**, no tema ativo da aplicação e sobre o `--bg` atual. Só o conteúdo das molduras tem tema forçado.

**Moldura (um preset), desktop:**

```
+--------------------------------------------------------------------------------+
| [dark-1]  Índigo profundo                          Contraste (pior caso)        |
| Família: índigo                                    Texto 10,73 · AA ok          |
| Paradas: [] #101438  [] #181C48  [] #1C1644        Texto secundário 5,36 · AA ok|
| Brilhos: [] #24266E  [] #3C1E64   Base: [] #161A40 Accent 6,80 · AA ok          |
|--------------------------------------------------------------------------------|
|  Resumo de novembro                    (h4, --text, Space Grotesk 20)           |
|  Seus lançamentos do mês aparecem aqui. (parágrafo, --text)                     |
|  Atualizado há 2 minutos                (--text-muted, 14)                      |
|  Ver todas as despesas                  (link, --accent)                        |
|  Não foi possível carregar a fatura.    (--danger-text, 14)                     |
|                                                                                 |
|  +--------------------------+   [ Despesas | Faturas | Receitas ]  (Tabs real)  |
|  | Saldo previsto  (muted)  |   painel: "Conteúdo da aba Despesas" (muted)      |
|  | R$ 1.234,56     (Money)  |                                                   |
|  | [Pendente] (StatusBadge) |   Forma: [ PIX | Cartão ]  (SegmentedControl)     |
|  | [Alimentação] (.chip)    |                                                   |
|  +--------------------------+   Descrição  [ Mercado do mês        ]  (.field)  |
|                                 [Salvar] (.btn-primary)  [Cancelar] (.btn)      |
+--------------------------------------------------------------------------------+
```

`[]` = amostra de cor (quadrado 16 px, decorativo). O id aparece num rótulo monoespaçado (JetBrains Mono 14, peso 600) em pílula com fundo `--surface` e borda `--border-strong`, para ser lido sobre qualquer gradiente.

### 3.3 Layout por breakpoint

Container igual ao das telas reais: `max-w 1280px`, padding horizontal 16 / 24 (`md`) / 32 (`lg`).

| Faixa | Grade de molduras | Moldura | Cabeçalho da moldura | Amostra de UI |
|---|---|---|---|---|
| < `md` (360-767) | 1 coluna, espaço 16 | largura total, padding 16, altura pelo conteúdo (aprox. 760 px), `min-height` 420 | empilhado: id+nome; família; paradas e brilhos quebrando linha; indicador de contraste **abaixo** das paradas, em lista de 3 linhas | coluna única: textos, card largura total, abas no modo mobile (segmented de 3 colunas iguais, `.tablist` com contorno `--border-strong` e fundo transparente, G8), segmented, campo, botões lado a lado (cada um 50%, alvo 44 px) |
| `md` (768-1023) | 1 coluna, espaço 24 | proporção aprox. 16:10, padding 24, `min-height` 420 | 2 colunas: identificação à esquerda, indicador à direita | 2 colunas: textos + card à esquerda; abas (sublinhadas, `md+`), segmented, campo e botões à direita |
| >= `lg` (1024+) | 2 colunas, espaço 24 (5 molduras: a 5a ocupa a 1a coluna da 3a linha) | padding 24, `min-height` 420; a altura segue o conteúdo (a proporção 16:10 daria < 420 em ~590 px de largura) | como `md` | como `md`, com o card com largura mínima de 220 px |

- Molduras com raio 12 px e borda 1 px `--border` (resolvida no tema da moldura). Sem sombra própria: o gradiente já separa a moldura do fundo da página.
- Ordem na grade: `dark-1` a `dark-5` e `light-1` a `light-5`, da esquerda para a direita, de cima para baixo. A mesma posição nas duas seções corresponde à mesma família (G3).
- Em 360 px, nada rola na horizontal; os hex das paradas quebram linha entre itens, nunca no meio do valor.

### 3.4 Moldura de preset (`PresetFrame`)

- Contexto de tema: `scheme-dark` (presets `dark-*`) ou `scheme-light` (presets `light-*`) **e** `text-text`, obrigatório para o texto herdado seguir o tema da moldura (ADR §5.8).
- Fundo: cor base + brilhos + linear do preset, montados por `presetToCss()` a partir de custom properties inline (`--pv-base`, `--pv-stop-1..3`, `--pv-glow-1..2`), com a geometria da seção 1 relativa à moldura.
- Atributos: `data-preview-frame`, `data-preset-id`, `data-theme-context`, `data-gradient-tokens` (ADR §5.8).
- G8: a moldura aplica utilitários de variante arbitrária do Tailwind para deixar `.segmented` e `.tablist` descendentes com fundo transparente (simula a Fase B). Sem cor literal, sem arquivo CSS novo, sem editar `globals.css`. Se o architect preferir não usar variante arbitrária, alternativa equivalente: classe no próprio conjunto da pré-visualização. Em qualquer caso, nada fora de `background-preview/` muda.
- A moldura **não** redefine `--bg`: nenhum elemento da amostra usa `--bg` (depois de G8), então todos os pares medidos usam os tokens reais.
- Diferença conhecida (ADR §5.8): o brilho é posicionado em % da moldura, não da viewport; na tela cheia os brilhos ficam proporcionalmente maiores e mais afastados. A rodada de ajuste da T7 confirma nas telas reais.

### 3.5 Amostra de UI (`SampleUi`)

Componentes e classes **reais** (RF03). Todo texto é estático e em pt-BR.

| Elemento | Componente / classe | Conteúdo | Token testado sobre o gradiente |
|---|---|---|---|
| Título | `h4`, Space Grotesk 20/600 | "Resumo de novembro" | `--text` |
| Parágrafo | `p` 16 | "Seus lançamentos do mês aparecem aqui." | `--text` |
| Texto secundário | `p` 14 | "Atualizado há 2 minutos" | `--text-muted` |
| Link | `a` | "Ver todas as despesas" (âncora para o próprio artigo, `#preset-<id>`) | `--accent`, foco `--focus-color` |
| Erro sobre o fundo | `p` 14 | "Não foi possível carregar a fatura." (sem `role="alert"`: é amostra) | `--danger-text` (par mais justo do escuro) |
| Card | `.card` | rótulo "Saldo previsto" (muted), `<Money value="1234.56" />` = "R$ 1.234,56" em 24/600 tabular | `--surface` + `--border` + `--shadow-card` |
| Badge | `StatusBadge status="PENDING"` dentro do card | "Pendente" | sobre `--surface` |
| Chip | `.chip` dentro do card | "Alimentação" | sobre `--surface` |
| Abas | `Tabs` real, `idPrefix="pv-<id>"`, 3 itens, ativa "Despesas" | "Despesas", "Faturas", "Receitas"; cada aba aponta para o seu `tabpanel` (`#pv-<id>-panel-<aba>`) | ativa: indicador `--accent` (`md+`) ou `--primary-strong` (mobile); inativa: `--text-muted` sobre o gradiente |
| Painel da aba | `div role="tabpanel"` por aba (só o ativo visível) | "Conteúdo da aba Despesas." (muted) | `--text-muted` |
| Segmented | `SegmentedControl`, rótulo "Forma de pagamento" | "PIX" (selecionado) e "Cartão"; troca de seleção funciona localmente | contorno `--border-strong`, inativo `--text-muted`, ativo `--on-primary`/`--primary-border` |
| Campo | `TextField` | rótulo "Descrição", valor "Mercado do mês", id único por preset | `--input-bg`, borda `--border-strong` |
| Botão primário | `Button variant="primary"` | "Salvar" | `.btn-primary` |
| Botão secundário | `Button` | "Cancelar" | `.btn` (transparente sobre o gradiente: borda `--border-strong`, texto `--text`) |

- Os botões são `type="button"` e não fazem nada. As abas não trocam a seleção (amostra estática): ativar outra aba só leva ao painel correspondente pela âncora. O `SegmentedControl` é controlado, então a amostra guarda o valor em estado local (pequeno wrapper cliente dentro de `_preview/`).
- Nenhum valor vem da API (CA02). O `Money` recebe string decimal, conforme o padrão do projeto (PA7).

### 3.6 Indicador de contraste (`ContrastBadge`)

- Posição: canto superior direito do cabeçalho da moldura (`md+`); abaixo das paradas (< `md`).
- Forma: bloco com fundo `--surface`, borda `--border-strong`, raio 8, padding 8/12, texto 14. Fundo opaco para que o próprio indicador seja legível em qualquer preset.
- Conteúdo: título "Contraste (pior caso)" e uma linha por token: "Texto 10,73 · AA ok", "Texto secundário 5,36 · AA ok", "Accent 6,80 · AA ok". Razão com 2 casas, vírgula decimal, arredondada para baixo.
- Resultado sempre **em texto** ("AA ok" / "abaixo de AA"), com ícone de apoio (check ou alerta, `aria-hidden`). A cor do ícone é `--success-text` ou `--danger-text`, nunca o único sinal (RF05).
- Se houver `requiredAdjustments` (nenhum nesta rodada), uma linha extra "Ajuste necessário: `--text-muted` para `#...` (motivo)".

### 3.7 Estados

| Estado | Quando | O que aparece |
|---|---|---|
| Normal | Página carregada, hidratada | Tudo da seção 3.2, indicadores com os números. |
| Indicador calculando | Antes da hidratação (SSR) ou enquanto a sonda roda | No lugar das três linhas: "Calculando contraste…" em `--text-muted`. O resto da moldura já está completo. Sem spinner (evita movimento; dura um quadro). |
| Indicador abaixo de AA | Algum token com pior caso abaixo do mínimo (não deve ocorrer na lista entregue, CA05) | Linha do token com "abaixo de AA" e ícone de alerta. Serve de alarme se um token mudar antes da escolha. |
| Indicador indisponível | A sonda não consegue resolver uma cor (ex.: navegador sem suporte) | "Contraste indisponível neste navegador. Os valores calculados estão em `docs/design/fundo-gradiente-temas.md`." em `--text-muted`. Proposta deste design; o ADR não define este caso (ver P4). |
| Gate desligado | Produção sem `BACKGROUND_PREVIEW=1` | 404 padrão do Next (ADR §5.4). Nenhum layout próprio. |
| Carregando a rota | Navegação para a página | Sem `loading.tsx` próprio. A página não busca dados; se houver loading do grupo `(app)`, ele aparece normalmente. |
| Erro | - | Não há busca de dados nem ação que falhe. Erros de renderização caem no `error.tsx`/`global-error.tsx` existentes. |
| Vazio | - | Não existe: a lista é constante e o teste garante de 4 a 6 por tema. Não há estado vazio desenhado. |
| Tema ativo claro x escuro | Troca pelo botão sol/lua | Só aviso, título, instrução e `h2` mudam de tema. As molduras não mudam (CA04). |

### 3.8 Acessibilidade

- **Landmarks e títulos:** `main` do layout; aviso com `role="note"`; `nav` de âncoras com `aria-label="Seções"`; duas `section` com `aria-labelledby` nos `h2`; um `article` por preset com `aria-labelledby` no `h3` e `id="preset-<id>"`. Ordem `h1` > `h2` > `h3` (nome do preset, com o id no texto: "dark-1 · Índigo profundo") > `h4` (título da amostra).
- **Paradas:** lista `ul` com o hex em texto ("Parada 1: #101438"). As amostras de cor são `aria-hidden`; a informação está no texto.
- **ids únicos** por moldura: abas (`pv-<id>-tab-*`, `pv-<id>-panel-*`), campo, rótulo do segmented. Dez instâncias da mesma amostra não podem colidir (axe completo, CA08).
- **Teclado:** ordem natural por moldura (link, abas, segmented, campo, botões). Abas com setas/Home/End e ativação manual (comportamento real do `Tabs`); segmented com setas (comportamento real). Anel de foco `--focus-ring` visível sobre todos os gradientes (pior caso `--focus-color`: 4,59 claro, 6,80 escuro; mínimo 3).
- **Leitor de tela:** o indicador de contraste **não** é `aria-live` (seriam 30 anúncios na hidratação); é texto estático lido em ordem. Botões e abas da amostra não precisam de aviso extra; o aviso no topo já diz que a página é temporária.
- **Contraste da própria página:** textos fora das molduras usam os tokens normais sobre o `--bg` atual. Textos dentro das molduras foram verificados na seção 2.4; o e2e audita com `gradients: [{ selector: "[data-preview-frame]" }]`.
- **Movimento:** nenhuma animação nova.
- **Zoom 200% / texto grande:** molduras crescem em altura; abas no mobile viram rolagem horizontal (comportamento atual da `.tablist`).

### 3.9 Fluxo de interação

1. O usuário abre `/background-preview` pela URL (sem link na aplicação, RF07).
2. Lê o aviso e a instrução. Usa as âncoras "Tema escuro" / "Tema claro" para pular entre seções.
3. Percorre as molduras; pode tabular, focar abas e campos e trocar o segmented para ver os estados reais sobre o gradiente.
4. Opcional: alterna o tema da aplicação no sol/lua para confirmar que as molduras não mudam.
5. Informa na conversa: "claro `light-N`, escuro `dark-N`" (B2). A página não grava nada.
6. Se rejeitar todos: nova rodada com 5 presets por tema, mesmos ids reaproveitados (`dark-1..5`, `light-1..5`) e a mesma estrutura (PA5). Esta seção 2 ganha uma revisão.

---

## 4. Componentes

### 4.1 Novos (todos dentro de `web/app/(app)/background-preview/`, removidos na T11)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `page.tsx` | Server Component | Gate, metadata, aviso, título, instrução, âncoras, seções e grade. |
| `PresetFrame` (`_preview/preset-frame.tsx`) | Server | Moldura com tema forçado, fundo do preset, atributos `data-*`, cabeçalho (id, nome, família, paradas, brilhos, base) e G8. |
| `SampleUi` (`_preview/sample-ui.tsx`) | Server com uma ilha cliente | Amostra da seção 3.5. |
| Wrapper do segmented (`_preview/sample-ui.tsx` ou arquivo irmão) | Cliente | Estado local do `SegmentedControl` controlado. |
| `ContrastBadge` (`_preview/contrast-badge.tsx`) | Cliente | Sonda de cores na moldura e exibição da seção 3.6. |
| Amostra de cor (swatch) | Server, interno ao `PresetFrame` | Quadrado 16 px, raio 4, borda 1 px `--border-strong`, `aria-hidden`; a cor vem por prop do módulo de dados. |

### 4.2 Existentes (usados sem alteração)

`Tabs`, `SegmentedControl`, `TextField`, `Button`, `Money`, `StatusBadge` (`components/ui/`); classes `.card`, `.chip`, `.btn`, `.btn-primary`, `.field`, `.tab`, `.tablist`, `.segmented` (`globals.css`); navbar real (`AppHeader`, sem link novo em `MainNav`).

### 4.3 Fase B (produção)

Nenhum componente novo. Mudanças só de CSS e de classe (seção 5).

---

## 5. Fase B: fundo aplicado e faixas opacas

### 5.1 Conversão do preset escolhido em tokens

| Preset | Token |
|---|---|
| Base | `--bg` (substitui `#EEF1F5` / `#151B26`) |
| Parada 1, 2, 3 | `--bg-stop-1`, `--bg-stop-2`, `--bg-stop-3` |
| Brilho 1, 2 | `--bg-glow-1`, `--bg-glow-2` |
| Geometria (seção 1) | `--bg-gradient` (única, ADR §5.2) |

Cada token de cor recebe `light-dark(<cor do light-N escolhido>, <cor do dark-N escolhido>)`. Como todos os presets têm 3 paradas e 2 brilhos (G2), qualquer combinação encaixa sem repetir cor nem mudar a receita.

Tokens que **também** referenciam o valor antigo de `--bg` e precisam de decisão na T7 (fora do RF14, mas visíveis): `--chart-cursor` claro (`#EEF1F5`, igual ao `--bg` atual) e `--input-bg` escuro (`#151B26`, igual ao `--bg` atual). Proposta: **manter os valores da rev. 5** (o cursor fica sobre `--surface` e o input é uma superfície), registrando na rev. 6 que eles deixaram de ser "iguais ao fundo".

### 5.2 Fundo da página

- Camada fixa `body::before` com a receita; `html` e `body` continuam pintando `--bg` (overscroll e testes).
- Mesma aparência em `/entries`, `/cards`, `/dashboard`, `loading.tsx`, `error.tsx` e `global-error.tsx` (CA18): nenhum estado tem fundo especial (PA8). O skeleton (`--skeleton`) e os banners de erro (`InlineAlert` sobre `--surface`) não mudam.
- Troca de tema instantânea, sem transição (como hoje).

### 5.3 Faixa de abas de `/entries` (`.page-bg-window`)

- **Aparência:** a faixa sticky passa a mostrar **o mesmo trecho do gradiente** que estaria atrás dela (mesma receita, `background-attachment: fixed`, referencial da viewport). Visualmente ela some no fundo; o que a delimita é só a linha inferior de 1 px `--border`, como hoje. Nada de barra chapada (CA16), nada de vidro (B1).
- **Rolagem:** o conteúdo que passa por baixo continua escondido (a faixa é opaca); a faixa não ganha sombra ao grudar (sem mudança de comportamento em relação à rev. 5).
- **Conteúdo da faixa:** abas (`md+`: sublinhadas, fundo transparente; mobile: `.tablist` transparente com contorno `--border-strong`), mês compacto com setas e "+ Novo lançamento" (`md+`). Todos os textos usam pares cobertos pelo pior caso da seção 2.4 (`--text`, `--text-muted`, `--accent`, `--primary-border`, `--border-strong`, `--focus-color`).
- **Altura e posição:** inalteradas (52 px mobile / 56 px `md+`, `top: var(--navbar-h)`, z 30).
- **Limitação conhecida (iOS Safari):** `attachment: fixed` vira `scroll`; a faixa mostra o gradiente relativo a ela própria. Diferença de tom pequena (as paradas variam pouco de luminância), sem barra sólida. Registrar na rev. 6.

### 5.4 Segunda linha da navbar no mobile (< `sm`)

- **Sem fundo** (transparente): os links "Lançamentos / Dashboard / Cartões" ficam diretamente sobre o gradiente. Mantém a borda inferior 1 px `--border`.
- Essa linha rola com a página e nada passa por baixo dela, então não precisa de janela de fundo.
- Item ativo em `--accent`, inativos em `--text-muted`: cobertos pelo pior caso (seção 2.4).

### 5.5 `.segmented`

- **Fundo transparente.** Mantém contorno 1 px `--border-strong` e raio 10.
- Sobre o gradiente (filtros, faixa de abas): segmentos inativos com texto `--text-muted` sobre o fundo; hover `--surface-2`; pressionado `--surface-active`; selecionado `--primary-strong` com borda `--primary-border` e texto `--on-primary`. Todos os pares cobertos.
- Dentro do drawer (sobre `--surface`): visualmente igual ao de hoje, porque o `--surface` aparece por trás no lugar do `--bg`. Pares de `--surface` já existentes.

### 5.6 `.tablist` (mobile)

- **Fundo transparente** (no `md+` já é). Contorno `--border-strong`, aba ativa preenchida com `--primary-strong`. Como fica dentro da `.page-bg-window`, o que aparece atrás é o gradiente.

### 5.7 Navbar (linha 1)

Sem mudança: `--header-bg` alfa 0,95 + blur 12 px. Sobre o gradiente ela ganha um leve tingimento (5%) do brilho 1, que fica no canto superior esquerdo; o contraste não muda (seção 2.4, composições).

---

## 6. Riscos visuais e mitigação

| Risco | Mitigação |
|---|---|
| Banding em telas de 8 bits (degraus nos brilhos escuros) | Brilhos com raio grande (50-55%) e diferença de luminância pequena entre brilho e paradas (no escuro, de 0,009 a 0,029). Validar em monitor comum na T7; se aparecer, reduzir a saturação do brilho, não adicionar textura (fora de escopo). |
| Claro "lavado" (pouca cor) | Limite imposto pelo `--accent` claro (seção 2.1). Ver P2. |
| Card escuro mais escuro que o brilho | Aceito e intencional (seção 2.4); a separação depende da borda + sombra (RNF03). |
| Moldura x viewport | Rodada de ajuste da T7 nas telas reais. |
| iOS e a faixa sticky | Seção 5.3. |

---

## 7. Pendências para o usuário

| # | Pergunta | Proposta |
|---|---|---|
| P1 | Escolha dos presets (gate da T6). **Resolvida:** `dark-5` + `light-2`. | (histórico) Informar "claro `light-N`, escuro `dark-N`". Sugestão do designer: par **3** (`dark-3` Petróleo noturno + `light-3` Menta → céu), o que mais combina com o `--accent` ciano e o mais colorido dos claros; alternativa mais "neon": par **1** ou **4**. |
| P2 | Se o claro parecer pálido demais em todos os presets. | Segunda rodada com `requiredAdjustments`: escurecer o `--accent` claro para `#0C6980` (hoje é o `--accent-active`) permitiria paradas com L até ~0,78 e croma bem maior. Muda pares em superfícies também (PA1), por isso não foi feito nesta rodada. |
| P3 | Manter `--chart-cursor` claro e `--input-bg` escuro com os valores da rev. 5 (seção 5.1). | Manter. |
| P4 | Estado "Contraste indisponível" do indicador (seção 3.7) não está no ADR. | Adotar; é só texto, sem efeito no restante. Confirmar com o architect. |
