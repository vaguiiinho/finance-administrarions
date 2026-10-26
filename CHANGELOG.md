# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Fechamento de lançamentos financeiros (ADR 0002)

#### Added

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
