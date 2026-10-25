# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

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
- Follow-up: destaque temporário da linha recém-criada na lista (não implementado).
