# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Mês inicial pela fatura pendente mais antiga (ADR 0009)

#### Changed

- Ao abrir `/entries` ou `/demo/entries` sem `month`, uma fatura de cartão pendente anterior ao mês atual passa a prevalecer; a tela abre no mês de referência da fatura mais antiga. PIX antigo continua ignorado, e a regra existente segue valendo quando não há fatura antiga.
- A referência histórica já gravada é mantida; mês explicitamente informado e aviso de avanço para meses futuros não mudam.

#### Tests

- Cobertura de domínio, caso de uso, read model com Postgres, rotas protegida/demo, fixture compartilhada e Playwright para a fatura antiga e para a compatibilidade com PIX anterior.

### Listagem de lançamentos: mês inicial e status padrão orientados a pendências (ADR 0007)

#### Added

- API: `GET /api/entries/initial-month` e `GET /api/demo/entries/initial-month` devolvem `{ currentMonth, month, advance }` (`NONE`, `NEXT_PENDING`, `NO_PENDING_AHEAD`). Regra pura `resolveInitialMonth` no domínio, caso de uso `GetInitialEntriesMonth` e `PendingOverviewReadModel` (uma única consulta). Sem query: parâmetro informado gera 400 `UNKNOWN_FIELD`.
- API: `status=PENDING|PAID` opcional em `GET /api/invoices` e `GET /api/demo/invoices`, filtrado no SQL com `HAVING`. O filtro seleciona a fatura inteira (totais e contagens continuam sobre todas as despesas). `ALL` e outros valores geram 400 `INVALID_VALUE`.
- Web: `/entries` e `/demo/entries` sem `month` resolvem o mês inicial pela API e redirecionam (`replace`). Falha ou timeout de 1,5 s abre o mês atual, sem aviso.
- Web: aviso dispensável de avanço de mês (`MonthAdvanceNotice`), com o sinal `adv` e `adv_from` removido da URL ao montar.
- Web: filtro de status "Todos / Pendente / Pago" na aba Faturas (`f_status`), escondido para quem não tem cartão; `d_status` e `f_status` aceitam `PENDING`, `PAID` e `ALL`. Linha "Status: ..." abaixo de `md` nas abas Despesas e Faturas.
- Web: atalho de fatura paga "Ver despesas do cartão na aba Despesas", que abre `d_status=ALL`.
- Testes: unitários do domínio e do caso de uso, integração dos read models, e2e da API (`initial-month.e2e-spec.ts`), fixture `api/test/fixtures/initial-month.cases.json`, e2e Playwright `web/e2e/initial-month.pw.ts`, cenários `custom`, `initial-month-error` e `initial-month-slow` no stub e cenários de desempenho `IM1`, `IM2` e `I1 status=...` em `rnf06.perf-spec.ts`.
- Variáveis de teste `PW_WEB_PORT` e `PW_STUB_PORT` em `web/playwright.config.ts` (portas do web e do stub no Playwright; padrões 3100 e 4010).

#### Changed

- Despesas e Faturas abrem em "Pendente". `PENDING` é omitido da URL, `ALL` nunca é enviado à API e valor inválido vale "Pendente".
- "Limpar filtros" leva a "Todos" e fica visível sob o padrão "Pendente"; o contador "Filtros (n)" conta o padrão.
- Toasts pós-criação oferecem "Limpar filtros" quando o item não aparece (despesa PIX paga sob "Pendente"; compra no cartão sob "Pago" em Faturas), e "Ver <mês>" abre com "Todos".
- Foco após pagamento: sob "Pendente", a fatura ou a despesa individual paga sai da lista e o foco vai para o `h2` do painel; sob "Todos", o comportamento anterior é mantido.
- `ListInvoices` e `InvoiceReadModel.listByMonth` recebem `{ month, status? }`. Rotas públicas de demo: de 9 para 10.
- Docs: `docs/api/finance.md` (rotas novas, `status`, diagramas); ADR 0005 com notas de atualização (10 rotas de demo; `proxy.ts` em `/login`); notas "Superado" na spec e no design de origem (`lancamentos-financeiros.md`: CA61, RF19 a RF21, "Mês selecionado", seções 3.1, 3.3, 3.5, 3.6, 3.7, 3.9.2, 3.10, 3.12 e D6); ADR 0007 marcado como Aceito.

#### Notes

- Sem mudança de schema, migration ou dados; sem índice novo (a última migration segue `20261029000002_finance_ownership`).
- Divergência em relação ao ADR 0007 (seção 15): `parseExpenseStatus` não foi renomeado para `parsePaymentStatusFilter`; `ListInvoices` usa o alias `parseInvoiceStatus`, que delega a ele.
- O avanço de mês não tem limite de distância (risco R3 aceito): uma data digitada errada pode definir a abertura até a pendência ser paga.
- Execução e medições (p95 e `EXPLAIN` de `IM1`, `IM2` e `I1`) registradas em `docs/runs/listagem-mes-e-status-padrao.md`.

### Superfícies em vidro fosco e resumo do mês sem card externo (ADR 0004, design rev. 7)

#### Added

- Vidro fosco (translúcido, `backdrop-filter: blur(12px)`, borda clara de 1px) na navbar, cards, itens de lista, tabelas, bloco de fatura, subtotal, alertas e campos sobre a página, nos dois temas. Vidro de barra mais opaco (alfa 0,91 claro / 0,90 escuro) na navbar, `thead` sticky, barra de lote mobile e coluna sticky do gráfico. Itens de lista e contêiner da tabela usam vidro plano, sem desfoque.
- Tokens `--glass-bg`, `--glass-bg-2`, `--glass-input-bg`, `--glass-bar-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow` e `--chart-separator` em `web/app/styles/tokens.css`.
- `web/app/styles/glass.css`: papéis de superfície (`--card-bg`, `--card-bg-2`, `--field-bg`, `--bar-bg`, `--card-border`, `--card-shadow`, `--glass-filter`, `--item-filter`, `--chart-sep`) e fallback opaco único (sem `backdrop-filter`, `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors`, e contexto opaco em `dialog`, `.drawer`, `.modal` e `[data-surface="opaque"]`).
- Classes `.glass`, `.glass-flat` e `.glass-bar`.
- `web/lib/theme/glass.ts` (`classifyChain`, `expandUnders`, `compositeChain`, `worstOverLayers`, `separationRatio`) e testes: `glass.spec.ts`, `glass-css.spec.ts`, `web/e2e/glass.pw.ts`, `web/e2e/month-summary.pw.ts`. Cenário `short` no stub da API.

#### Changed

- Resumo do mês sem card externo: título "Resumo de <mês>" visível também no mobile, 3 cards de vidro independentes (empilhados no mobile, 3 colunas a partir de `md`), aviso de mês vazio abaixo dos cards. Mesmo layout em `/entries` e `/dashboard`. `<dl>` agora é válida (um nível de `div`). No mobile as linhas do Saldo reservam 44px (`min-h-11`, também no skeleton) para o CLS da troca skeleton → dados ficar <= 0,01.
- Contraste verificado no pior caso sobre o vidro composto sobre o gradiente (barra: também sobre o conteúdo que rola por baixo); nenhum mínimo afrouxado e nenhuma cor de texto trocada. `pageGradientFailures` (`web/e2e/support.ts`) passou a auditar textos sobre vidro e barra; `INCOMPLETE_ALLOWLIST` reduzida a `[data-navbar]`.
- Classes de componente de `globals.css` em `@layer components` e regras de elemento e `:focus-visible` em `@layer base`: os utilitários do Tailwind agora sobrescrevem as classes (corrige o "card dentro de card", o `pr-11` do combobox e o `-ml-3 -mt-2` do checkbox mobile). O `outline-none` do `<main tabIndex={-1}>` passou a valer.
- Grade do `MonthPicker` com `z-[35]` (acima das abas sticky e da barra de lote, abaixo da navbar e do toast); corrige defeito preexistente.
- Separadores de `monthly-chart.tsx` e `category-donut.tsx` usam `--chart-sep`.
- `docs/design/design-system.md` rev. 7: revoga "Transparência só em `--scrim`, `--header-bg` e sombras" e "Blur apenas em modais e headers fixos".

#### Removed

- Token `--header-bg` e o utilitário `bg-header` (substituídos por `--glass-bar-bg` e pelo papel `--bar-bg`).

#### Notes

- Pendente: medição manual de desempenho (CA14 / RNF05: Lighthouse mobile e trace de rolagem, registrar em `docs/runs/`). Se reprovar, o ajuste é `--item-filter` e depois `--glass-blur: 8px`.
- Desvios em relação ao texto original do ADR 0004 (`--glass-shadow` e papel `--card-shadow`, G10 por tema, `:focus-visible` em `@layer base`, `z-[35]`): "Adendo – implementação" do ADR. `prefers-reduced-transparency` não é suportado por todos os navegadores (ignorado onde faltar). Sem mudança em `api/`, contratos HTTP, schema ou migrations.

### Fundo em gradiente nos temas claro e escuro (ADR 0003, design rev. 6)

#### Added

- Fundo da página em gradiente fixo e estático: escuro "Grafite com brilho ciano" e claro "Lavanda → azul-gelo" (presets escolhidos pelo usuário). Camada `body::before` (`position: fixed`) em `web/app/globals.css`, em todas as rotas e nos estados de loading e erro.
- Tokens `--bg-stop-1..3`, `--bg-glow-1..2` e `--bg-gradient` em `web/app/styles/tokens.css`; `PAGE_BACKGROUND_TOKENS` em `web/lib/theme/contrast-pairs.ts`.
- Classe `.page-bg-window`: faixa de abas sticky de `/entries` mostra o mesmo trecho do gradiente (`background-attachment: fixed`).
- `web/lib/theme/gradient.ts` (amostras do gradiente e pior caso de contraste) e testes: `gradient.spec.ts`, `page-background.spec.ts`, `web/e2e/page-background.pw.ts`, auditoria `auditPageGradient` em `web/e2e/support.ts` e regiões de gradiente declaradas em `web/e2e/contrast.ts`.
- Teste permanente `web/test/background-preview-removed.spec.ts`, que garante que a pré-visualização temporária não deixou resíduos.

#### Changed

- `--bg` passa a ser a cor base do gradiente (`#ECEEFC` claro, `#181E2A` escuro). Todo par de contraste com `--bg` vale no pior caso contra as paradas, interpolações e brilhos; nenhum mínimo foi afrouxado e superfícies, textos e semântica mantêm os valores da rev. 5.
- `.segmented` e `.tablist` com fundo transparente; 2ª linha da navbar mobile sem fundo; `bg-bg` removido de `entries-tabs-bar.tsx` e `app-header.tsx`.
- `no-literal-colors.spec.ts` agora usa lista de arquivos autorizados com motivo (só `tokens.css`).
- `docs/design/design-system.md` rev. 6.

#### Removed

- Página temporária `/background-preview` (Fase A) e seus dados, testes e variável de ambiente.

#### Notes

- Limitação conhecida: no iOS Safari `background-attachment: fixed` é ignorado, e a faixa de abas mostra o gradiente relativo a ela (pequena diferença de tom, sem barra sólida).
- Desvios em relação ao ADR 0003 (premissa de `color-scheme` por seção, teste permanente de remoção, local de `auditPageGradient`): ADR 0003, seção 13. Sem mudança em `api/`, contratos HTTP, schema ou migrations.

### Changed

- Paleta suavizada (design rev. 5): fundo escuro `#151B26` em vez do quase preto `#0B0F1A`, texto e ciano menos contrastantes no escuro, fundo claro `#EEF1F5` com cartões brancos destacados; nova sombra `--shadow-card` (`--shadow-color` por tema) em cartões, blocos e tabelas apoiados no fundo. Todos os pares seguem >= 4,5:1 (texto) e >= 3:1 (não-texto).

### Fechamento de lançamentos financeiros (ADR 0002)

#### Added

- Combobox de categoria com botão de seta, placeholder "Selecione ou digite uma nova", estado vazio "Nenhuma categoria ainda. Digite para criar." e opção `Criar categoria "<texto>"` (substitui `Usar`); foco não abre a lista (F1).
- Follow-ups de UX: combobox ARIA de categoria com a opção `Usar "<texto>"`; destaque de ~2 s do lançamento recém-criado, respeitando mês, aba e filtros; faixa do mês selecionado; scroll-snap; uma única parada de Tab nos gráficos, com setas navegando e exibindo o tooltip; destaque do donut pela legenda; animações dos gráficos sob `prefers-reduced-motion`.
- Token `--accent-active` (claro `#0C6980`, escuro `#22D3EE`) para o `:active` do botão terciário (5,05:1 no claro).
- Suíte Playwright + axe executada de ponta a ponta (194 testes): botões em todos os estados (CDP `forcePseudoState`), gráficos nos dois temas, cartões (edição e 409), tema com diálogo aberto.
- Scripts web `pw:deps` e `test:e2e:local` (Playwright sem root; `web/scripts/pw-deps.sh`).
- Suíte de desempenho RNF06, opt-in (`npm run perf:rnf06` na api): 100 mil lançamentos, p95 máximo de ~47-52 ms entre os cenários; a série mensal do dashboard (D2) faz Seq Scan em `entries` e tem p95 de 26 ms. Resultados em `api/test/perf/results/` (ignorado pelo git).
- Fixture compartilhado `api/test/fixtures/invoice-dates.cases.json` (tabela CA21) consumido pelo domínio da api e pelo stub do web.

#### Changed

- Playwright passa a rodar sobre build de produção (`next build && next start`).
- Stub da API alinhado à API real: `PUT /api/cards/:id`, datas de fatura pelo mesmo cálculo (maior fechamento e vencimento, B9), cenário `many`, `holdMutations`, `holdQueries` e `delayMs`.
- Eixo Y fixo no gráfico mensal em telas estreitas.

#### Fixed

- Gráfico mensal estreito renderizava vazio após fixar o eixo Y.
- Contraste: `:active` do botão terciário (abaixo de 4,5:1 no claro) e botão carregando (`aria-busy`), que passa a manter as cores da variante, sem hover e com `cursor: progress`.
- Literais de cor removidos dos gráficos (tokens de tema).

#### Notes

- Desvio aprovado (B1): com diálogo modal aberto, o alternador de tema fica inerte sob o scrim; a troca só ocorre pelo tema do sistema sem preferência salva (spec RF27/CA84; design §12). Sem mudança de contrato HTTP, schema ou migrations.
- Sem CI configurado (G11 pendente).

### Added

- **Lançamentos financeiros** (ADR 0001, spec e design em `docs/`):
  - API sob `/api` com receitas e despesas (PIX e cartão), cartões, faturas, pagamento individual, em lote e de fatura, resumo do mês e dashboard (série de 12 meses e distribuição por categoria). Endpoints e erros em `docs/api/finance.md`.
  - Mês de referência calculado no domínio e gravado no lançamento: PIX pelo mês da data; cartão pelo mês do vencimento da fatura (`calculateInvoiceDates`).
  - Erros no formato `{ code, message, details }` com precedência 400 > 404 > 422 (409 para nome de cartão repetido).
  - Persistência PostgreSQL via Prisma 7 (`@prisma/adapter-pg`), 3 migrations com CHECKs e índices; UUID v7; valores `numeric(12,2)`.
  - Interface web (Next.js 16): `/entries` (abas Despesas, Faturas, Receitas, drawer de novo lançamento, pagamento em lote), `/cards` e `/dashboard` (Recharts).
  - Tema claro/escuro com `light-dark()` em `web/app/styles/tokens.css`, cookie `theme` e alternador sol/lua.
  - Testes: unitários (domain/application, cobertura mínima de 80%), integração com testcontainers, e2e com supertest; web com Vitest e Playwright + axe (contraste nos dois temas).
  - Scripts da api: `prisma:generate`, `prisma:migrate:deploy`, `test:cov`, `test:int`, `test:e2e`, `test:all`, `lint`, `typecheck`.
  - `README.md` na raiz, READMEs de `api/` e `web/`, `.env.example` em ambos.

### Changed

- `docs/design/design-system.md`: caminho dos tokens corrigido para `web/app/styles/tokens.css`; documentados o tema claro/escuro e a tabela completa de tokens.
- `api/README.md` e `web/README.md` substituídos pelos guias do projeto (antes eram os templates do Nest e do create-next-app).
- Layout raiz do web em `pt-BR`, com fontes Inter, Space Grotesk e JetBrains Mono, e `<html data-theme>` renderizado a partir do cookie.

### Removed

- `AppController`, `AppService` e testes de exemplo do template Nest.

### Notes

- Desvios aceitos em relação ao ADR e ao design: ADR 0001, seção 15; design de lançamentos, seção 12.
- O follow-up do destaque temporário da linha recém-criada foi implementado no fechamento (ver acima).
