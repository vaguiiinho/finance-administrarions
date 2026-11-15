# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Remoção da demonstração pública, login com dica e rotina da conta demo (ADR 0013)

#### Added

- API: `POST /api/auth/login` aceita o alias `demo` no campo `email` (sem diferenciar maiúsculas de minúsculas, ignorando espaços nas pontas), equivalente a `demo@showcase.invalid`. Valor de domínio `LoginIdentifier`; a chave do limite por identificador e a auditoria usam o e-mail canônico. Qualquer outro texto sem `@` continua 401 `INVALID_CREDENTIALS`.
- API: rotina da conta demo (`DemoAccountResetRoutine`, tarefa `reset-demo-account`) diária às 03:00 America/Sao_Paulo: apaga lançamentos e cartões da conta e restaura o dataset de exemplo (conta desativada: só apaga), sem revogar sessões. Na subida do processo roda como recuperação, só se não houve redefinição desde o último 03:00 (condição avaliada sob advisory lock). Tudo ou nada.
- API: `npm run demo:reset` (execução manual dentro do container, sem HTTP, redefine sempre; saída legível e JSON, código 1 em falha). Use case `ResetOwnerData`, port `OwnerDataResetStore` e tabela `owner_data_resets`.
- API: o seed grava o dataset de exemplo na conta demo quando ela está ativa (`sample-stale`).
- Web: dica da conta demo na tela de login ("Para testar, use o usuário demo e a senha demo.") controlada por `DEMO_ACCOUNT_HINT=on` (server-only, desligada por padrão); com a dica, o primeiro campo vira "E-mail ou usuário". Deve andar junto com `SHOWCASE_ACCOUNT_PASSWORD=demo` na API.
- Docs: ADR 0013, spec e design da feature; seção "Conta demo" no README raiz.

#### Changed

- Web: `/` sem sessão vai para `/login` e "Sair" leva a `/login` (antes `/demo/entries`). O primeiro campo do login passa a `type="text"` com `autoComplete="username"`.
- Web: textos da conta demo (`/privacy`, dica) e `DEMO_CLEANUP_TEXT` do app passam a dizer que a conta é "redefinida todos os dias às 03:00 (horário de Brasília)". O app mobile não ganhou dica nem mudou de rótulo; `demo`/`demo` funciona sem nova versão.
- Mobile/docs: credencial das notas de revisão da App Store passa a `demo`/`demo`, com dados de exemplo; rodar `npm run demo:reset` antes de enviar.
- Nginx: a regra de `/api/demo/` deixa de ser requisito do checklist (N4 exige só `/api/admin/`).
- Conta demo: estado inicial passa a ser o dataset de exemplo (antes, vazia).

#### Removed

- API: rotas públicas `GET /api/demo/*` (10 rotas) e o `DemoController`; passam a responder 404 `ROUTE_NOT_FOUND`. Saem `EnsureDemoUser`, `User.demo`, `DEMO_USER_ID`, `RefreshDemoDataset`, `PurgeShowcaseData`, `DemoDatasetStore`, `ShowcaseDataPurger` e `EntryRepository.deleteAllOf`.
- Web: telas `/demo/*`, `DemoBanner`, chip "Demonstração", botão "Entrar" da navbar, modo somente leitura (`WriteOnly`), `AppMode`/`basePath` e o link "Ver demonstração".

#### Migration

- `20261114000001_remove_public_demo_user`: exclui (uma vez, idempotente) o usuário da demonstração pública e as sessões, lançamentos, cartões e registro de dataset dele; passa a proibir `users.kind = 'DEMO'` por CHECK (o valor segue no enum do banco). Faça backup antes do deploy.
- `20261114000002_owner_data_resets`: `demo_datasets` vira `owner_data_resets` (`last_reset_at`, âncora e versão anuláveis, FK para `users`).

#### Notes

- **Primeiro deploy:** a conta demo é redefinida uma vez. Suba a API (migrations e seed) antes do web; entre os dois, o web antigo recebe 404 em `/demo/*`.
- Divergências entre o ADR e o código final: ADR 0013, seção 17. Notas de atualização nos ADRs 0005 (§6.5) e 0011 (§5.4).

### Dashboard: "Despesas por categoria" abaixo da evolução mensal (ADR 0012)

#### Changed

- Web: em `/dashboard` e `/demo/dashboard`, o card "Despesas por categoria" passa a ficar abaixo de "Evolução mensal", em largura total, em todas as larguras de tela (antes, grid 8/4 em `lg`). Pilha única e ordem fixa em `DashboardLayout`, usada pela tela e pelo skeleton de carregamento. Espaço entre os cards: 16 px até 767 px e 24 px a partir de 768 px.
- Web: rosca e legenda escolhem o arranjo pela largura do card (container query `@3xl`, 48rem), não pela viewport: empilhados abaixo, lado a lado a partir dele. Legenda com `max-w-md`.
- Web: no item da legenda, só o nome encolhe e trunca; valor e percentual não encolhem nem quebram (`shrink-0`, `whitespace-nowrap`).
- Web: o total no centro da rosca reduz a fonte conforme o comprimento do valor (`text-lg` até 13 caracteres, `text-base` até 15, `text-sm` até 17, `text-xs` acima), para caber no furo.
- Web: o nome da categoria no tooltip da fatia quebra com `break-words`.

#### Fixed

- Web: legenda do donut que transbordava o card em `xl`.
- Web: skeletons divergiam da tela (rosca de 200 px em vez de 220 px, altura das barras sem o passo `md`, padding e cabeçalho diferentes). Passam a usar as constantes de `web/features/dashboard/_components/chart-layout.ts`.

#### Tests

- 4 specs vitest novos (`dashboard-layout`, `dashboard-loading`, `dashboard-screen`, `category-donut-layout`) e `web/e2e/dashboard-layout.pw.ts` (68 testes). Stub e2e: cenários `category-distribution-error` e `monthly-evolution-error`.

#### Notes

- Pendência de verificação: o Playwright não rodou no ambiente de desenvolvimento (falta `libnspr4.so`); executar `dashboard-layout.pw.ts` em CI ou em máquina com as dependências do Chromium.
- Sem mudança em `api/`, contratos HTTP, schema ou `mobile/`. Primeira container query do projeto, registrada em `docs/design/design-system.md`.

### App mobile iOS, conta de demonstração e capacidades (ADR 0011)

#### Added

- `mobile/`: app iOS em Expo SDK 58 / React Native 0.88 / Expo Router (iOS 16.4+, iPhone, retrato). Login, lançamentos (criar, parcelar, editar, excluir com "Desfazer", pagar, pagar em lote, pagar fatura), cartões, faturas, resumo e dashboard (react-native-gifted-charts), troca de senha, token no Keychain (`expo-secure-store`), TanStack Query em memória e tratamento global de 426. Setup, perfis do EAS e publicação: `mobile/README.md`.
- Scripts do mobile: `test:rules`, `test:ui`, `test:coverage`, `check:shared`, `sync:shared`, `check:all`. Regras puras compartilhadas com o web por cópia byte a byte (`mobile/scripts/shared-files.mjs`; edite em `web/lib/` e rode `sync:shared`).
- CI: `.github/workflows/mobile.yml` (lint, typecheck, testes, verificação de deriva; build e submit no EAS em tags `mobile-v*`, com o segredo `EXPO_TOKEN`).
- API: cabeçalho `X-Client` (`mobile/<semver>`; ausente = web). Malformado: 400 `VALIDATION_ERROR` (`header.X-Client`, `INVALID_FORMAT`). Abaixo de `MOBILE_MIN_VERSION`: 426 `APP_UPDATE_REQUIRED` com `details: { minimumVersion, storeUrl }`, em toda rota casada, inclusive públicas.
- API: `accountKind` (`REGULAR` | `SHOWCASE`) e `capabilities` (`MANAGE_USERS`, `MANAGE_EXPENSES`, `CHANGE_OWN_PASSWORD`, `UPDATE_OWN_PROFILE`) em `POST /api/auth/login` e `GET /api/auth/me`.
- API: conta de demonstração `demo@showcase.invalid` (senha em `SHOWCASE_ACCOUNT_PASSWORD`; sem a variável a conta fica desligada), com lançamentos e cartões apagados todo dia às 03:00 America/Sao_Paulo. Não troca senha nem renomeia (403 `FORBIDDEN`).
- API: variáveis `MOBILE_MIN_VERSION`, `MOBILE_STORE_URL` e `SHOWCASE_ACCOUNT_PASSWORD` (`api/.env.example`).
- Web: páginas públicas `/privacy` e `/support`; `SUPPORT_EMAIL` (`web/.env.example`).
- Docs: `docs/api/identity.md` (autenticação, `X-Client`, capacidades, erros), `mobile/README.md`, seção "Deploy" no README, seção 12.3 do ADR 0011.

#### Changed

- API: `PUT` e `DELETE /api/entries/:id` passam a exigir a capacidade `MANAGE_EXPENSES` em vez do nível ADMIN. Qualquer conta autenticada (USER, ADMIN, demonstração) edita e exclui os **próprios** lançamentos; lançamento de outro dono responde 404 `ENTRY_NOT_FOUND` (antes, USER recebia 403).
- API: `POST /api/auth/login` e `GET /api/auth/me` respondem `Cache-Control: no-store`.
- API: 403 `FORBIDDEN` passa a trazer sempre `details: {}`.
- API: criar ou editar usuário com e-mail `.invalid` (reservado) responde 400 `INVALID_FORMAT` (antes, para o e-mail demo, 409 `EMAIL_TAKEN`). Dívida D5 resolvida; spec de autenticação (P06, CA17) atualizada.
- API: em `NODE_ENV=production`, `TRUST_PROXY` é obrigatória (inclusive no seed) e só aceita o IP/sub-rede do nginx; `true`, número de saltos, `loopback`, `uniquelocal` ou ausência derrubam o boot. `MAINTENANCE_INTERVAL_MS=0` agora desliga também a limpeza diária.
- API: autorização por capacidade (`@RequireCapability`) no lugar de `@RequireRole`; pré-políticas de cliente no `AccessControlGuard`; manutenção por tarefas (`interval` e `daily`).
- Web: "Editar" e "Excluir" despesas aparecem para quem tem `MANAGE_EXPENSES` (inclui USER); menu de conta usa `capabilities`.
- CLAUDE.md: gráficos passam a "Recharts (web)" e react-native-gifted-charts no mobile.

#### Notes

- Pendências (ADR 0011, 12.3): fluxos Maestro não executados e stub do web sem `X-Client`/426/showcase (I7); validação manual de gráficos, VoiceOver, Dynamic Type, Keychain real e `/diagnostics` com outro fuso; placeholders de ícone, splash, `ascAppId`, `appleTeamId`, `projectId` do EAS e URLs reais.
- Desvios de UI aceitos na v1: sem swipe nem menu de contexto, data `dd/mm/aaaa` sem date picker, sem SF Symbols nem háptica, sem barra "Concluído", "Sair" sem confirmação, categoria e cartão no formulário, iOS 16.4 (não 16.0), rótulo "Trocar senha", e "Trocar senha" visível e desabilitado na conta demo.
- Deploy: `SUPPORT_EMAIL` obrigatório no web; nginx N1-N10 (bloquear `/api/admin/*` e `/api/demo/*` no acesso público; web pela API via listener interno). Sem mudança de schema.

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
