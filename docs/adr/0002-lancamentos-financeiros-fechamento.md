# ADR 0002 - Fechamento de lançamentos financeiros: execução do Playwright, cobertura de UI, RNF06 e stub da API

- **Status:** Aceito em 2026-10-25 (T1-T5 decididas pelo architect; B1 e B2 aprovados pelo usuário com a resposta padrão)
- **Data:** 2026-10-25
- **Spec:** `docs/specs/lancamentos-financeiros-fechamento.md` (G1-G11, B1/B2, T1-T5, CAF01-CAF13)
- **Base:** `docs/adr/0001-lancamentos-financeiros.md` (rev. 3 + §15). Este ADR **não muda** domínio, contratos HTTP, schema Prisma nem migrations (PF07). Onde citar 0001 §8.7 e §11.5, vale o que está aqui.
- **Autor:** architect

## 1. Contexto e escopo

O fechamento não traz regra de negócio. As decisões aqui são de **infraestrutura de teste**: como executar o Playwright no WSL sem root (G2), como cobrir CA83 no navegador (G4), CI (G11), como medir o RNF06 (G8) e como alinhar o stub com a API real (G9). Bounded context e linguagem ubíqua: os do ADR 0001 §2, mais os termos da spec de fechamento §2.

Nada aqui entra em `api/src/` nem em `web/app`/`web/lib` de produção. Os artefatos novos ficam em `api/test/perf/`, `web/scripts/` e `web/e2e/`.

## 2. Decisões

### T1 - Chromium/Playwright sem root no WSL

**Decisão:** extrair as bibliotecas que faltam com `apt-get download` + `dpkg -x` num diretório **fora do repositório** e expor esse diretório só ao processo do Playwright via `LD_LIBRARY_PATH`.

- **Diretório:** `${PW_DEPS_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/finance-pw-deps}`. Fica ao lado do cache do navegador (`~/.cache/ms-playwright`), não é versionado (PF02) e sobrevive a `git clean`.
- **Script versionado:** `web/scripts/pw-deps.sh` (bash, `set -euo pipefail`), com três subcomandos:
  - `install`: roda `npx playwright install chromium` (não exige root), resolve o binário do Chromium/headless shell, lista as libs ausentes com `ldd <bin> | grep "not found"`, mapeia cada lib para o pacote (lista fixa `libnss3 libnspr4 libasound2t64|libasound2`, com fallback de nome para Ubuntu 22.04/24.04, mais o que `ldd` ainda acusar), faz `apt-get download` para um diretório temporário e `dpkg -x` de cada `.deb` em `$PW_DEPS_DIR`. É idempotente: pacote já extraído não é baixado de novo.
  - `check`: com o `LD_LIBRARY_PATH` montado, `ldd <bin>` não pode ter `not found`; sai com código diferente de zero e lista o que falta (trata RF2, dependências transitivas).
  - `run <cmd...>`: exporta `LD_LIBRARY_PATH="$PW_DEPS_DIR/usr/lib/x86_64-linux-gnu:$PW_DEPS_DIR/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"` e faz `exec` do comando. Nada é escrito em `~/.bashrc`.
- **Scripts npm (`web/package.json`):**
  - `"pw:deps": "bash scripts/pw-deps.sh install && bash scripts/pw-deps.sh check"`
  - `"test:e2e:local": "bash scripts/pw-deps.sh run playwright test"`
  - `test:e2e` continua como está (ambientes com as libs do sistema, por exemplo um runner de CI com root).
- O `LD_LIBRARY_PATH` também chega aos `webServer` (stub e `next dev`), que herdam o ambiente. É aceitável: só são adicionadas libs ausentes no sistema, sem sombrear as existentes, porque o `install` extrai apenas os pacotes cujas libs o `ldd` acusou.
- **Fallback documentado:** imagem oficial `mcr.microsoft.com/playwright:v<versão de @playwright/test>-noble` com o repositório montado e `--network host`, se o `dpkg -x` falhar por dependência transitiva sem solução. O Docker existe na máquina (os testcontainers da api já rodam), mas o fallback tem custo: os binários nativos de `node_modules` (lightningcss, swc) precisam bater com a glibc da imagem, e os `webServer` passam a rodar dentro do container.

### T2 - CA83: botões em todos os estados

**Decisão:** CDP `CSS.forcePseudoState` como mecanismo principal, mais um smoke com interação real por variante, e cenários do stub para "carregando" e desabilitado.

- **Pseudo-estados (hover, focus-visible, active):** helper `web/e2e/pseudo-state.ts` abre `page.context().newCDPSession(page)`, habilita `DOM` e `CSS`, resolve os `nodeId` dos botões da tela (`DOM.querySelectorAll` com os seletores das variantes: primário, secundário, terciário, perigo, ícone/alternador de tema, abas, paginação) e aplica `CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [estado] })` em lote. Assim, um único `audit()` por estado e por tema cobre todos os botões da tela. O projeto do Playwright já é só Chromium (RF5 aceito).
- **Smoke de fidelidade:** para cada variante, um teste com interação real (`hover()`, `keyboard.press("Tab")` para `:focus-visible`, `mouse.down()` sem `up` para `:active`) compara as cores computadas com as do estado forçado. Isso evita falso verde se o CSS depender de algo que o CDP não reproduz (por exemplo, `:focus-visible` disparado só por teclado).
- **Carregando e desabilitado:** vêm do stub (§2, T5): `holdMutations` mantém a ação pendente até `POST /__release`, de forma determinística e sem depender de timing; desabilitado usa os estados reais (por exemplo, "Pagar fatura" com `pendingCount = 0`, ou "Pagar selecionados" sem seleção).
- **Contraste:** o axe não avalia elementos desabilitados nem bordas. Por isso, o helper `web/e2e/contrast.ts` lê as cores computadas no navegador, faz a composição alfa subindo pelos ancestrais até um fundo opaco e calcula a razão. A matemática **reaproveita `web/lib/theme/contrast.ts`** (`parseColor`, `composite`, `contrastRatio`), importada pelo spec do Playwright no Node (a função é pura e já testada). Limites: texto >= 4,5:1, e ícone, borda (`--primary-border`), anel de foco e desabilitado >= 3:1, contra o fundo do botão e contra o fundo ao redor.
- **Resolução de `incomplete` do axe (revisão do code review):** o contraste computado só resolve nós cujo `messageKey` é `imgNode` (texto SVG) ou `elmPartiallyObscured`/`elmPartiallyObscuring`; qualquer outro `messageKey` (`bgImage`, `bgOverlap`, `fgAlpha`, `pseudoContent`...) falha. Mesmo nos resolvíveis, falha com opacidade efetiva < 1, `background-image` na cadeia de ancestrais ou sobreposição real (`elementFromPoint` no centro do nó não é o nó nem descendente). `audit()` devolve quantos nós resolveu e registra por tela (anotação `axe-incomplete-resolvido` e log `[axe]`). A allowlist da navbar não cresce. (Exceção de overlay do combobox aberto: ver §7, que prevalece sobre a regra de sobreposição acima.) Os estados "atualizando" do `a11y.pw.ts` e do `dark-theme.pw.ts` usam `holdQueries` no stub (GETs seguram até `POST /__release`) em vez de `delayMs`, e assertam que "Atualizando…" continua visível após o `audit()`.
- **Descartado:** só interação real em todos os casos (um estado por elemento por vez, lento e com risco de flakiness por hover residual); classes de teste no CSS do produto, como `.is-hover` (polui o código de produção e não testa o seletor real).

### T3 - CI

**Decisão:** **fora deste fechamento**, como sugere a spec (§6). O doc-writer registra no README do web (e o da api cita os comandos da api):
- a sequência local dos gates (RNFF03): api `test:cov`, `test:int`, `test:e2e`, `lint`, `typecheck`, `build`; web `test:cov`, `lint`, `tsc --noEmit`, `build`, `pw:deps` (uma vez) e `test:e2e:local`;
- a recomendação para um CI futuro: runner Linux com root (`npx playwright install --with-deps chromium`, sem o `pw-deps.sh`), Docker disponível para os testcontainers, `CI=1` (o `playwright.config.ts` já usa `retries: 1` e desliga o `reuseExistingServer` com `CI`). O RNF06 **não** entra no CI (§T4).
- G11 continua como pendência registrada. Consequência: o RNF11 só é verificado quando alguém roda a suíte localmente.

### T4 - Seed e medição do RNF06

**Decisão:** uma suíte **opt-in** em Vitest dentro de `api/test/perf/`, fora de `src/`, contra Postgres 17 descartável via **testcontainers**, medindo por HTTP a aplicação Nest real. O resultado vai para o registro de execução e não roda de forma recorrente. Isso substitui o texto de 0001 §8.7 (que já previa `PERF=1`) quanto a local, comando e forma de medir.

- **Arquivos:**
  - `api/vitest.config.perf.ts`: `include: ['test/perf/**/*.perf-spec.ts']`, `globalSetup: ['./test/support/global-setup-db.ts']` (mesmo container `postgres:17-alpine` e `prisma migrate deploy` das suítes int/e2e), `fileParallelism: false` e timeouts altos. O sufixo `.perf-spec.ts` não casa com o `include` das outras configs, então a suíte nunca roda em `test`, `test:int`, `test:e2e` nem `test:all`.
  - `api/test/perf/seed-volume.ts`: gerador determinístico (PRNG com semente fixa) de **100 mil lançamentos em 24 meses e 20 cartões**, com a distribuição de 0001 §8.7: ~15% receitas, ~40% das despesas no cartão, ~50% das despesas PIX pagas, ~10 categorias com grafia fixa por chave. Os cartões usam dias de fechamento e vencimento variados, incluindo 29-31 (dia efetivo), e os ids são UUID v7 (pacote `uuid`). Para despesas no cartão, as datas da fatura e o mês de referência são calculados com a **função de domínio `calculateInvoiceDates`** (import de código puro, sem framework), para que a massa satisfaça os CHECKs da migration 3 sem reimplementar a regra. A inserção é feita com `pg` (`INSERT ... SELECT * FROM unnest($1::uuid[], ...)` em lotes de 5 mil), seguida de `ANALYZE entries, cards`. **Não usa Prisma Client** (o Prisma continua só em `infrastructure`); as colunas seguem as migrations.
  - `api/test/perf/rnf06.perf-spec.ts`: sobe a aplicação com o mesmo bootstrap de `test/support/e2e-app.ts` (`AppModule` + `configureApp`, com o `CLOCK` fixo), mas com `app.listen(0)`, e mede com `fetch` real contra `http://127.0.0.1:<porta>`, não com supertest, para incluir serialização e a pilha HTTP.
  - `api/test/perf/p95.ts`: utilitário puro (`percentile(samples, 0.95)` por nearest-rank) com teste unitário próprio em `api/test/perf/p95.spec.ts`. Esse teste entra na suíte unitária normal.
- **Comando:** `npm run perf:rnf06` = `TZ=America/Sao_Paulo vitest run --config ./vitest.config.perf.ts`.
- **Medição:** para cada cenário, 5 aquecimentos e depois **50 amostras sequenciais** (sem concorrência, coerente com o fora de escopo); tempo de parede por `performance.now()` em volta do `fetch` + leitura do corpo; p95 por nearest-rank. Cenários: S1; E2 (página 1 e última; cada filtro; `status+cardId`, `category+status`, `cardId=pix`); E3; I1; I2 da maior fatura; I3; D2; D3; E6; C2. **I3 não usa rollback**: cada amostra paga uma fatura pendente diferente (20 cartões x 24 meses dão folga para 50 amostras). Cada cenário faz `expect(p95).toBeLessThan(300)`, então um estouro deixa a suíte vermelha e aciona B2.
- **Índices (regra de 0001 §7.3):** antes de cada cenário, `pg_stat_reset()`; depois, os deltas de `idx_scan` de `pg_stat_user_indexes` são registrados por cenário. Índice com zero uso em todos os cenários é candidato a remoção (tarefa 17, só se B2 for acionada). Isso também confirma ou descarta o RF4 (filtro por categoria). (Substituído pela §7: a medição passou a usar `EXPLAIN (ANALYZE, FORMAT JSON)`, sem `pg_stat_reset()`/`idx_scan`.)
- **Saída:** tabela no stdout e `api/test/perf/results/rnf06-<timestamp>.json` (diretório no `.gitignore`), com p50/p95/máx por cenário, os índices usados, o commit e a descrição do hardware. O doc-writer copia a tabela para o registro de execução.
- **Por que testcontainers e não o Postgres do `docker-compose.yml`:** não suja nem depende dos dados de desenvolvimento (`postgres_dev_data`), é reprodutível e usa a mesma imagem e versão (Postgres 17), o que atende PF06 quanto ao motor. A diferença de configuração entre o container e o compose é desprezível para leituras com índice.
- **Descartado:** autocannon (mede vazão concorrente, fora de escopo, e adiciona dependência); seed em SQL puro com `generate_series` (exigiria reescrever em SQL a regra das datas da fatura, uma segunda fonte da verdade, ou violaria os CHECKs); seed pelos use cases (100 mil `CreateEntry` levam minutos sem ganho de fidelidade, porque os CHECKs já garantem a consistência); teste recorrente (lento e sensível ao hardware).

### T5 - Stub do e2e x API real

**Decisão:** **espelhar** a regra no stub, com paridade garantida por uma **tabela de casos compartilhada**, e completar o stub. Não importar o domínio da api.

- **Por que não importar:** o stub é `.mjs` executado direto pelo Node no `web/`. O domínio é TS com aliases (`@shared/...`) e build próprio. Importá-lo exigiria loader/transpilação e acoplaria `web` a `api/src` (pacotes independentes). Espelhar custa ~25 linhas.
- **Regra espelhada:** `web/e2e/stub-api/invoice-dates.mjs` exporta `calculateInvoiceDates(date, closingDay, dueDay) -> { closingDate, dueDate, referenceMonth }` com as duas etapas de RF05 (dia efetivo = `min(dia, último dia do mês)`; fechamento no mês da compra se `dia <= fechamento efetivo`, senão no mês seguinte; vencimento no mesmo mês do fechamento se o dia efetivo for maior que o dia do fechamento, senão no mês seguinte; mês de referência = mês do vencimento). PIX e receita: `referenceMonth = date[0..7]`, `invoice = null`.
- **Paridade:** a tabela CA21 vira o fixture `api/test/fixtures/invoice-dates.cases.json` (`[{ date, closingDay, dueDay, closingDate, dueDate, referenceMonth }]`). Ela é consumida por (a) um `it.each` novo em `api/src/modules/finance/domain/billing/calculate-invoice-dates.spec.ts`, mantendo os testes atuais, e (b) `web/e2e/stub-api/invoice-dates.spec.ts`, que lê o JSON por caminho relativo. Para esse spec rodar no Vitest do web, o `exclude` de `web/vitest.config.mts` passa de `e2e/**` para `e2e/**/*.pw.ts`, já que o `include` só pega `*.spec.*`. Se a regra mudar na api e o stub não acompanhar, o spec do web quebra. O acoplamento é só de teste e só de leitura.
- **Completar o stub (`web/e2e/stub-api/server.mjs`):**
  - `PUT /api/cards/:id`: 404 `CARD_NOT_FOUND`; 409 `CARD_NAME_TAKEN` só para nome (case-insensitive) de **outro** cartão (renomear a caixa do próprio é permitido); `updatedAt` só muda se houver mudança efetiva; **não toca lançamentos** (CA05). O cenário `card-conflict` passa a valer para POST e PUT.
  - `POST /api/entries` usa `invoice-dates.mjs` com o fechamento e o vencimento atuais do cartão. Remove os valores fixos (`"2026-12"`, `2026-11-25`, `2026-12-05`).
  - `invoicesOf` passa a usar a maior `closingDate` e a maior `dueDate` (B9), como a API, em vez de `list[0]`.
  - Opções de cenário: `POST /__scenario { name, delayMs?, holdMutations? }`. `delayMs` atrasa os GETs `/api/*` (estado "atualizando", CAF06/CAF08). `holdMutations` segura POST/PUT até `POST /__release` (estado "carregando", CAF07).
- **SOLID no código atual que afeta a feature (stub, código de teste):** `server.mjs` é um handler único com cadeia de `if` por rota e uma cadeia de ternários para `failMode`, o que fere SRP e OCP: cada rota ou cenário novo mexe no mesmo bloco. Antes de somar PUT, atraso e hold, o tester deve extrair uma tabela de rotas `{ method, pattern, handler }` e um mapa `nome -> config` de cenários. Não é produção, mas é o arquivo que mais cresce neste fechamento.
- **Smoke manual (API real + web), registrado no README do web e executado uma vez no fechamento:** Postgres do compose, api com `PORT=3001 npm run start:dev`, web com `npm run dev`; (1) criar o cartão "Nubank" (fecha 25, vence 5); (2) criar uma despesa no cartão em 2026-10-26 e conferir "Fatura dez/26" e o toast com fechamento 25/11 e vencimento 05/12; (3) pagar a fatura de dez/26 na aba Faturas; (4) conferir no dashboard de dez/26 o pago e o pendente coerentes com o resumo. O resultado vai para o registro de execução. Um e2e automatizado web + API real fica descartado neste fechamento: exigiria orquestrar container, api e web no Playwright, um custo alto para o que o smoke cobre (RF3 mitigado, não eliminado).

## 3. Bloqueantes: aprovados pelo usuário (2026-10-25)

**B1 - Tema com drawer ou modal aberto (G7).** *Aprovado:* manter o design §2.2, com o fundo inerte sob o scrim (comportamento correto de diálogo modal, D7). O CA84 passa a ser lido como "a troca de tema que ocorre com um diálogo aberto (mudança do sistema sem preferência salva) preserva estado e cores". O `theme.pw.ts` verifica isso com `emulateMedia({ colorScheme })` com o diálogo aberto e sem cookie, e confere também que o botão de tema está inerte sob o scrim. O desvio fica registrado no design §12 e numa linha do histórico da spec de origem (CAF10). O ui-designer não entra. Se o usuário rejeitar, a alternativa é expor o alternador dentro do diálogo, o que muda o design e exige o ui-designer antes do tester.

**B2 - RNF06 bloqueia o fechamento?** *Aprovado:* bloqueia só se algum cenário de T4 tiver p95 >= 300 ms. Nesse caso, entram as tarefas 17 ([db] índices ou queries) e 18 ([api] read models, sem mudar o contrato, PF07), e a medição é refeita. Se todos passarem, só se registra o resultado (e os índices sem uso viram recomendação, não remoção obrigatória neste fechamento).

## 4. Impacto por área

| Área | Mudança | Camada |
|---|---|---|
| `api/src` | Nenhuma, salvo B2 acionado (tarefas 17-18) | - |
| `api/prisma` | Nenhuma migration, salvo índice decidido em B2 (migration nova, aditiva, `CREATE INDEX` comum: volume local, sem `CONCURRENTLY`) | infrastructure |
| `api/test` | `perf/` (seed, spec, p95), `fixtures/invoice-dates.cases.json`, `vitest.config.perf.ts`, script `perf:rnf06`, `.gitignore` de `perf/results/` | teste |
| `web/scripts` | `pw-deps.sh`, scripts `pw:deps` e `test:e2e:local` | ferramenta |
| `web/e2e` | stub completado e refatorado, `invoice-dates.mjs` + spec, `pseudo-state.ts`, `contrast.ts`, specs novos e ampliados (CAF06-CAF11) | teste |
| `web/app`, `web/lib` | Só as correções que o Playwright apontar (RFF02), sem tela nova | presentation (web) |

## 5. Plano de testes

- **Unitário api:** `p95.spec.ts` (nearest-rank, n=1, n=50, empates); `calculate-invoice-dates.spec.ts` consumindo o fixture compartilhado.
- **Unitário web:** `e2e/stub-api/invoice-dates.spec.ts` (mesmo fixture, paridade com a api).
- **Playwright (Chromium, dois temas):** `a11y.pw.ts` ampliado com os estados de G3 (CAF06); `buttons.pw.ts` (CAF07, T2); `dark-theme.pw.ts` com o estado "atualizando" via `holdQueries` (CAF08; `delayMs` substituído pela §7); `theme-charts.pw.ts` (CAF09); `theme.pw.ts` conforme B1 (CAF10); `cards.pw.ts` com a edição e o 409 inline (CAF11). A allowlist de `incomplete` não cresce (PF04).
- **Desempenho (opt-in):** `rnf06.perf-spec.ts` (CAF12).
- **Manual:** smoke API real + web (T5).
- **Gates (RNFF03):** cobertura >= 80% em domain/application inalterada (nenhum código novo em `src/`); web não cai abaixo dos números do registro de execução.

## 6. Trade-offs e riscos

- **dpkg -x:** é frágil a mudanças de distro (nomes `t64`) e a dependências transitivas. O `check` torna a falha explícita, e o fallback Docker existe.
- **CDP:** só Chromium (RF5). O smoke de fidelidade reduz o risco de o estado forçado divergir do real.
- **Medição sequencial em processo único:** não representa carga concorrente (fora de escopo) e depende do hardware local. Por isso, o hardware vai junto no resultado.
- **Regra espelhada no stub:** duplica uma regra de domínio no código de teste. O fixture compartilhado transforma divergência em teste vermelho, mas só para os casos da tabela.
- **Sem CI:** o RNF11 continua sem verificação recorrente (G11 aberto).

## 7. Notas de implementação (divergências em relação ao texto acima)

Onde houver conflito com as seções 2 a 6, vale o que está aqui e no código.

- **Playwright roda sobre build de produção.** O `webServer` do web usa `next build && next start -p 3100`, e não `next dev`. Motivos: o dev bloqueia recursos para a origem 127.0.0.1 (`allowedDevOrigins`) e a página não hidrata; e injeta o overlay de dev (`<nextjs-portal>`), que intercepta cliques e vira "partially obscured" no axe. `reuseExistingServer` continua ligado fora do CI. Build e `next dev` compartilham o mesmo `.next`: não rodar a suíte com um `next dev` concorrente no mesmo diretório. (T1 e T3 citavam `next dev`.)
- **`audit()` e `incomplete` do axe.** Resolve `incomplete` só para `imgNode` e `elmPartiallyObscured`/`elmPartiallyObscuring`, e rejeita o nó (falha) com opacidade efetiva < 1, `background-image` na cadeia de ancestrais ou sobreposição real. Exceção de overlay declarado: o nó pode ficar sobreposto apenas pela tela do combobox aberto (`[role="listbox"]`). A allowlist não cresceu.
- **Stub (`web/e2e/stub-api/server.mjs`).** Refatorado em tabela de rotas `ROUTES` (`route(método, padrão, handler)`) mais mapa de cenários `SCENARIOS` (`default`, `empty`, `many`, `error500`, `invoice-entries-error`, `batch404`, `batch422`, `card-conflict`). `many` cria 25 despesas extras em novembro (mais de 20 por página, habilita a paginação). Rotas: `GET /api/summary`, `/api/cards`, `/api/categories`, `/api/invoices`, `/api/entries/expenses`, `/api/entries/incomes`, `/api/cards/:id/invoices/:mês/entries`, `/api/dashboard/monthly-series`, `/api/dashboard/category-distribution`; `POST /api/cards`, `/api/entries`, `/api/entries/pay`, `/api/entries/:id/pay`, `/api/cards/:id/invoices/:mês/pay`; **`PUT /api/cards/:id`** (404, 409 só para outro cartão, não toca lançamentos). Controle: `POST /__scenario { name, delayMs?, holdMutations?, holdQueries? }` e `POST /__release`. `delayMs` atrasa GETs; `holdMutations` segura POST/PUT e `holdQueries` segura GET em `/api/*` até o `__release`. Datas da fatura vêm de `invoice-dates.mjs`.
- **RNF06: índices por EXPLAIN, não por `pg_stat_user_indexes`.** A medição de uso de índices por deltas de `pg_stat_reset()`/`idx_scan` (T4) foi substituída por `EXPLAIN (ANALYZE, FORMAT JSON)` de cada cenário na última amostra: as estatísticas dos backends do pool da aplicação não são acessíveis para flush, então os deltas não eram confiáveis. O resultado registra os índices usados por cenário a partir dos planos.
