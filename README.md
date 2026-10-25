# Finance Administrations

Aplicação de finanças pessoais com `api` (NestJS 12, Prisma 7, PostgreSQL) e `web` (Next.js 16 App Router, Tailwind 4, Recharts).

## O que a feature "Lançamentos financeiros" faz

- Registra **receitas e despesas**, por PIX ou cartão de crédito.
- Gerencia **cartões** (nome único, dia de fechamento e de vencimento).
- Calcula e grava o **mês de referência**: PIX usa o mês da data; cartão usa o **mês do vencimento da fatura**.
- Lista despesas e receitas por mês, com filtros (status, categoria, cartão/PIX), paginação e subtotal.
- Mostra **faturas** do mês por cartão, com "pagar fatura".
- **Paga despesas** individualmente ou em lote (tudo ou nada).
- Mostra **resumo do mês** (receitas, despesas pagas/pendentes, saldo realizado e previsto) e **dashboard** (série de 12 meses e distribuição por categoria).
- Tema claro/escuro com alternador sol/lua.

Telas: `/entries` (abas Despesas, Faturas, Receitas), `/cards`, `/dashboard`. A raiz `/` redireciona para `/entries`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `api/` | API HTTP sob `/api`, módulo `src/modules/finance` (domain, application, infrastructure, presentation) |
| `web/` | Interface Next.js; só o servidor chama a API (`API_URL`) |
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
| `npm run test:e2e` | Playwright + axe contra um stub da API (`web/e2e/stub-api`), Chromium |
| `npm run lint` | ESLint |

O Playwright precisa de bibliotecas do sistema e do navegador. Na primeira vez: `npx playwright install-deps` (pode exigir sudo) e `npx playwright install chromium`. O `test:e2e` sobe sozinho o stub (porta 4010) e o `next dev` (porta 3100); não usa a API real nem o banco.

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

- API: [`docs/api/finance.md`](docs/api/finance.md)
- ADR: [`docs/adr/0001-lancamentos-financeiros.md`](docs/adr/0001-lancamentos-financeiros.md)
- Design: [`docs/design/lancamentos-financeiros.md`](docs/design/lancamentos-financeiros.md) e [`docs/design/design-system.md`](docs/design/design-system.md)
- Histórico de mudanças: [`CHANGELOG.md`](CHANGELOG.md)
