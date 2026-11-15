# API de identidade (autenticação, conta, cliente e capacidades)

Documenta o que o código implementa em `api/src/modules/identity/presentation/http` e nos guards de identity. Decisões: `docs/adr/0005-autenticacao-autorizacao-demo.md` e `docs/adr/0011-app-mobile-ios.md`. Convenções gerais (prefixo `/api`, formato de erro, precedência) estão em `docs/api/finance.md`.

## Autenticação

Bearer token opaco: `Authorization: Bearer <token>`, emitido por `POST /api/auth/login`. Rotas públicas: apenas login e logout. As rotas `/api/demo/*` (demonstração pública) foram removidas e respondem 404 `ROUTE_NOT_FOUND` (ADR 0013).

### Cabeçalho `X-Client`

Identifica o cliente. Opcional.

| Valor | Cliente |
|---|---|
| ausente | `WEB` (o web não envia o cabeçalho) |
| `mobile/<MAJOR.MINOR.PATCH>` (ex.: `mobile/1.0.0`, cada parte com 1 a 4 dígitos) | `MOBILE` |
| qualquer outra coisa | 400 |

- **Malformado: 400** `VALIDATION_ERROR` com `details.fields = [{ "field": "header.X-Client", "code": "INVALID_FORMAT", "message": "Cabeçalho X-Client em formato inválido." }]`.
- **Versão abaixo da mínima: 426** `APP_UPDATE_REQUIRED`. A mínima vem de `MOBILE_MIN_VERSION` (padrão `1.0.0`); `storeUrl` vem de `MOBILE_STORE_URL` (ou `null`).

```json
{
  "code": "APP_UPDATE_REQUIRED",
  "message": "Atualize o aplicativo para continuar.",
  "details": { "minimumVersion": "1.2.0", "storeUrl": "https://apps.apple.com/br/app/id1234567890" }
}
```

- A verificação roda em **todas as rotas casadas**, inclusive as públicas (login, logout), antes da autenticação: um 426 vale mesmo sem token. Rotas inexistentes (404 `ROUTE_NOT_FOUND`) não passam por ela.
- `X-Client` não é controle de segurança: informá-lo não concede privilégio.
- Precedência numa rota protegida: `MALFORMED_JSON`/413 > 400 `X-Client` > 426 > 401 > 403 `PASSWORD_CHANGE_REQUIRED` > 403 `FORBIDDEN` > 429 > 400 > 404 > 422.

### `Cache-Control: no-store`

`POST /api/auth/login` e `GET /api/auth/me` respondem `Cache-Control: no-store`.

### Objeto `user` (login e `me`)

```json
{
  "id": "0192f3a4-6b1c-7d2e-8f90-a1b2c3d4e5f6",
  "name": "Maria",
  "email": "maria@example.com",
  "role": "USER",
  "mustChangePassword": false,
  "accountKind": "REGULAR",
  "capabilities": ["MANAGE_EXPENSES", "CHANGE_OWN_PASSWORD", "UPDATE_OWN_PROFILE"]
}
```

- `accountKind`: `REGULAR` ou `SHOWCASE` (conta de demonstração do app). Campo acrescentado; clientes antigos podem ignorá-lo.
- `capabilities`: calculada pelo domínio (`AccountCapabilities`) a partir de tipo e nível da conta. Os clientes decidem a visibilidade de ações por ela, não por `role`.

| Conta | `capabilities` |
|---|---|
| `REGULAR` + `ADMIN` | `MANAGE_USERS`, `MANAGE_EXPENSES`, `CHANGE_OWN_PASSWORD`, `UPDATE_OWN_PROFILE` |
| `REGULAR` + `USER` | `MANAGE_EXPENSES`, `CHANGE_OWN_PASSWORD`, `UPDATE_OWN_PROFILE` |
| `SHOWCASE` | `MANAGE_EXPENSES` |

## Endpoints

| Método | Rota | Acesso | Sucesso |
|---|---|---|---|
| POST | `/api/auth/login` | pública | 200 |
| POST | `/api/auth/logout` | pública | 204 |
| GET | `/api/auth/me` | sessão (permitida com troca de senha pendente) | 200 |
| PUT | `/api/account/password` | sessão (permitida com troca pendente); capacidade `CHANGE_OWN_PASSWORD` | 200 |
| PUT | `/api/account/profile` | sessão; capacidade `UPDATE_OWN_PROFILE` | 200 |
| GET, POST | `/api/admin/users` | capacidade `MANAGE_USERS` | 200 / 201 |
| GET, PUT | `/api/admin/users/:id` | `MANAGE_USERS` | 200 |
| POST | `/api/admin/users/:id/deactivate`, `/reactivate`, `/password-reset` | `MANAGE_USERS` | 200 |

### POST /api/auth/login

Corpo estrito: `{ "email": string, "password": string }`. `X-Client` opcional.

O campo `email` aceita o e-mail **ou o alias `demo`**, que vale como `demo@showcase.invalid` (conta de demonstração). O nome do campo não muda (compatível com o app publicado). Regras do identificador (`LoginIdentifier`):

- Sem diferenciar maiúsculas de minúsculas e ignorando espaços nas pontas: `demo`, `Demo` e ` demo ` são o mesmo alias.
- O alias vale **só** neste endpoint; a gestão de usuários continua exigindo e-mail (e recusa `.invalid`). O e-mail canônico `demo@showcase.invalid` continua funcionando.
- Qualquer outro texto sem `@` (`admin`, `ana`, `demo2`) é tratado como credencial inválida: 401 `INVALID_CREDENTIALS`, sem 400 de formato.
- Com o alias, `user.email` na resposta é `demo@showcase.invalid`. A chave do limite por identificador e o e-mail registrado na auditoria de falha são o e-mail canônico, então `demo` e o e-mail contam como o mesmo identificador.
- Conta de demonstração desligada (`SHOWCASE_ACCOUNT_PASSWORD` vazia) ou senha errada: 401 `INVALID_CREDENTIALS` genérico.

Exemplo (alias):

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "demo", "password": "demo" }
```

A resposta é a mesma de qualquer login (200 com `user` e `session`), com `"email": "demo@showcase.invalid"`, `"accountKind": "SHOWCASE"` e `"capabilities": ["MANAGE_EXPENSES"]`.

```json
{
  "user": { "id": "...", "name": "Maria", "email": "maria@example.com", "role": "USER",
            "mustChangePassword": false, "accountKind": "REGULAR",
            "capabilities": ["MANAGE_EXPENSES", "CHANGE_OWN_PASSWORD", "UPDATE_OWN_PROFILE"] },
  "session": { "token": "<token opaco>", "expiresAt": "2026-11-09T13:00:00.000Z" }
}
```

Erros (precedência): 400 `X-Client` > 426 > 429 `TOO_MANY_ATTEMPTS` (`details.retryAfterSeconds`) > 400 corpo > 401 `INVALID_CREDENTIALS`. A conta de demonstração não alimenta nem consulta o bloqueio por e-mail (5 falhas em 15 min); o limite por IP continua valendo.

### POST /api/auth/logout

Sem corpo; idempotente. 204. Erros: 400 `X-Client`, 426.

### GET /api/auth/me

Devolve o objeto `user`. Erros: 400 `X-Client`, 426, 401 `UNAUTHENTICATED`.

### PUT /api/account/password

Corpo estrito: `{ "currentPassword": string, "newPassword": string }`. Encerra as outras sessões do usuário (inclusive as do app).

Erros, na ordem: 400 `X-Client` > 426 > 401 > **403 `FORBIDDEN`** > 429 > 400 corpo (`currentPassword: INCORRECT`; `newPassword: REQUIRED`, `TOO_SHORT`, `TOO_LONG`, `SAME_AS_CURRENT`).

Para a conta `SHOWCASE` (sem `CHANGE_OWN_PASSWORD`) a resposta é sempre 403, **antes** de conferir a senha atual: nunca vira 400 `INCORRECT` nem conta tentativa.

### PUT /api/account/profile

Corpo estrito: `{ "name": string }`. A conta `SHOWCASE` (sem `UPDATE_OWN_PROFILE`) recebe 403 `FORBIDDEN`: não renomeia.

### Gestão de usuários (`/api/admin/users`)

Só `MANAGE_USERS` (REGULAR + ADMIN); os demais recebem 403 `FORBIDDEN`. Criar: `{ name, email, role, password }`; editar: `{ name, email, role }`; redefinir senha: `{ password }`. A conta de demonstração não aparece nem é endereçável (404 `USER_NOT_FOUND`).

**E-mails `.invalid` são reservados** (conta de demonstração, marcador do primeiro administrador): criar (`POST`) ou editar (`PUT`) um usuário com e-mail terminado em `.invalid` responde **400 `VALIDATION_ERROR`** com `fields: [{ "field": "email", "code": "INVALID_FORMAT", ... }]`, e não mais 409 `EMAIL_TAKEN`. `EMAIL_TAKEN` (409) continua para e-mail comum já usado. O primeiro administrador (`ADMIN_EMAIL`) também recusa `.invalid`.

## Erros

| HTTP | `code` | Quando | `details` |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Corpo ou cabeçalho inválido (inclui `X-Client` malformado e e-mail `.invalid` na gestão) | `{ fields: [...] }` |
| 401 | `UNAUTHENTICATED` | Token ausente, inválido ou expirado | - |
| 401 | `INVALID_CREDENTIALS` | Login inválido (inclusive e-mail ou alias inexistente, conta inativa, conta demo desligada) | - |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Troca de senha pendente em rota que não a permite | - |
| 403 | `FORBIDDEN` | Capacidade ausente | **`{}`** (sempre objeto vazio) |
| 404 | `USER_NOT_FOUND` | Usuário inexistente na gestão | - |
| 409 | `EMAIL_TAKEN` | E-mail comum já usado (criar/editar usuário) | `fields` |
| 422 | `CANNOT_TARGET_SELF`, `LAST_ADMIN` | Regras de administração | - |
| 426 | `APP_UPDATE_REQUIRED` | `X-Client: mobile/<v>` abaixo de `MOBILE_MIN_VERSION` | `{ minimumVersion, storeUrl }` |
| 429 | `TOO_MANY_ATTEMPTS` | Limite de tentativas | `{ retryAfterSeconds }` |

`403 FORBIDDEN` sempre traz `"details": {}`, nunca `null` nem ausente.

## Configuração relevante (API)

| Variável | Regra |
|---|---|
| `MOBILE_MIN_VERSION` | semver `X.Y.Z`; padrão `1.0.0` |
| `MOBILE_STORE_URL` | URL `https://`; vai em `details.storeUrl` |
| `TRUST_PROXY` | obrigatória em produção; só IP(s)/sub-rede do nginx (recusa `true`, número, `loopback`, `uniquelocal`); vale também para o seed |
| `SHOWCASE_ACCOUNT_PASSWORD` | lida só pelo seed; vazia/ausente desliga (inativa) a conta `demo@showcase.invalid`. Deve valer `demo` onde o web mostrar a dica (`DEMO_ACCOUNT_HINT=on`) |
| `MAINTENANCE_INTERVAL_MS` | `0` desliga também a rotina diária da conta de demonstração |

## Conta de demonstração (`SHOWCASE`)

- Login: e-mail `demo@showcase.invalid` ou o alias `demo`; senha definida por `SHOWCASE_ACCOUNT_PASSWORD` (1 a 72 caracteres, sem o mínimo de 8 das demais contas; só o seed a define). A convenção do projeto é `demo`/`demo`.
- Cria, edita, exclui e paga os próprios lançamentos (`MANAGE_EXPENSES`); não troca senha nem perfil (403).
- **Estado inicial:** com a conta ativa, o seed grava o dataset de exemplo (2 cartões e 12 meses até o mês corrente de America/Sao_Paulo, mais a fatura do mês seguinte).
- **Rotina diária:** todo dia às 03:00 America/Sao_Paulo a tarefa `reset-demo-account` apaga todos os lançamentos e cartões da conta e restaura o dataset de exemplo (conta desativada: só apaga). As sessões **não** são revogadas. Na subida do processo ela roda de novo como recuperação, mas só se ainda não houve redefinição desde o último 03:00 (condição `not-reset-since` avaliada sob lock no banco, tabela `owner_data_resets`), então reiniciar a API no meio do dia não zera a conta. Tudo ou nada: falha não deixa a conta pela metade.
- **Execução manual:** `npm run demo:reset` dentro do container (sem HTTP; não existe rota para isso). Redefine sempre, sem olhar a última execução. Imprime uma linha legível e uma linha JSON; código de saída 1 em falha.
- **Primeiro deploy:** a conta é redefinida uma vez (o seed grava o dataset de exemplo e descarta o que visitantes criaram). Também no primeiro deploy a migration `20261114000001_remove_public_demo_user` exclui o usuário da demonstração pública e os dados dele.

### Diagrama: login com alias e rotina da conta demo

```mermaid
flowchart TD
  L["POST /api/auth/login { email: 'demo' }"] --> I{LoginIdentifier}
  I -- "'demo' (trim, sem caixa)" --> E[demo@showcase.invalid]
  I -- "e-mail válido" --> E2[e-mail normalizado]
  I -- "outro texto" --> U[usuário nulo]
  E --> F[findByEmail + verificação de senha]
  E2 --> F
  U --> F
  F -- "ok, conta ativa" --> OK[200 user + session]
  F -- "falha, inativa ou inexistente" --> E401[401 INVALID_CREDENTIALS]

  T["03:00 America/Sao_Paulo / subida / npm run demo:reset"] --> S{estado da conta demo}
  S -- ausente --> SK[skipped]
  S -- inativa --> R1["reset sem dataset"]
  S -- ativa --> R2["reset com dataset de exemplo"]
  R1 --> C{condição sob lock}
  R2 --> C
  C -- "manual: always" --> W[apaga e restaura na mesma transação]
  C -- "agendada ou subida: não redefinida desde o último 03:00" --> W
  C -- "já redefinida" --> SK
```

## Exposição pelo nginx

Em produção a API fica atrás do nginx: o listener público bloqueia `/api/admin/*` (404; a regra de `/api/demo/*` deixou de ser requisito, pois a rota não existe mais); o web chama a API por um listener interno. Checklist N1-N10 no README raiz e no ADR 0011, seção 6.1.

## Diagrama: pré-políticas e capacidade

```mermaid
flowchart TD
  R[Requisição em rota casada] --> X{X-Client}
  X -- malformado --> E400[400 VALIDATION_ERROR header.X-Client]
  X -- mobile abaixo da mínima --> E426[426 APP_UPDATE_REQUIRED]
  X -- ok --> P{rota pública?}
  P -- sim --> H[handler]
  P -- não --> A{sessão válida?}
  A -- não --> E401[401 UNAUTHENTICATED]
  A -- sim --> C{capacidade exigida?}
  C -- ausente --> E403["403 FORBIDDEN (details: {})"]
  C -- ok --> H
```
