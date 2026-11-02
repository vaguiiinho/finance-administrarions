# Finance Administrations

Aplicação de finanças pessoais com `api` (NestJS 12, Prisma 7, PostgreSQL), `web` (Next.js 16 App Router, Tailwind 4, Recharts) e `mobile` (app iOS em Expo SDK 58 / React Native, iOS 16.4+).

## O que a feature "Lançamentos financeiros" faz

- Registra **receitas e despesas**, por PIX ou cartão de crédito.
- Gerencia **cartões** (nome único, dia de fechamento e de vencimento).
- Calcula e grava o **mês de referência**: PIX usa o mês da data; cartão usa o **mês do vencimento da fatura**.
- Lista despesas e receitas por mês, com filtros (status, categoria, cartão/PIX), paginação e subtotal.
- Mostra **faturas** do mês por cartão, com "pagar fatura".
- **Paga despesas** individualmente ou em lote (tudo ou nada).
- Mostra **resumo do mês** (receitas, despesas pagas/pendentes, saldo realizado e previsto) e **dashboard** (série de 12 meses e distribuição por categoria).
- Tema claro/escuro com alternador sol/lua, com fundo em gradiente fixo e estático (escuro grafite com brilho ciano, claro lavanda e azul-gelo).

Telas: `/entries` (abas Despesas, Faturas, Receitas), `/cards`, `/dashboard`. A raiz `/` redireciona para `/entries`.

### Mês inicial e status padrão de `/entries`

- **Mês inicial.** Abrir `/entries` (ou `/demo/entries`) sem `month` consulta a API (`GET /api/entries/initial-month`, demo: `GET /api/demo/entries/initial-month`) e redireciona para `?month=YYYY-MM`. Com `M` = mês atual em America/Sao_Paulo: pendência em `M` (fatura ou PIX) abre `M`; senão, abre o primeiro mês futuro com pendência; sem nenhuma pendência, abre `M+1` se houver cartão e `M` se não houver. Pendências de meses anteriores não contam. Um `month` na URL nunca é alterado. Falha ou timeout de 1,5 s da consulta abre `M`, sem aviso. Quando o mês avança, um aviso dispensável explica o motivo.
- **Status padrão.** As abas Despesas e Faturas abrem em "Pendente". `d_status` (Despesas) e `f_status` (Faturas) aceitam `PENDING`, `PAID` e `ALL`; `PENDING` é omitido da URL e `ALL` ("Todos") nunca é enviado à API. Valor inválido vale "Pendente". "Limpar filtros" leva a "Todos". Receitas não têm filtro de status.
- **Faturas.** `GET /api/invoices` aceita `status=PENDING|PAID`; o filtro seleciona a fatura inteira e sem `status` a resposta não muda. Para uma fatura paga, o atalho do bloco é "Ver despesas do cartão na aba Despesas" e abre `d_status=ALL`.

Decisão e divergências: [`docs/adr/0007-listagem-mes-e-status-padrao.md`](docs/adr/0007-listagem-mes-e-status-padrao.md).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `api/` | API HTTP sob `/api`, módulo `src/modules/finance` (domain, application, infrastructure, presentation) |
| `web/` | Interface Next.js; só o servidor chama a API (`API_URL`) |
| `mobile/` | App iOS (Expo SDK 58, iOS 16.4+); chama a API direto, com Bearer token no Keychain. Ver [`mobile/README.md`](mobile/README.md) |
| `docs/specs/` | Especificação de negócio |
| `docs/adr/` | Decisões de arquitetura (ADR 0001) |
| `docs/design/` | Design da feature e design system |
| `docs/api/` | Documentação dos endpoints (`finance.md`) |

## Pré-requisitos

- Node.js compatível com as dependências (Next 16, NestJS 12) e npm.
- PostgreSQL acessível (para rodar a API) e Docker (para os testes de integração).

## Como rodar localmente

### 1. Banco e API

```bash
cd api
npm install
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance"   # obrigatória
npm run prisma:generate
npm run prisma:migrate:deploy
PORT=3001 npm run start:dev
```

- `DATABASE_URL` precisa estar no **ambiente** do processo da API: ela não lê `.env` sozinha (use `api/.env.example` como referência) e falha ao subir sem a variável. O CLI do Prisma (`prisma.config.ts`) usa o valor acima como padrão se a variável faltar.
- A API escuta em `PORT` (padrão 3000, o mesmo do `next dev`). Use `PORT=3001` para casar com o padrão do web.
- `npm install` já executa `prisma generate` (`postinstall`).

### 2. Web

```bash
cd web
npm install
API_URL=http://127.0.0.1:3001 npm run dev    # ver web/.env.example
```

`API_URL` é lida só no servidor Next; o padrão do código é `http://127.0.0.1:3001`. Abra http://localhost:3000.

`SUPPORT_EMAIL` (só servidor) é o contato exibido em `/support`; em produção é **obrigatória** (a App Store exige um contato acessível). Sem ela, `next build` em produção apenas avisa, e `/support` fica sem e-mail. Páginas públicas novas: `/privacy` e `/support`.

### 3. Mobile (iOS)

```bash
cd mobile
npm install
npx expo start      # precisa de simulador iOS (macOS) ou dev client
```

URLs da API e do web em `mobile/.env.example` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`). Setup completo, perfis do EAS, TestFlight/App Store, conta demo e pendências: [`mobile/README.md`](mobile/README.md).

**Código compartilhado com o web.** As regras puras (dinheiro, datas, formulário, parcelas, feedback de pagamento, dados de gráfico, tipos da API) têm fonte da verdade em `web/lib/` e cópia byte a byte em `mobile/src/lib/`. A lista está em `mobile/scripts/shared-files.mjs`. Edite **no web** e rode `cd mobile && npm run sync:shared`; `npm run check:shared` (e o CI) falha se houver deriva. Nunca edite a cópia no mobile.

## Testes

### api (`cd api`)

| Comando | O que roda |
|---|---|
| `npm test` | Unitários (domain e application, sem I/O), `TZ=America/Sao_Paulo` |
| `npm run test:cov` | Unitários com cobertura (mínimo 80% em domain/application) |
| `npm run test:int` | Integração dos repositórios e read models com Postgres real via testcontainers (**requer Docker**) |
| `npm run test:e2e` | E2E dos controllers com supertest |
| `npm run test:all` | `test:cov` + `test:int` + `test:e2e` |
| `npm run lint` | oxlint com type-aware |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.build.json` |

### web (`cd web`)

| Comando | O que roda |
|---|---|
| `npm test` | Vitest (componentes, libs, matriz de contraste de tokens) |
| `npm run test:cov` | Vitest com cobertura |
| `npm run pw:deps` | Instala Chromium e bibliotecas ausentes sem root (uma vez) |
| `npm run test:e2e:local` | Playwright + axe contra um stub da API (`web/e2e/stub-api`), Chromium, sem root |
| `npm run test:e2e` | Mesma suíte, para máquinas com as bibliotecas no sistema |
| `npm run lint` | ESLint |

O Playwright sobe sozinho o stub (porta 4010) e um **build de produção** do web (`next build && next start`, porta 3100); não usa a API real nem o banco, e não deve rodar com um `next dev` ativo no mesmo diretório. As portas podem ser trocadas com `PW_WEB_PORT` e `PW_STUB_PORT` (variáveis só da execução dos testes, lidas em `web/playwright.config.ts`). Para rodar um comando do Playwright direto com as bibliotecas de `pw:deps` (sem root): `cd web && bash scripts/pw-deps.sh run npx playwright test`. Detalhes em [`web/README.md`](web/README.md). Medição de desempenho (opt-in): `cd api && npm run perf:rnf06`.

### mobile (`cd mobile`)

| Comando | O que roda |
|---|---|
| `npm run test:rules` | Vitest das regras puras |
| `npm run test:ui` | Jest + Testing Library (`TZ=America/Sao_Paulo`) |
| `npm run test:coverage` | Vitest com cobertura |
| `npm test` | `test:rules` + `test:ui` |
| `npm run check:shared` | Verifica deriva entre `web/lib` e `mobile/src/lib` |
| `npm run sync:shared` | Copia os arquivos compartilhados do web para o mobile |
| `npm run check:all` | lint + typecheck + check:shared + testes |

Os fluxos Maestro (`mobile/e2e/maestro`) ainda não foram executados (pendência I7 do ADR 0011).

## Deploy (produção)

- **API:** `TRUST_PROXY` é obrigatória com `NODE_ENV=production` (inclusive ao rodar o seed): apenas o IP do nginx, por exemplo `"172.30.0.10"`. `true`, número de saltos, `loopback`, `uniquelocal` ou ausência derrubam o boot. Também: `MOBILE_MIN_VERSION`, `MOBILE_STORE_URL`, `SHOWCASE_ACCOUNT_PASSWORD` (vazia desliga a conta demo) e `MAINTENANCE_INTERVAL_MS` diferente de `0` (senão a limpeza diária da conta demo não roda).
- **Web:** `SUPPORT_EMAIL` obrigatória; `API_URL` aponta para o listener **interno** do nginx.
- **nginx** (requisitos N1-N10, detalhe no ADR 0011, seção 6.1): TLS 1.2+ e HSTS (N1); `X-Forwarded-For $remote_addr` sobrescrevendo, nunca `$proxy_add_x_forwarded_for` (N2); listener interno não publicado, com `set_real_ip_from <IP do web>`, para o web (N3); no listener **público**, `location ^~ /api/admin/` e `^~ /api/demo/` respondem 404 (N4); só `/api/` roteado (N5); `client_max_body_size 128k` e `proxy_read_timeout 30s` (N6); log sem `Authorization` e `server_tokens off` (N7); `limit_req` no login recomendado (N8); IP fixo do nginx igual ao de `TRUST_PROXY` (N9); `X-Client` e `Authorization` repassados (N10).
- Ordem do primeiro deploy: nginx, API, web, teste manual (CA31 e `/api/admin/*` = 404 no host público), app.

## Regras de negócio resumidas

- Valores monetários trafegam como string decimal (`"1234.56"`); banco `numeric(12,2)`.
- Datas em UTC na API/banco; a interface exibe em America/Sao_Paulo.
- Receita: sempre PIX e nunca pode ser "paga". Despesa PIX nasce **paga** (use `paid: false` para pendente); despesa no cartão nasce **pendente**.
- Fatura do cartão: fecha no dia de fechamento do mês da compra se a compra ocorreu até esse dia, senão no mês seguinte; vence no primeiro dia de vencimento **estritamente depois** do fechamento. O mês de referência é o do vencimento. Exemplo: cartão fecha 10 / vence 20, compra em 15/10 fecha 10/11, vence 20/11, referência `2026-11`. Tabela completa em `docs/api/finance.md`.
- Dias 29-31 usam o último dia do mês quando ele não existe.
- Saldo realizado = receitas - despesas pagas; saldo previsto = receitas - todas as despesas.
- Pagamento não tem estorno; pagar de novo é no-op. Lote e fatura são atômicos.
- Precedência de erros: 400 > 404 > 422 (409 para nome de cartão repetido).

Detalhes, diagramas (camadas, aggregates, pagamento em lote) e exemplos de payload: [`docs/api/finance.md`](docs/api/finance.md).

## Documentação

- API: [`docs/api/finance.md`](docs/api/finance.md) e [`docs/api/identity.md`](docs/api/identity.md) (autenticação, conta, `X-Client`, capacidades)
- App mobile: [`mobile/README.md`](mobile/README.md), [`docs/adr/0011-app-mobile-ios.md`](docs/adr/0011-app-mobile-ios.md), [`docs/specs/mobile-app.md`](docs/specs/mobile-app.md) e [`docs/design/mobile-app.md`](docs/design/mobile-app.md)
- ADR: [`docs/adr/0001-lancamentos-financeiros.md`](docs/adr/0001-lancamentos-financeiros.md)
- Fundo em gradiente nos temas claro e escuro: [`docs/adr/0003-fundo-gradiente-temas.md`](docs/adr/0003-fundo-gradiente-temas.md), [`docs/specs/fundo-gradiente-temas.md`](docs/specs/fundo-gradiente-temas.md) e [`docs/design/fundo-gradiente-temas.md`](docs/design/fundo-gradiente-temas.md)
- Mês inicial e status padrão da listagem de lançamentos: [`docs/adr/0007-listagem-mes-e-status-padrao.md`](docs/adr/0007-listagem-mes-e-status-padrao.md), [`docs/specs/listagem-mes-e-status-padrao.md`](docs/specs/listagem-mes-e-status-padrao.md) e [`docs/design/listagem-mes-e-status-padrao.md`](docs/design/listagem-mes-e-status-padrao.md)
- Design: [`docs/design/lancamentos-financeiros.md`](docs/design/lancamentos-financeiros.md) e [`docs/design/design-system.md`](docs/design/design-system.md)
- Histórico de mudanças: [`CHANGELOG.md`](CHANGELOG.md)
