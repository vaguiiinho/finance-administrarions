# web

Interface Next.js 16 (App Router) da aplicação de finanças. Visão geral e como rodar o projeto: [`../README.md`](../README.md).

## Rodar

```bash
npm install
API_URL=http://127.0.0.1:3001 npm run dev    # ver .env.example; a API deve rodar com PORT=3001
```

`API_URL` é lida apenas no servidor (o navegador nunca chama a API). Padrão do código: `http://127.0.0.1:3001`. A raiz `/` redireciona para `/entries` (com sessão) ou `/login` (sem sessão).

`DEMO_ACCOUNT_HINT` (lida só no servidor, por requisição; padrão desligada): com `on`, o login mostra a dica da conta demo ("usuário demo e senha demo") e rotula o primeiro campo "E-mail ou usuário". A credencial exibida é fixa no código, então a variável deve andar junto com `SHOWCASE_ACCOUNT_PASSWORD=demo` na API; ligue só onde a API tiver essa senha. Ver `.env.example`.

## Rotas

| Rota | Conteúdo |
|---|---|
| `/entries` | Resumo do mês e abas Despesas, Faturas e Receitas; drawer "Novo lançamento". Sem `month` na URL, resolve o mês inicial pela API e redireciona (ver abaixo) |
| `/login` | Entrar; com `DEMO_ACCOUNT_HINT=on`, mostra a dica da conta demo. `/demo/*` não existe mais (404) |
| `/cards` | Cartões (criar e editar) |
| `/dashboard` | Série de 12 meses e distribuição por categoria (Recharts) |

### Estado de `/entries` na URL

| Parâmetro | Valores | Observação |
|---|---|---|
| `month` | `YYYY-MM` | Ausente: `redirectToInitialMonth` consulta `GET /entries/initial-month` (timeout de 1,5 s) e redireciona com `replace`, mantendo os demais parâmetros. Fatura de cartão pendente mais antiga pode selecionar mês anterior a M; PIX antigo não conta. Falha ou timeout: `month` = mês atual em America/Sao_Paulo, sem aviso |
| `adv`, `adv_from` | `NEXT_PENDING` ou `NO_PENDING_AHEAD`; `YYYY-MM` | Sinal do aviso de avanço de mês. O cliente o remove da URL ao montar; valor inválido é ignorado |
| `d_status` | `PENDING` (padrão, omitido), `PAID`, `ALL` | Status de Despesas. `ALL` não é enviado à API |
| `f_status` | `PENDING` (padrão, omitido), `PAID`, `ALL` | Status de Faturas, independente de `d_status`. `ALL` não é enviado à API |

Valor inválido de status vale `PENDING`. A regra do mês inicial mora na API; o web só monta as URLs (`lib/filters/initial-month.ts`). Ver `../docs/adr/0009-mes-inicial-fatura-pendente-mais-antiga.md`.

## Testes

| Comando | Descrição |
|---|---|
| `npm test` | Vitest (inclui a matriz de contraste dos tokens nos dois temas) |
| `npm run test:cov` | Vitest com cobertura |
| `npm run pw:deps` | Baixa o Chromium do Playwright e as bibliotecas de sistema que faltam, sem root (uma vez) |
| `npm run test:e2e:local` | Playwright + axe com as bibliotecas de `pw:deps` no `LD_LIBRARY_PATH` (sem root) |
| `npm run test:e2e` | Playwright + axe (Chromium) contra o stub `e2e/stub-api`; para máquinas com as bibliotecas instaladas no sistema (ex.: CI com root) |
| `npm run lint` | ESLint |

### Playwright

A suíte (Chromium, tema claro e escuro, axe) roda contra o stub da API (porta 4010) e contra um **build de produção** do web (`next build && next start`, porta 3100), não contra `next dev`: o dev bloqueia recursos para a origem 127.0.0.1 e injeta um overlay que atrapalha cliques e o axe. O primeiro `test:e2e*` demora por causa do build.

**Não rode a suíte com um `next dev` (ou outro build) ativo neste diretório:** os dois usam o mesmo `.next` e corrompem o cache um do outro. Para iterar, é possível apontar para um `next dev` já em execução na porta 3100 (`reuseExistingServer`), desde que tenha `allowedDevOrigins` configurado.

Sem root (WSL, Ubuntu 24.04):

```bash
npm run pw:deps          # uma vez: instala o Chromium e extrai as libs ausentes (libnss3, libnspr4, libasound2t64...) via apt-get download + dpkg -x
npm run test:e2e:local   # roda a suíte com LD_LIBRARY_PATH apontando para as libs extraídas
```

Variáveis de ambiente da execução (lidas em `playwright.config.ts`, `e2e/support.ts` e `e2e/auth-login.pw.ts`; não afetam o código de produção):

| Variável | Padrão | Efeito |
|---|---|---|
| `PW_WEB_PORT` | `3100` | Porta do `next start` e do `baseURL` do Playwright. Útil para rodar ao lado de servidores já ativos |
| `PW_STUB_PORT` | `4010` | Porta do stub da API (`e2e/stub-api`), repassada como `API_URL` ao web |
| `PW_DEPS_DIR` | ver abaixo | Local das bibliotecas extraídas por `pw:deps` |

Para rodar um comando do Playwright com as bibliotecas de `pw:deps` no `LD_LIBRARY_PATH` (por exemplo, um arquivo ou um teste específico):

```bash
bash scripts/pw-deps.sh run npx playwright test e2e/initial-month.pw.ts
PW_WEB_PORT=3200 PW_STUB_PORT=4020 bash scripts/pw-deps.sh run npx playwright test
```

O stub aceita `POST /__scenario` com `now` e dados próprios (cenário `custom`), usados para o mês inicial; os cenários `initial-month-error` e `initial-month-slow` simulam falha e lentidão da leitura (`e2e/stub-api/server.mjs`).

As libs ficam em `${PW_DEPS_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/finance-pw-deps}`, fora do repositório; defina `PW_DEPS_DIR` para mudar o local. Nada é escrito em `~/.bashrc`. Se o `pw:deps` falhar por dependência transitiva, use a imagem oficial `mcr.microsoft.com/playwright:v<versão de @playwright/test>-noble` com o repositório montado e `--network host` (ADR 0002, T1). Com root: `npx playwright install --with-deps chromium` e `npm run test:e2e`.

### Sequência local dos gates

api: `test:cov`, `test:int`, `test:e2e`, `lint`, `typecheck`, `build`. web: `test:cov`, `lint`, `npx tsc --noEmit`, `build`, `pw:deps` (uma vez) e `test:e2e:local`. Não há CI configurado (ADR 0002, T3); para um CI futuro, usar runner Linux com root, Docker e `CI=1`. O RNF06 (`perf:rnf06` na api) não entra no CI.

### Smoke manual com API real

Postgres do compose, API com `PORT=3001 npm run start:dev`, web com `npm run dev`: (1) criar o cartão "Nubank" (fecha 25, vence 5); (2) criar despesa no cartão em 2026-10-26 e conferir "Fatura dez/26" e o toast (fechamento 25/11, vencimento 05/12); (3) pagar a fatura de dez/26 na aba Faturas; (4) conferir no dashboard de dez/26 o pago e o pendente coerentes com o resumo.

## Tema

Tokens em `app/styles/tokens.css` (`light-dark()`); preferência no cookie `theme`, lida no servidor pelo `app/layout.tsx`. Superfícies em vidro fosco (rev. 7): tokens `--glass-*` em `tokens.css` e papéis de superfície (`--card-bg`, `--bar-bg`, `--card-shadow` etc., com fallback opaco) em `app/styles/glass.css`; componentes usam as classes `.glass`, `.glass-flat`, `.glass-bar` ou os papéis, nunca `--glass-*` direto (`--header-bg` foi removido). Ver `../docs/design/design-system.md` e `../docs/adr/0004-superficies-vidro-fosco.md`.
