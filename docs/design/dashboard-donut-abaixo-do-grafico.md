# Design: Dashboard, "Despesas por categoria" abaixo do gráfico de barras

**Spec:** `docs/specs/dashboard-donut-abaixo-do-grafico.md`
**ADR:** `docs/adr/0012-dashboard-donut-abaixo-do-grafico.md`
**Impacto em UI:** sim (só `web`, `/dashboard` e `/demo/dashboard`)
**Status:** aprovado e implementado (2026-11-02). Reflete o código final; as divergências em relação ao ADR 0012 original estão no §13 do ADR.

## Decisões (fecham B1-B3)

| # | Decisão | Por quê |
|---|---|---|
| B1.a | **Ponto de troca: `@3xl` (48rem, 768 px de largura do contêiner da rosca)**, e não o `@2xl` (42rem, 672 px) proposto no ADR. Abaixo: empilhado. A partir dele: lado a lado. | Em viewport de 768 px o contêiner mede 678 px sem barra de rolagem e cerca de 663 px com barra clássica. Com `@2xl` o arranjo de um tablet ficaria a 6 px da troca e mudaria conforme o navegador. Com `@3xl`, 768 px fica sempre empilhado (90 px de folga) e 1024 px sempre lado a lado (918 px de contêiner). A troca acontece entre 858 e 873 px de viewport, fora das larguras de teste. Continua sendo passo padrão da escala, como o ADR exige. |
| B1.b | **Legenda com `max-w-md` (28rem, 448 px) nos dois arranjos.** | RF11: no empilhado em 768 px uma legenda de 678 px afastaria demais o valor do nome. Em 320-375 px o limite não atua (contêiner < 448). |
| B1.c | **Bloco centralizado no card.** Lado a lado: rosca + `gap-8` + legenda (220 + 32 + 448 = 700 px) centralizado na horizontal, com a legenda centralizada na vertical em relação à rosca. Empilhado: rosca centralizada e, abaixo dela (`gap-4`), a legenda centralizada. | Card de ~1100 px com 700 px de conteúdo fica equilibrado no centro (R4). Alinhar à esquerda deixaria um vazio de 400 px à direita. |
| B2 | Rosca com 220 px em todas as faixas. | Igual ao ADR. |
| B3 | Barras mantêm `h-[260px] md:h-[280px] lg:h-[320px]`. | Igual ao ADR. |
| Gap | **Confirmado: 24 px entre os dois cards a partir de 768 px** (16 px abaixo disso). Entre 768 e 1023 px o espaço sobe de 16 para 24 px. | Fica igual ao espaço entre os demais blocos da pilha (cabeçalho, resumo). Sem exceção no `DashboardLayout`. |

Classes de referência (substituem as do ADR §5.2, mesmo mecanismo):
- arranjo: `flex flex-col items-center gap-4 @3xl:flex-row @3xl:justify-center @3xl:gap-8`
- legenda: `flex w-full min-w-0 max-w-md flex-col gap-2 text-sm @3xl:flex-1`

## Largura do contêiner da rosca por faixa

Coluna `max-w-[1280px] px-4 md:px-6 lg:px-8`, menu lateral de 240 px a partir de `xl`, card `p-4 md:p-5` com borda de 1 px. Medidas sem barra de rolagem clássica.

| Viewport | Contêiner | Arranjo | Legenda | Nome visível no pior caso* |
|---|---|---|---|---|
| 320 | ~254 px | empilhado | 254 px | ~12-18 px (só "…") |
| 375 | ~309 px | empilhado | 309 px | ~70 px |
| 768 | ~678 px | empilhado | 448 px, centralizada | ~206 px |
| 1024 | ~918 px | lado a lado | 448 px | ~206 px |
| 1440 | ~1094 px | lado a lado | 448 px | ~206 px |
| 1920 | ~1174 px | lado a lado | 448 px | ~206 px |

\* Pior caso: valor "R$ 9.999.999.999,99" (~150 px em `text-sm`) + percentual (`min-w-14`, 56 px) + marcador (12 px) + 3 espaços de 8 px, o que dá ~242 px fixos. Com valores reais ("R$ 1.234,56", ~75 px), o nome ganha mais ~75 px em todas as faixas.

## Layout da página

Ordem fixa em todas as faixas: aviso de mês (se houver) → cabeçalho → resumo → evolução mensal → despesas por categoria. Um bloco por linha, largura total, sem colunas.

```
320-767 px (gap 16)              768 px+ (gap 24; menu lateral a partir de 1280)
+----------------------+         +------+-------------------------------------+
| Cabeçalho / mês      |         | menu | Cabeçalho / mês                     |
| Resumo (cards)       |         |      | Resumo (cards)                      |
| Evolução mensal      |         |      | Evolução mensal (largura total)     |
|  [barras 260px]      |         |      |  [barras 280 / 320 px]              |
| Despesas p/ categoria|         |      | Despesas por categoria (larg. total)|
|  (empilhado)         |         |      |  (empilhado em 768, lado a lado 1024+)
+----------------------+         +------+-------------------------------------+
```

Aceito (R8): no desktop o donut pode ficar abaixo da primeira dobra.

## Card "Despesas por categoria" por faixa

**320 / 375 px (empilhado, legenda em largura total).** Em 320 px o título e o alternador quebram em duas linhas (o `flex-wrap` do `figcaption` já existe).

```
+--------------------------------+
| Despesas por categoria         |
| novembro de 2026               |
| [ Gráfico | Tabela ]           |
|           .-~~~~-.             |
|         /  Total   \           |
|        |de despesas|  220px    |
|         \ R$ 4.210 /           |
|           '-....-'             |
| ■ Alimentação…  R$ 1.234,56 29%|
| ■ Moradia       R$ 1.100,00 26%|
| ■ … (até 6 itens, "Outras")    |
+--------------------------------+
```

**768 px (empilhado, legenda de 448 px centralizada).**

```
+--------------------------------------------------------------+
| Despesas por categoria                   [ Gráfico | Tabela ] |
| novembro de 2026                                              |
|                         ( rosca 220 )                         |
|           ■ Alimentação             R$ 1.234,56   29,31%      |
|           ■ Moradia                 R$ 1.100,00   26,13%      |
|           |<----------- 448 px (max-w-md) ------------>|      |
+--------------------------------------------------------------+
```

**1024 / 1440 / 1920 px (lado a lado, bloco de 700 px centralizado).** Entre essas faixas só muda a margem lateral do bloco.

```
+------------------------------------------------------------------------------+
| Despesas por categoria                                   [ Gráfico | Tabela ] |
| novembro de 2026                                                              |
|                  .-~~~-.        ■ Alimentação        R$ 1.234,56   29,31%     |
|                /  Total  \      ■ Moradia            R$ 1.100,00   26,13%     |
|               | R$ 4.210 |     ■ Transporte         R$   800,00   19,00%     |
|                \         /      ■ …                                           |
|                  '-...-'        ■ Outras             R$   120,00    2,85%     |
|               |<-220->|<32>|<-------------- 448 ------------->|               |
+------------------------------------------------------------------------------+
```

## Hierarquia de informação (inalterada)

1. Título + mês. 2. Total no centro da rosca. 3. Legenda: nome → valor → percentual (`text-muted`). 4. Alternador Gráfico | Tabela. A cor nunca é a única pista: o nome está sempre na legenda.

## Item da legenda e truncamento

```
| ■ | Nome da categoria……………  (encolhe) | R$ 1.234,56 | 29,31% |
  12   min-w-0 flex-1 basis-0 truncate    shrink-0       min-w-14 shrink-0
                                          nowrap         nowrap, à direita
```

- Só o nome encolhe e trunca com reticências. Marcador, valor e percentual nunca encolhem, não quebram e não são cortados (RF10).
- O percentual com `min-w-14` alinha a coluna de percentuais entre as linhas.
- Pior caso em 320 px: o nome pode ficar só com "…". É aceito (PA2). O nome completo continua no `aria-label`, no tooltip da fatia e na visão "Tabela". Não há `title` nos itens comuns (PA4). O `title` de "Outras" fica.
- `flex-wrap` é só proteção: se marcador + valor + percentual não couberem nem com o nome zerado (zoom de texto em 320 px), o percentual desce para a 2ª linha **dentro** do item, alinhado à direita. Em 360 px+ sem zoom, uma linha só.
- Implementado: o nome no tooltip (`max-w-64`) usa `break-words`, pois 60 caracteres sem espaço passavam da caixa.

## Total no centro da rosca (pior caso)

O furo tem ~150 px (68% de 220). A área útil é de ~136 px. Regra: o valor **nunca trunca nem quebra** e o tamanho da fonte diminui pelo comprimento da string formatada.

| Comprimento | Exemplo | Classe |
|---|---|---|
| até 13 | "R$ 999.999,99" | `text-lg` (atual) |
| 14-15 | "R$ 99.999.999,99" | `text-base` |
| 16-17 | "R$ 999.999.999,99" | `text-sm` |
| 18 ou mais | "R$ 9.999.999.999,99" | `text-xs` |

Regra final no código (`category-donut.tsx`): `length` de `formatBRL` ≤ 13 `text-lg`; ≤ 15 `text-base`; ≤ 17 `text-sm`; senão `text-xs`. Os limites foram ajustados porque `.money` usa JetBrains Mono (0,6em por caractere) e o furo mede ≈ 149,6 px.

- O rótulo "Total de despesas" (`text-xs`) não muda.
- Entrou no escopo por decisão do usuário (o ADR original o deixava de fora; ver §13 do ADR). Sem cor nova e sem animação. Teste: classe por comprimento no Vitest. No e2e, o total "R$ 9.999.999.999,99" (uma categoria só) tem largura ≤ 150 px (pendente de execução).
- Com zoom só de texto (fonte raiz em 200%), o valor pode passar do furo. Continua legível porque fica por cima e `pointer-events-none`, e não gera rolagem porque o contêiner é bem mais largo que 220 px.

## Estados

| Estado | Comportamento |
|---|---|
| Dados | Como acima. |
| Vazio | Card em largura total, sem alternador: "R$ 0,00", "Nenhuma despesa em <mês>" e o botão "Ir para lançamentos", em coluna centralizada (`py-8`). Sem `@container`. |
| Tabela | Ocupa a largura do card e não usa `max-w`. Nomes completos, sem truncar. Se não couber (nome longo sem espaço em 320 px), rola dentro do grupo "Tabela de despesas por categoria" (`overflow-x-auto`, focável), e a página não rola. |
| Carregando | `DonutSkeleton` com as mesmas constantes de `chart-layout.ts`. `p-4 md:p-5`, cabeçalho comum `CHART_HEADER_SKELETON` igual ao `figcaption` (título `h-7` + subtítulo `h-5` sem gap = 48 px à esquerda; alternador `h-[46px]` à direita, com `flex-wrap`), círculo de 220 px e **6** barras de 28 px (`gap-2`) dentro da legenda `max-w-md`. Altura de referência: empilhado 220 + 16 + 208 = 444 px; lado a lado 220 px. O mesmo vale para o cabeçalho do `ChartSkeleton` com `MONTHLY_CHART_HEIGHT`. Objetivo: CLS ≤ 0,01. |
| Erro | `BlockErrorBoundary` atual (`card p-6`, ícone, mensagem, "Tentar novamente") no lugar do card, em largura total. Em 320 px o botão desce para a linha de baixo (o `flex-wrap` já existe). Não afeta o outro card. |
| Atualizando | `UpdatingRegion scope="panel"` sem `h-full`. Nada muda visualmente. |
| Hover / foco no item | Inalterado: `bg-surface-2 ring-2 ring-text` no `li` e fatia com `data-active`, contorno `--text` e 3 px. O anel (2 px, `box-shadow`) cabe no padding do card e não conta para o transbordo. Igual nos dois arranjos. |

## Fluxo de interação

1. A página carrega com os skeletons empilhados. Cada bloco troca para os dados de forma independente.
2. Tab: cabeçalho → resumo → evolução mensal (alternador, itens) → alternador do donut → itens da legenda, na ordem visual. Foco ou ponteiro em um item destaca a fatia. Ao perder o foco, o destaque sai.
3. Ponteiro sobre a fatia: tooltip com o nome completo, o valor e o percentual.
4. Ao clicar em "Tabela", a tabela entra no lugar da rosca. Ao clicar em "Gráfico", volta.
5. Ao redimensionar a janela, o arranjo troca em 768 px de contêiner, sem animação (RNF05).

## Componentes

- **Novos (estrutura, sem visual próprio):** `DashboardLayout` (pilha) e `chart-layout.ts` (classes do arranjo, `MONTHLY_CHART_HEIGHT` e `CHART_HEADER_SKELETON`; sem `"use client"`, pois os skeletons são Server Components), conforme o ADR §5.3.
- **Existentes alterados:** `CategoryDonut` (contêiner, item da legenda, escala do total), `DonutSkeleton`, `ChartSkeleton`, `DashboardScreen`, `DashboardLoading`.
- **Reusados sem mudança:** `ChartCard`, `Money`, `BlockErrorBoundary`, `UpdatingRegion`, `Skeleton`, `.segmented`, tokens `--chart-*` e `--chart-sep`.
- Nenhuma cor, token ou animação nova. Primeira container query do projeto: registrar em `design-system.md` (T9).
