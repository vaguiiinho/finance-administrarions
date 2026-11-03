# Spec: Dashboard, "Despesas por categoria" abaixo do gráfico de barras e legenda contida no card

**Impacto em UI: sim.** Muda o layout do dashboard (`/dashboard` e `/demo/dashboard`): o card "Despesas por categoria" deixa de ficar ao lado da evolução mensal e passa para baixo dela, em largura total. Muda também o arranjo interno do card (rosca + legenda). O ui-designer participa: define o arranjo da rosca e da legenda em largura total e o ponto em que a legenda passa a ficar empilhada.

- Data: 2026-11-02
- Branch: `bugfix/dashboard`
- Status: **Implementada** (ADR 0012 aceito). Pendência de verificação: o Playwright (`web/e2e/dashboard-layout.pw.ts`) não rodou no ambiente de desenvolvimento (falta `libnspr4.so`).
- Tipo: bugfix de layout com pequeno ajuste de UX.
- Escopo: só `[web]`. Sem mudanças em `api/`, contratos HTTP, Prisma ou banco. O app mobile (`mobile/`) não muda.
- Continua: `docs/specs/lancamentos-financeiros.md` (RF17, D4: donut com até 5 categorias + "Outras", legenda própria e tabela alternativa), `docs/specs/lancamentos-financeiros-fechamento.md` (destaque pela legenda, `prefers-reduced-motion`) e `docs/specs/superficies-vidro-fosco.md` (cards em vidro, separador `--chart-sep`).
- Referências de código: `web/features/dashboard/dashboard-screen.tsx`, `web/features/dashboard/dashboard-loading.tsx`, `web/features/dashboard/_components/category-donut.tsx`, `web/features/dashboard/_components/chart-card.tsx`, `web/features/dashboard/_components/dashboard-skeletons.tsx`, `web/features/dashboard/_components/monthly-chart.tsx`. Referência só visual: `mobile/src/features/dashboard/charts.tsx` (o app mobile já empilha a legenda abaixo da rosca).

### Pedido do usuário (literal)

> "o grafico despesa por categoria a legenda da pizza esta fora da tela, fora do cartao tambem, verifique o que fica melhor, coloca abaixo do grafico de barras."

### Decisões do usuário (já tomadas, não reabrir)

1. O card "Despesas por categoria" fica **abaixo** do gráfico de barras (evolução mensal).
2. A legenda da rosca não pode sair do card nem da tela.
3. O arranjo interno do card ("verifique o que fica melhor") fica a cargo do time, dentro das regras desta spec (ver B1).

---

## 1. Contexto

### 1.1 Estado atual (levantado no código)

**Layout da tela.** Em `dashboard-screen.tsx`, abaixo do resumo do mês, há um grid `grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6` com dois filhos:
- `MonthlyChartBlock` (evolução mensal) em `min-w-0 lg:col-span-8`;
- `CategoryDonutBlock` (despesas por categoria) em `min-w-0 lg:col-span-4`.

Abaixo de `lg` (< 1024 px) os dois já ficam empilhados, com o donut depois das barras. A partir de `lg`, ficam lado a lado (8/12 e 4/12). O skeleton (`dashboard-loading.tsx`) repete o mesmo grid 8/4 com `ChartSkeleton` e `DonutSkeleton`. O mesmo `DashboardScreen` e o mesmo `DashboardLoading` servem a `/dashboard` (protegido) e a `/demo/dashboard`.

**Arranjo interno do card.** Em `category-donut.tsx`, o contêiner do modo "Gráfico" usa `flex flex-col items-center gap-4 md:flex-row md:items-center md:gap-8 lg:flex-col xl:flex-row`:
- a rosca tem tamanho fixo `h-[220px] w-[220px] shrink-0`;
- a legenda é uma `<ul>` `w-full min-w-0`; cada item tem marcador de cor (`shrink-0`), nome (`min-w-0 flex-1 truncate`), valor (`Money`, sem regra de encolhimento) e percentual (`w-14 text-right`).

**Causa do defeito.** A partir de `xl` (≥ 1280 px), o card ocupa só 4/12 da largura útil e o contêiner volta para `flex-row`. A rosca (220 px) + o espaço (`gap-8`, 32 px) + o padding do card deixam pouco espaço para a legenda. O nome encolhe até zero, mas o valor e o percentual não encolhem, e a linha da legenda passa da borda do card e, conforme a largura, da tela. Entre `lg` e `xl` o contêiner fica em coluna (`lg:flex-col`), por isso o defeito aparece principalmente em `xl`.

**O que já funciona e precisa continuar.**
- `ChartCard`: `figure` com `aria-labelledby` (título "Despesas por categoria"), `aria-describedby` (resumo textual completo com todas as fatias) e o alternador "Gráfico | Tabela" (`segmented`, botões `min-h-11`).
- Legenda: cada `li` tem `tabIndex={0}`, `aria-label` com nome, valor e percentual, e destaca a fatia por foco e por ponteiro (`data-active`, `ring-2`), sem depender só de cor.
- Tabela alternativa com todas as categorias e o total (`overflow-x-auto`, `tabIndex={0}`, `role="group"`).
- Estado vazio: "R$ 0,00", "Nenhuma despesa em <mês>" e o link "Ir para lançamentos", sem alternador.
- Agrupamento em até 5 categorias + "Outras" (`groupCategories`), com `title` listando as agrupadas em "Outras".
- Animação condicionada a `prefers-reduced-motion`; separador das fatias `--chart-sep`; card em vidro.

### 1.2 Testes existentes que tocam a área

| Arquivo | O que cobre hoje |
|---|---|
| `web/features/dashboard/_components/dashboard.spec.tsx` | `CategoryDonut`: legenda com "Outras", centro com o total, tabela alternativa, estado vazio, tooltip; skeletons anunciam o carregamento. |
| `web/features/dashboard/_components/charts-motion.spec.tsx` | Animação e destaque do donut pela legenda. |
| `web/features/dashboard/_components/dashboard-blocks.spec.tsx` | Renderização de `MonthlyChartBlock` e `CategoryDonutBlock`. |
| `web/e2e/theme-charts.pw.ts` | Legenda do donut e das barras troca de tema (swatches por token). |
| `web/e2e/a11y.pw.ts`, `web/e2e/glass.pw.ts`, `web/e2e/page-background.pw.ts`, `web/e2e/dark-theme.pw.ts`, `web/e2e/demo-shell.pw.ts` | Auditorias do dashboard (axe, vidro, fundo, tema escuro, demo). |

Não existe hoje teste de componente para `DashboardScreen`/`DashboardLoading` nem e2e que verifique overflow da legenda.

---

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Evolução mensal** | Card com o gráfico de barras dos 12 meses terminando no mês selecionado (`MonthlyChart`, bloco `MonthlyChartBlock`). |
| **Despesas por categoria** | Card com a rosca (donut) da distribuição das despesas do mês por categoria (`CategoryDonut`, bloco `CategoryDonutBlock`). |
| **Rosca (donut)** | O gráfico circular com o total de despesas no centro. Diâmetro atual: 220 px. |
| **Legenda** | Lista própria (`<ul>`) ao lado ou abaixo da rosca. Um **item de legenda** tem marcador de cor, nome da categoria, valor (R$) e percentual. |
| **Fatia "Outras"** | Fatia que agrupa as categorias a partir da 6ª. O item tem `title` com as categorias agrupadas. |
| **Tabela alternativa** | Visão "Tabela" do card, com todas as categorias (sem agrupar), valor, percentual e total. |
| **Arranjo lado a lado** | Legenda à direita da rosca, na mesma linha. |
| **Arranjo empilhado** | Legenda abaixo da rosca, ocupando a largura do card. |
| **Transbordar (overflow)** | Qualquer parte de um item de legenda (ou da tabela, fora da sua rolagem própria) ficar fora da caixa do card ou fazer a página rolar na horizontal. |
| **Largura total** | O card ocupa toda a largura da área de conteúdo do dashboard (a mesma largura do resumo do mês e da evolução mensal). |

---

## 3. Requisitos funcionais

### Posição dos cards

- **RF01 – Despesas por categoria abaixo da evolução mensal.** Em todos os breakpoints (360 px a ≥ 1440 px), o card "Despesas por categoria" fica abaixo do card "Evolução mensal". Nenhum breakpoint coloca os dois lado a lado.
- **RF02 – Largura total.** Os dois cards ocupam a largura total da área de conteúdo do dashboard, em todos os breakpoints. A evolução mensal deixa de ocupar 8/12 e passa à largura total.
- **RF03 – Ordem no DOM e de leitura.** A ordem no DOM, na navegação por teclado e no leitor de tela é: cabeçalho do dashboard → resumo do mês → evolução mensal → despesas por categoria. A ordem visual é a mesma (sem `order`/reordenação por CSS).
- **RF04 – Espaçamento.** O espaço vertical entre a evolução mensal e as despesas por categoria segue o espaçamento atual entre blocos do dashboard (`gap-4` no mobile, `gap-6` a partir do breakpoint que hoje usa `gap-6`), salvo ajuste do ui-designer.
- **RF05 – Skeleton coerente.** O estado de carregamento (`DashboardLoading` e os `fallback` de `Suspense` do `DashboardScreen`) reproduz o novo arranjo: `ChartSkeleton` em largura total e, abaixo, `DonutSkeleton` em largura total. O skeleton do donut reproduz o arranjo interno definido em B1, para não haver salto de layout ao trocar para os dados.
- **RF06 – Erro e atualização preservados.** Cada card continua com o próprio `BlockErrorBoundary` (mensagens atuais) e a própria `UpdatingRegion` (`scope="panel"`). Um erro em um card não afeta o outro; o card de erro também ocupa a largura total.
- **RF07 – Protegido e demo iguais.** O novo layout vale para `/dashboard` e `/demo/dashboard` (mesmo componente).

### Legenda contida no card

- **RF08 – Legenda nunca transborda.** Em qualquer largura de 320 px a ≥ 1920 px, com 1 a 6 itens de legenda, nomes de até 60 caracteres e valores de até "R$ 9.999.999.999,99" (limite de `Decimal(12,2)`), nenhum item de legenda sai da caixa do card e a página não ganha rolagem horizontal.
- **RF09 – Arranjo responsivo dentro do card.** Com o card em largura total:
  - quando houver espaço, a legenda pode ficar **ao lado** da rosca (arranjo lado a lado), sempre dentro do card;
  - em telas estreitas, a legenda fica **abaixo** da rosca (arranjo empilhado), ocupando a largura do card;
  - o ponto de troca entre os arranjos e a largura máxima da legenda são definidos pelo ui-designer (B1). A troca não pode depender de uma largura de card que não existe mais (o card deixou de ser 4/12).
- **RF10 – Nome trunca, valor e percentual ficam inteiros.** Em cada item, o nome é a parte que encolhe e trunca com reticências (`truncate`, regra atual). O marcador de cor, o valor (R$) e o percentual não encolhem, não quebram linha e não são cortados.
- **RF11 – Leitura do valor ao lado do nome.** Em largura total, a distância entre o nome e o valor de um item não pode deixar a linha difícil de ler (o valor não pode ficar "colado" na borda direita de um card de 1400 px longe do nome). O ui-designer define a largura máxima da legenda ou do bloco rosca + legenda (B1, PA3).
- **RF12 – Rosca sem mudança.** A rosca mantém o diâmetro de 220 px, o total no centro, o separador `--chart-sep`, o destaque da fatia ativa e o tooltip (B2).

### Acessibilidade e comportamento preservados

- **RF13 – Acessibilidade existente intacta.** Continuam iguais:
  - `figure` com nome "Despesas por categoria" e descrição textual completa (`aria-describedby`);
  - alternador "Gráfico | Tabela" com `aria-pressed`;
  - itens de legenda focáveis por Tab, com `aria-label` "<categoria>, <valor>, <percentual>", destacando a fatia por foco e por ponteiro, com anel visível;
  - tabela alternativa com todas as categorias, `caption`, cabeçalhos e total;
  - `title` do item "Outras" com as categorias agrupadas.
- **RF14 – Tabela alternativa contida.** Na visão "Tabela", a tabela ocupa a largura do card. Se não couber, rola dentro do próprio contêiner (`overflow-x-auto`, regra atual), sem rolagem horizontal da página.
- **RF15 – Estado vazio.** Sem despesas no mês, o card em largura total mostra o estado vazio atual (R$ 0,00, mensagem, link "Ir para lançamentos", sem alternador), centralizado no card.
- **RF16 – Dados intactos.** Nenhuma mudança em dados, agrupamento (até 5 + "Outras"), formatação (`Money`, `formatPercent`), textos ou cores. Os valores continuam vindo da API.

### Documentação

- **RF17 – Design system.** Registrar em `docs/design/design-system.md` (ou no doc de design do dashboard, a critério do ui-designer) o novo arranjo do dashboard e as regras da legenda (arranjos, ponto de troca, largura máxima, truncamento).

---

## 4. Requisitos não funcionais

- **RNF01 – Responsividade.** Sem rolagem horizontal da página em 320, 360, 390, 768, 1024, 1280, 1440 e 1920 px, nos dois temas, nos estados dados, vazio, erro, carregando e atualizando.
- **RNF02 – Acessibilidade (WCAG 2.1 AA).** `a11y.pw.ts` continua sem violações no dashboard. Reflow (1.4.10): em 320 px CSS (equivalente a 1280 px com zoom de 400%) o conteúdo do card fica legível sem rolagem em duas direções. Zoom de texto a 200% (1.4.4) não faz a legenda transbordar: o nome trunca e valor/percentual continuam visíveis.
- **RNF03 – Sem salto de layout.** A troca skeleton → dados não gera CLS perceptível (referência: ≤ 0,01 no dashboard, como CA20 da spec de vidro).
- **RNF04 – Sem regressão visual nos outros blocos.** O resumo do mês e o cabeçalho do dashboard não mudam. O gráfico de barras em largura total mantém as alturas atuais (`h-[260px] md:h-[280px] lg:h-[320px]`), a rolagem horizontal própria quando houver e o eixo Y fixo.
- **RNF05 – Sem movimento novo.** Nenhuma animação nova; a troca de arranjo da legenda ao redimensionar não anima.
- **RNF06 – Testes.** Todo código novo ou alterado tem teste. A garantia de "não transbordar" é verificada no navegador (e2e), já que o jsdom não calcula layout (TQ1).
- **RNF07 – Sem cor literal.** Nenhuma cor nova; se surgir, só em `web/app/styles/tokens.css` (`test/no-literal-colors.spec.ts` continua verde).

---

## 5. Critérios de aceite

### Posição dos cards

**CA01 – Ordem dos blocos no DOM**
- Given o dashboard renderizado com dados (protegido e demo)
- When percorro o DOM e a ordem de foco por Tab
- Then o `figure` "Evolução mensal" vem antes do `figure` "Despesas por categoria"
- And não há `order-*`, `flex-*-reverse`, `col-start-*` ou `row-start-*` alterando a ordem visual desses dois blocos.

**CA02 – Classes de layout sem colunas lado a lado**
- Given `DashboardScreen` e `DashboardLoading` renderizados (teste de componente)
- When inspeciono os contêineres dos dois blocos de gráfico
- Then nenhum deles tem `lg:col-span-8`, `lg:col-span-4` ou qualquer `*:col-span-N` com N < 12 (nem utilitário equivalente que os coloque lado a lado, como `lg:grid-cols-2` ou `lg:flex-row` no contêiner pai)
- And o contêiner pai empilha os dois em uma coluna em todos os breakpoints.

**CA03 – Largura total em todos os breakpoints**
- Given `/dashboard?month=2026-11` com dados, em 360, 768, 1024, 1280 e 1440 px
- When meço as caixas (`boundingBox`) dos cards "Evolução mensal" e "Despesas por categoria" e do resumo do mês
- Then os dois cards têm a mesma largura e o mesmo `x` (tolerância de 1 px), iguais aos da área de conteúdo do resumo do mês
- And o topo do card "Despesas por categoria" está abaixo da base do card "Evolução mensal".

**CA04 – Skeleton no mesmo arranjo**
- Given `/dashboard` em carregamento (`DashboardLoading` e os `fallback` de `Suspense`)
- When observo os skeletons
- Then o `ChartSkeleton` aparece em largura total e o `DonutSkeleton` abaixo dele, também em largura total
- And os textos "Carregando evolução mensal" e "Carregando despesas por categoria" continuam anunciados
- And a troca para os dados não desloca os blocos (CLS ≤ 0,01).

**CA05 – Erro isolado em largura total**
- Given a API de distribuição por categoria retornando erro e a de evolução mensal funcionando
- When abro o dashboard
- Then a evolução mensal aparece normalmente e, abaixo dela, em largura total, o card com "Não foi possível carregar as despesas por categoria." e a ação de tentar novamente
- And o inverso (erro só na evolução mensal) mostra o erro em cima e o donut embaixo.

**CA06 – Demo igual ao protegido**
- Given `/demo/dashboard`
- Then valem CA01–CA05.

### Legenda contida

**CA07 – Legenda dentro do card (caso do defeito)**
- Given `/dashboard` com 6 itens de legenda (5 categorias + "Outras"), em 1280 e 1440 px
- When meço a caixa de cada `li` da legenda e a caixa do `figure` "Despesas por categoria"
- Then a borda direita de todo `li` é ≤ à borda direita interna do card (descontado o padding) e a esquerda é ≥ à esquerda interna
- And `document.documentElement.scrollWidth` ≤ `window.innerWidth`.

**CA08 – Sem transbordo em nenhuma largura**
- Given a distribuição de pior caso: 6 itens, nomes com 60 caracteres sem espaços, valores "9999999999.99" e percentuais "100.00"/"0.01"
- When abro o dashboard em 320, 360, 390, 768, 1024, 1280, 1440 e 1920 px, nos dois temas
- Then nenhum `li` da legenda passa da caixa do card (CA07) e a página não tem rolagem horizontal
- And o `scrollWidth` da `<ul>` da legenda é ≤ ao seu `clientWidth`.

**CA09 – Nome trunca; valor e percentual inteiros**
- Given o cenário de pior caso do CA08 em 360 px
- When observo um item de legenda
- Then o nome aparece truncado com reticências (`text-overflow: ellipsis`, `scrollWidth` > `clientWidth` do elemento do nome)
- And o valor e o percentual aparecem inteiros, em uma linha, sem corte (`scrollWidth` ≤ `clientWidth` de cada um)
- And o `aria-label` do item continua com o nome completo, o valor e o percentual.

**CA10 – Arranjo empilhado em telas estreitas**
- Given o card com dados em 360 px
- When observo rosca e legenda
- Then a legenda está abaixo da rosca (topo da `<ul>` ≥ base da rosca) e ocupa a largura interna do card.

**CA11 – Arranjo em largura total**
- Given o card com dados em uma largura ≥ ao ponto de troca definido em B1 (ex.: 1024 e 1440 px)
- When observo rosca e legenda
- Then o arranjo é o definido em B1 (resposta padrão: legenda à direita da rosca, alinhada verticalmente ao centro, com largura máxima definida pelo ui-designer)
- And a legenda está inteira dentro do card (CA07).

**CA12 – Zoom de texto**
- Given o dashboard em 1280 px com zoom de texto de 200% (ou viewport de 640 px com `font-size` raiz dobrado)
- When observo a legenda
- Then nenhum item transborda o card e valor e percentual continuam visíveis.

### Acessibilidade e comportamento preservados

**CA13 – Destaque pela legenda**
- Given o card com dados no arranjo empilhado e no lado a lado
- When foco um item da legenda com Tab ou passo o ponteiro sobre ele
- Then a fatia correspondente fica destacada (`data-active="true"`) e o item mostra o anel de foco/destaque, como hoje
- And `charts-motion.spec.tsx` e os testes de `CategoryDonut` em `dashboard.spec.tsx` continuam verdes sem mudança de comportamento.

**CA14 – Tabela alternativa contida**
- Given o card em 360 px e em 1440 px
- When clico em "Tabela"
- Then a tabela lista todas as categorias e o total, dentro do card
- And se for mais larga que o card, rola dentro do contêiner `role="group"` "Tabela de despesas por categoria", sem rolagem horizontal da página.

**CA15 – Estado vazio em largura total**
- Given um mês sem despesas
- When abro o dashboard
- Then o card em largura total, abaixo da evolução mensal, mostra "R$ 0,00", "Nenhuma despesa em <mês>" e o link "Ir para lançamentos", centralizados, sem alternador.

**CA16 – Auditorias**
- Given o dashboard nos dois temas, nos estados dados, vazio, erro e atualizando
- When rodo `a11y.pw.ts`, `glass.pw.ts`, `theme-charts.pw.ts` e `dark-theme.pw.ts`
- Then todos passam (com ajustes só de localizadores, se necessários, sem afrouxar verificações).

---

## 6. Fora de escopo

- Qualquer mudança em `api/`, Prisma, banco ou contratos HTTP.
- O app mobile (`mobile/`), que já empilha a legenda abaixo da rosca.
- Mudar o tipo de gráfico (rosca → barras), as cores das séries, o agrupamento em 5 + "Outras" ou o conteúdo do tooltip.
- Mudar o gráfico de barras além da largura (alturas, eixos, legenda das barras, interação).
- Novos blocos no dashboard, reordenação do resumo do mês ou mudança do cabeçalho.
- Tooltip customizado para nomes truncados na legenda além do que já existe (ver PA4).
- Legenda interativa nova (ex.: clicar para esconder fatia).

---

## 7. Riscos

| # | Risco | Mitigação sugerida |
|---|---|---|
| R1 | **jsdom não mede layout.** Testes de componente só conseguem verificar classes, não o transbordo real. Um teste só de classes pode passar com a legenda ainda vazando. | Verificar classes no teste de componente (CA02) e o transbordo real em e2e com medição de caixas (CA03, CA07–CA12) (TQ1). |
| R2 | **Valor e percentual sem regra de encolhimento.** Mesmo em largura total, em 320–360 px um valor grande ("R$ 9.999.999.999,99") + percentual `w-14` + marcador podem não caber se o nome não encolher até zero. | RF10 e CA08/CA09 com dados de pior caso; o ui-designer decide se o valor pode quebrar para uma segunda linha em larguras muito estreitas (PA2). |
| R3 | **Legenda "esticada" em largura total.** Com `w-full` em um card de ~1400 px, o valor fica longe do nome e a leitura piora. | RF11; largura máxima da legenda definida pelo ui-designer (B1, PA3). |
| R4 | **Card de donut "vazio" em largura total.** Uma rosca de 220 px + 6 linhas em um card de 1400 px deixa muito espaço livre; pode parecer desbalanceado. | B1/B2: o ui-designer define o alinhamento (centralizado ou à esquerda) e se a rosca cresce. |
| R5 | **Ponto de troca baseado na viewport.** O arranjo interno hoje depende de breakpoints de viewport (`md`/`lg`/`xl`) calibrados para um card de 4/12. Se o card mudar de largura de novo no futuro, o defeito volta. | TQ2: basear a troca na largura do card (container query), não na viewport. |
| R6 | **Skeleton fora de sincronia.** `DashboardLoading` e os `fallback` de `Suspense` repetem o grid à mão; um pode ser atualizado e o outro não, gerando salto de layout. | RF05/CA04 cobrindo os dois; TQ3. |
| R7 | **Testes e2e com localização por posição.** Testes que dependem da posição lado a lado (se houver, ex. em `theme-charts.pw.ts` ou `glass.pw.ts`) podem falhar. | O tester revisa os e2e do dashboard na fase red (T3). |
| R8 | **Altura da página.** Com os cards empilhados, o dashboard fica mais alto no desktop e o donut sai da primeira dobra em telas baixas. | Aceito pela decisão do usuário (posição abaixo). Registrar no design. |

---

## 8. Perguntas em aberto

### Bloqueantes (mudam o resultado visível)

| # | Pergunta | Resposta padrão sugerida |
|---|---|---|
| **B1** | Com o card em largura total, qual o arranjo interno da rosca e da legenda? | **Lado a lado quando o card tiver largura suficiente** (referência: card ≥ ~640 px, o que cobre tablet e desktop), com a legenda à direita da rosca, centralizada verticalmente, e o bloco rosca + legenda com largura máxima (ex.: legenda até ~480 px, bloco centralizado no card). **Empilhado abaixo da rosca** quando o card for mais estreito (mobile), como no app mobile. Valores finais pelo ui-designer. |
| **B2** | A rosca continua com 220 px de diâmetro no card em largura total? | Sim. Mantém 220 px em todos os breakpoints, para não mudar a leitura do total no centro nem o skeleton. |
| **B3** | O gráfico de barras em largura total mantém a altura atual (até 320 px em `lg`) ou ganha mais altura por ter ficado mais largo? | Mantém as alturas atuais. Só a largura muda. |

### Técnicas (decisão do architect)

| # | Pergunta | Resposta padrão sugerida |
|---|---|---|
| **TQ1** | Como testar "não transbordar", se o jsdom não calcula layout? | Teste de componente para classes e ordem no DOM (CA01, CA02, CA04). Novo e2e Playwright do dashboard (ex.: `web/e2e/dashboard-layout.pw.ts`) com `boundingBox`, `scrollWidth`/`clientWidth` e as larguras do RNF01, usando uma distribuição de pior caso no stub (`web/e2e/stub-api/server.mjs`) (CA03, CA07–CA12). |
| **TQ2** | O ponto de troca do arranjo da legenda deve depender da viewport ou da largura do card? | Da largura do card, por container query (`@container` do Tailwind 4 no `figure` ou no contêiner do gráfico), para o arranjo ficar correto independentemente de onde o card estiver (R5). Se container query não for adotada, usar breakpoints de viewport recalibrados para o card em largura total. |
| **TQ3** | Manter o grid de 12 colunas com um bloco por linha ou trocar por uma pilha simples? E como evitar divergência com o skeleton? | Trocar o grid 8/4 por uma pilha (`flex flex-col` ou `grid grid-cols-1`) com o mesmo `gap` da tela, e extrair a estrutura dos dois blocos (ou a lista de classes) para ser compartilhada entre `DashboardScreen` e `DashboardLoading` (R6). |
| **TQ4** | Como garantir que valor e percentual não encolham? | `shrink-0` e `whitespace-nowrap` no valor e no percentual; o nome continua `min-w-0 flex-1 truncate`; a `<ul>` com `min-w-0` e `max-w-full`. |
| **TQ5** | Onde colocar os dados de pior caso para o e2e (nomes de 60 caracteres, valores no limite de `Decimal(12,2)`)? | Um cenário/mês dedicado no stub (`server.mjs`), sem afetar os cenários usados pelos outros e2e. |

### Premissas adotadas

- **PA1** – A posição "abaixo do gráfico de barras" vale para todos os breakpoints, inclusive desktop largo; não há breakpoint com os dois cards lado a lado.
- **PA2** – Em larguras muito estreitas (320–360 px), o item de legenda continua em uma linha, com o nome truncando. Se o ui-designer concluir que valor + percentual não cabem nem com o nome em zero, o valor pode ir para uma segunda linha dentro do item, nunca para fora do card.
- **PA3** – Em largura total, a legenda não ocupa a largura toda do card (RF11): tem largura máxima definida pelo ui-designer.
- **PA4** – O nome completo de uma categoria truncada continua disponível pelo `aria-label` do item e pela tabela alternativa. Não se adiciona `title` com o nome nos itens comuns (o `title` de "Outras" com as agrupadas permanece). O ui-designer pode propor o `title` se achar necessário, sem mudar o escopo.
- **PA5** – O resumo do mês, o cabeçalho do dashboard e o seletor de mês não mudam.
- **PA6** – O espaçamento entre os cards segue o `gap` atual da tela (`gap-4`/`gap-6`).
- **PA7** – O card de erro e o estado vazio seguem o mesmo arranjo de largura total dos cards com dados.

---

## 9. Testes existentes afetados

| Arquivo | Impacto |
|---|---|
| `web/features/dashboard/_components/dashboard.spec.tsx` | Testes do `CategoryDonut` continuam verdes. Ganha casos de classes do contêiner do gráfico (arranjo responsivo) e do item de legenda (valor/percentual sem encolher) e do `DonutSkeleton` no novo arranjo. |
| `web/features/dashboard/_components/charts-motion.spec.tsx` | Continua verde (destaque e animação inalterados). |
| `web/features/dashboard/_components/dashboard-blocks.spec.tsx` | Continua verde. |
| Novo: teste de componente de `DashboardScreen` / `DashboardLoading` | Ordem dos blocos no DOM e ausência de `col-span` < 12 / colunas lado a lado (CA01, CA02, CA04). |
| Novo: e2e do layout do dashboard (TQ1) | CA03, CA05–CA12, CA14, CA15. |
| `web/e2e/stub-api/server.mjs` | Cenário de pior caso para a distribuição por categoria (TQ5). |
| `web/e2e/theme-charts.pw.ts`, `web/e2e/glass.pw.ts`, `web/e2e/a11y.pw.ts`, `web/e2e/dark-theme.pw.ts`, `web/e2e/page-background.pw.ts`, `web/e2e/demo-shell.pw.ts` | Revisar localizadores que dependam da posição lado a lado; as verificações não são afrouxadas (CA16). |

---

## 10. Tarefas (ordenadas)

Todas `[web]`. Nenhuma tarefa `[api]` ou `[db]`.

1. **[web] T1 – Design (ui-designer).** Responder B1–B3: arranjo da rosca + legenda em largura total, ponto de troca para o arranjo empilhado, largura máxima da legenda, alinhamento no card, comportamento em 320–360 px (PA2) e skeleton correspondente. Registrar em `docs/design/` (RF17).
2. **[web] T2 – Arquitetura (architect).** Responder TQ1–TQ5 (estratégia de teste de layout, container query vs. breakpoints, estrutura compartilhada entre tela e skeleton, regras de encolhimento, dados de pior caso no stub).
   - **Gate: aprovação do usuário** (B1–B3 e visual da T1).
3. **[web] T3 – Testes (red) de componente.** `DashboardScreen` e `DashboardLoading`: ordem dos blocos e ausência de colunas lado a lado (CA01, CA02, CA04). `CategoryDonut` e `DonutSkeleton`: classes do arranjo responsivo e do item de legenda (CA09, CA10, CA11 no nível de classes). Revisar e2e existentes do dashboard (R7).
4. **[web] T4 – Testes (red) e2e de layout.** Cenário de pior caso no stub (TQ5) e novo e2e com medição de caixas e overflow nas larguras do RNF01, nos dois temas, em `/dashboard` e `/demo/dashboard` (CA03, CA05–CA12, CA14, CA15).
5. **[web] T5 – Layout da tela.** Em `dashboard-screen.tsx`, empilhar "Evolução mensal" e "Despesas por categoria" em largura total, mantendo `UpdatingRegion` e `BlockErrorBoundary` de cada bloco (RF01–RF04, RF06, RF07).
6. **[web] T6 – Skeleton.** Atualizar `dashboard-loading.tsx` e `DonutSkeleton` para o novo arranjo, sem divergir da tela (RF05, CA04).
7. **[web] T7 – Arranjo interno do donut.** Em `category-donut.tsx`, trocar o arranjo `md:flex-row lg:flex-col xl:flex-row` pelo definido em B1/TQ2, garantir que valor e percentual não encolham e que a legenda respeite a largura máxima (RF08–RF12, RF14, RF15), sem alterar a acessibilidade (RF13).
8. **[web] T8 – Verificação final.** `npm test`, cobertura, lint, `tsc`, build e Playwright + axe nos dois temas (CA13, CA16). Conferência manual em 360, 1280 e 1440 px, com zoom de 200%.
9. **[web] T9 – Documentação.** Design system / doc de design do dashboard (RF17), nota nesta spec com o status e entrada no `CHANGELOG.md`.
