# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

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
