# web

Interface Next.js 16 (App Router) da aplicação de finanças. Visão geral e como rodar o projeto: [`../README.md`](../README.md).

## Rodar

```bash
npm install
API_URL=http://127.0.0.1:3001 npm run dev    # ver .env.example; a API deve rodar com PORT=3001
```

`API_URL` é lida apenas no servidor (o navegador nunca chama a API). Padrão do código: `http://127.0.0.1:3001`. A raiz `/` redireciona para `/entries`.

## Rotas

| Rota | Conteúdo |
|---|---|
| `/entries` | Resumo do mês e abas Despesas, Faturas e Receitas; drawer "Novo lançamento" |
| `/cards` | Cartões (criar e editar) |
| `/dashboard` | Série de 12 meses e distribuição por categoria (Recharts) |

## Testes

| Comando | Descrição |
|---|---|
| `npm test` | Vitest (inclui a matriz de contraste dos tokens nos dois temas) |
| `npm run test:cov` | Vitest com cobertura |
| `npm run test:e2e` | Playwright + axe (Chromium) contra o stub `e2e/stub-api`; sobe o stub (4010) e o `next dev` (3100) |
| `npm run lint` | ESLint |

Para o Playwright: `npx playwright install-deps` (bibliotecas do sistema) e `npx playwright install chromium`.

## Tema

Tokens em `app/styles/tokens.css` (`light-dark()`); preferência no cookie `theme`, lida no servidor pelo `app/layout.tsx`. Ver `../docs/design/design-system.md`.
