# ADR 0011 - Aplicativo mobile (iOS) com React Native, conta de demonstração e exposição da API via nginx

- **Status:** Aceito (2026-11-02), implementado em `feat/moble` e aprovado na revisão de código. As decisões de negócio B1-B9 (seção 0) estão **Decididas** pelo usuário. DM1-DM10 e DM12-DM16 do design aceitos; DM11 substituído por B6. P-ADR1 e P-ADR5 do design fechados aqui (seção 0). Divergências do código em relação ao texto abaixo e pendências: seção 12.3.
- **Data:** 2026-11-02 (rev. 2: decisões B1-B5; rev. 3: B5 login, B6-B9, DM11-DM16, P-ADR1, P-ADR5 e sinal de conta sem dados)
- **Spec:** `docs/specs/mobile-app.md` (rev. 3; a numeração de RF/CA citada aqui pode mudar)
- **Design:** `docs/design/mobile-app.md` (rev. 3, DM1-DM16, P-ADR1-P-ADR5)
- **Branch:** `feat/moble`
- **Relacionados:** ADR 0005 (identity, sessão, §6.2 IP, §6.5 demo, §6.6 guards, D11, D13), ADR 0007/0009 (mês inicial), ADR 0010 (parcelas), `docs/api/finance.md`, `docs/design/design-system.md`
- **Autor:** architect
- **Escopo:** `api/` (NestJS, Prisma 7, PostgreSQL), `web/` (Next.js 16), `mobile/` (novo, Expo/React Native)
- **Impacto em UI:** sim (app novo; web ganha `/privacy`, `/support`, passa a usar `capabilities` e mostra editar/excluir para USER)

---

## 0. Decisões de negócio (B1-B9) - Decididas

| Id | Decisão do usuário | Status | Onde impacta |
|---|---|---|---|
| **B1** | Em produção a API fica atrás de um proxy **nginx**. `TRUST_PROXY` confia **só** no nginx. O nginx sobrescreve `X-Forwarded-For` e bloqueia `/api/admin/*` (e `/api/demo/*`) no acesso público. Nenhum arquivo de infraestrutura novo é criado neste repositório: o ADR especifica o que a configuração do nginx (mantida fora do repo) precisa garantir. | **Decidido** | 6.1, 6.4, 8, 11 (CA31) |
| **B2/B2a** | A sessão mobile tem o **mesmo prazo do web: 24 h fixas**, sem renovação. Saem `SessionFamily`, `refresh_tokens`, `POST /api/auth/refresh`, `RefreshPolicy` e o prazo por tipo de cliente. Fica o **426 `APP_UPDATE_REQUIRED`**. | **Decidido** | 2, 3, 5, 6.2, 7, 10.8, 12.2 |
| **B3** | O app permite **pagar, editar e excluir** lançamentos, com as mesmas ações do web: pagar uma despesa, pagar em lote, pagar fatura, editar e excluir despesas (inclusive parcelas, que são despesas independentes, ADR 0010), além de criar despesa à vista, parcelada e receita. Só endpoints existentes; nenhum contrato de finanças muda. | **Decidido** | 6.5, 10.8, 10.9 |
| **B4** | A troca **obrigatória** de senha **não** é feita no app (o app orienta a trocar no site). Existe uma troca de senha **opcional** em Ajustes. | **Decidido** | 5.3, 10.10 |
| **B5** | Um usuário de demonstração **real**, **sem dados**, com todas as ações menos gestão de usuários. Substitui o modo demonstração `/api/demo/*` **no app** (o web continua usando `/api/demo/*`). **Login (rev. 3):** a pessoa digita o e-mail `demo@showcase.invalid` e a senha `demo`. Não há alias `demo` nem exceção de formato no login: o campo continua sendo um e-mail como para qualquer conta. O único caminho especial é o que **define** a senha curta, restrito a essa conta (3.5). | **Decidido** | 2, 3.3-3.5, 5.3, 6.2, 7, 9, 10.11 |
| **B6** | Qualquer usuário autenticado (ADMIN ou USER, inclusive a conta de demonstração) pode **editar e excluir os próprios lançamentos**, no app e no web. `MANAGE_EXPENSES` passa a ser concedida a toda conta que autentica. Lançamento de outro dono => **404** (nunca 403). No web, editar/excluir passam a aparecer para USER. | **Decidido** | 3.4, 6.5, 9, 10.8, 11, 12.1 (S7, S10) |
| **B7** | Limpeza da conta de demonstração: **job diário às 03:00 America/Sao_Paulo**, integrado ao `MaintenanceScheduler` (S9). Substitui "24 h após a criação". | **Decidido** | 4, 5.4, 7.3, 11, 12.1 (S9), 14 |
| **B8** | A conta de demonstração **não troca a própria senha**: a API responde **403 `FORBIDDEN` antes de conferir a senha atual** (spec CA48) e a UI esconde a opção (app e web). O bloqueio de **renomear o perfil** continua como estava. | **Decidido** | 3.4, 3.7, 5.3, 6.2, 9, 10.10, 10.11 |
| **B9** | A limpeza diária (B7) apaga **os lançamentos e os cartões** da conta de demonstração. | **Decidido** (padrão aceito) | 4, 5.4, 7.3, 10.13, 11, 14 |

Decisões de design (`docs/design/mobile-app.md`):

- **DM1-DM10:** aceitas. As que mudam este ADR: **DM8** (detalhe da fatura dentro da pilha da aba Finanças, 10.2) e **DM9** (teclado `decimal-pad` no Valor, 10.9).
- **DM11:** **substituída por B6**. Editar/excluir não dependem mais de `role`: aparecem para toda conta com `MANAGE_EXPENSES` em `me.capabilities` (na prática, toda conta autenticada) (10.8).
- **DM12-DM16:** aceitas, seguindo o web. DM14 ("Desfazer") existe **só no app** (o web não muda); seu mapeamento em endpoints está em 6.5 e o comportamento em 10.8. DM16 (pagar em lote, RF37) usa `POST /api/entries/pay` (6.5).
- **P-ADR1 (troca de senha pendente, design §5.3.1 e §6.2.1): Decidido = variante A ("só aviso")**, com o comportamento de 10.10: o app encerra a sessão (logout em melhor esforço, token não gravado ou apagado, cache limpo) e mostra a tela 6.2.1 sem tabs nem gesto de voltar, com "Abrir o site" (navegador do sistema, `/login` do web) e "Sair"/"Voltar ao login". A variante B (troca no app) fica descartada por B4. O `ChangePasswordForm` do app só existe em modo opcional.
- **P-ADR5 (como o app sabe que a conta é a demo): Decidido = campo `accountKind: 'REGULAR' | 'SHOWCASE'` em `GET /api/auth/me`** (e no `user` do login), 5.2/6.2. O app deriva `isDemoAccount = me.accountKind === 'SHOWCASE'` numa função pura (`src/core/account-kind.ts`, usada pelo `useIsDemoAccount` do design). **Proibido** comparar o e-mail no cliente. Um enum em vez de `isShowcase: boolean` para não abrir um booleano por tipo de conta no futuro; o efeito para o design é o mesmo ("conta demo: sim/não"). "Alterar senha" continua decidido pela capacidade `CHANGE_OWN_PASSWORD` e fica **oculto** (B8: "a UI esconde"), não desabilitado; `accountKind` só controla o aviso de limpeza.
- **Sinal de "conta sem dados"** (design 6.3.1/6.4.1): validado com ajuste em 10.13 (basta `GET /api/categories` vazio; a série de 12 meses deixa de fazer parte do sinal).

Premissas P01-P12 da spec adotadas, exceto o que B3-B9 alteraram (P04 "sem cadastro de cartão no app" continua valendo).

---

## 1. Contexto

O usuário quer um app iPhone (React Native) publicado na App Store com: entrar, dashboard, finanças (leitura e as ações do web sobre lançamentos e faturas), criação de despesas e receitas e troca opcional de senha.

Estado atual relevante (verificado no código):

- A API já autentica por **Bearer opaco** (`authentication.policy.ts`, `HmacSessionTokenIssuer`), sem cookie. O cookie `fa_session` só existe no web (BFF). O app usa o mesmo contrato, sem nenhuma mudança na sessão: `SessionPolicy` (24 h fixas) vale para os dois clientes.
- A API **não é exposta** hoje (ADR 0005 D11). `TRUST_PROXY` padrão `loopback, uniquelocal` (`bootstrap/env.ts:5`). O BFF repassa o `X-Forwarded-For` que recebeu (`web/lib/api/http.ts:43-69`). O limitador de tentativas é em memória.
- `AccessControlGuard` devolve `true` imediatamente para rotas `@Public()` (linha 24). Uma verificação que precise valer também para o login não pode ser uma `AccessPolicy` comum.
- **Autorização por nível:** `PUT /api/entries/:id` e `DELETE /api/entries/:id` exigem `@RequireRole('ADMIN')` (`entries.controller.ts:60,71`); o web só mostra editar/excluir para `role === "ADMIN"` (`web/app/(protected)/entries/page.tsx:16`, prop `canManageExpenses`, padrão `false`; a página pública `/demo` não passa a prop). Pagar e pagar fatura não exigem nível.
- **Escopo por dono já garantido:** `UpdateExpense` e `DeleteExpense` carregam o lançamento por `entries.findByIdsForUpdate(ownerId, [id])`, cujo contrato diz "ids inexistentes ou de outro dono não aparecem", e lançam `EntryNotFoundError` (404 `ENTRY_NOT_FOUND`). O `ownerId` vem do principal (`@CurrentOwnerId()`), nunca do corpo. B6 não precisa de mudança nesse ponto, só de teste de regressão (11.1).
- **Usuário demo atual:** `kind = 'DEMO'`, `passwordHash = null`, `role = USER`, id fixo `DEMO_USER_ID` (`well-known-ids.ts`), CHECK `users_demo_chk`. Não autentica (`User.canAuthenticate()` exige `REGULAR`; `AuthenticateSession` rejeita `kind !== 'REGULAR'`). É o dono dos dados de `/api/demo/*`, renovados pelo `RefreshDemoDataset`.
- **Login:** `loginBodySchema = { email, password }`; o use case faz `EmailAddress.create`; formato inválido cai em `INVALID_CREDENTIALS` (D13). `EmailAddress` aceita o TLD `.invalid` (`isReserved()` só o identifica). A chave do limitador por identificador é `rawEmail.trim().toLowerCase()` (`login-with-password.ts:46`), 5 falhas por 15 min (`attempt-policies.ts`).
- **Senha:** `PlainPassword.create` exige 8-72 code points (só ao definir); `forVerification` não tem regra de tamanho (D13). Logo, **entrar** com a senha `demo` já funciona sem exceção alguma; só **definir** essa senha exige um caminho próprio.
- **Troca obrigatória:** `PasswordChangePolicy` devolve 403 `PASSWORD_CHANGE_REQUIRED` em toda rota não marcada com `@AllowDuringPasswordChange()`; marcadas: `GET /api/auth/me` e `PUT /api/account/password`; `POST /api/auth/logout` é pública. `ResetUserPassword` e `RecoverAdminAccess` encerram todas as sessões do usuário; `ChangeOwnPassword` encerra todas menos a atual.
- **Manutenção:** `bootstrap/maintenance.scheduler.ts` roda, num único `setInterval` (`MAINTENANCE_INTERVAL_MS`, padrão 1 h; `0` desliga), `EnsureDemoUser`, `RefreshDemoDataset` e `PurgeExpiredSessions` em sequência, num único `try/catch` (uma falha pula as seguintes). Montado por factory em `app.module.ts` com as três dependências concretas. Não há noção de horário do dia.
- **Cartões:** tabela `cards` com `created_at`; `entries.card_id` com FK `RESTRICT` (um cartão só pode ser apagado sem lançamentos).
- **Categorias:** `GET /api/categories` (`ListCategories` -> `PrismaCategoryReadModel.listDistinct`) faz `SELECT DISTINCT ON (category_key) ... FROM entries WHERE user_id = $1`, sem filtro de mês nem de tipo. Não existe catálogo de categorias persistido: a lista é vazia **se e somente se** o usuário não tem nenhum lançamento. `docs/api/finance.md` descreve como "Categorias já usadas".
- **Seed:** o `CMD` da imagem da API roda `prisma migrate deploy && prisma db seed` a cada subida (`api/Dockerfile:28`); o seed (`bootstrap/seed/run-seed.ts`) é idempotente.
- No web, `web/lib/money/decimal.ts` (inclui `parseMoneyInput`), `web/lib/dates/format.ts`, `web/lib/entries/form.ts`, `web/lib/entries/installments.ts`, `web/lib/dashboard/chart-data.ts` e `web/lib/api/types.ts` são TypeScript puro. `web/lib/entries/feedback.ts` mistura mensagens puras com navegação por URL; a validação/payload da edição está dentro do componente `edit-expense-drawer.tsx`. `web/lib/auth/initial.ts` usa `Intl.Segmenter`, que o Hermes não implementa.
- Não há monorepo. `deploy.yml` faz `docker build` com contexto `./web` e `./api`. Não há compose de produção nem configuração de nginx no repositório (só `docker-compose.yml` de desenvolvimento com Postgres).

---

## 2. Bounded contexts e linguagem ubíqua

### 2.1 Contextos

- **Identidade e acesso** (`api/src/modules/identity/`): ganha **cliente** (`WEB`/`MOBILE`, versão do app), **compatibilidade de cliente** (versão mínima), **conta de demonstração** (`SHOWCASE`) e **capacidades** (o que um usuário pode fazer, derivado de tipo de conta e nível). Continua sem conhecer dados financeiros.
- **Finanças pessoais** (`api/src/modules/finance/`): contratos HTTP **inalterados**. Ganha um use case de manutenção (`PurgeShowcaseData`) e passa a proteger editar/excluir por capacidade em vez de nível. Com B6 o efeito prático é **liberar editar/excluir para USER** (sempre restrito aos lançamentos do próprio dono).
- **App mobile** (`mobile/`): novo cliente, no mesmo papel do BFF web (Customer da Published Language HTTP). Sem regras de negócio próprias além de validação de apoio e apresentação.
- **Shared kernel** (`api/src/shared/`): ganha `LocalTimeOfDay` (VO) e o port `DailyTimeCalculator` (horário civil de America/Sao_Paulo), usados pelo agendamento diário (5.4).

### 2.2 Linguagem ubíqua (código em inglês)

| Negócio | Código |
|---|---|
| Cliente (web / app) | `ClientKind = 'WEB' \| 'MOBILE'` (VO, `identity/domain/client`) |
| Versão do app | `AppVersion` (VO semver `MAJOR.MINOR.PATCH`) |
| Identificação do cliente na requisição | `ClientDescriptor { kind, appVersion }`, cabeçalho `X-Client: mobile/<versão>` |
| Versão mínima suportada | `MinimumAppVersionPolicy`, `AppUpdateRequiredError` (`APP_UPDATE_REQUIRED`, 426) |
| Sessão (web e app, 24 h) | `Session` (aggregate existente, **sem mudança**) |
| Conta de demonstração (e-mail `demo@showcase.invalid`) | `UserKind = 'SHOWCASE'`, `SHOWCASE_USER_ID`, `ShowcaseAccount` (constantes de domínio) |
| Tipo de conta exposto ao cliente (sinal "conta demo") | `accountKind: 'REGULAR' \| 'SHOWCASE'` em `CurrentUserDto` (P-ADR5) |
| Dados de demonstração públicos do web | `UserKind = 'DEMO'` + `/api/demo/*` (**existente, não confundir**: sem login, só leitura, só web) |
| Capacidade | `Capability = 'MANAGE_USERS' \| 'MANAGE_EXPENSES' \| 'CHANGE_OWN_PASSWORD' \| 'UPDATE_OWN_PROFILE'` |
| O que o usuário pode fazer | `AccountCapabilities.of({ kind, role })` (política pura) |
| Horário do dia (civil, São Paulo) | `LocalTimeOfDay` (VO `HH:MM`), `DailyTimeCalculator` (port) |
| Corte diário da limpeza (último 03:00 de São Paulo) | `cutoff` em `PurgeShowcaseData` |
| Limpeza diária da conta de demonstração (lançamentos e cartões) | `PurgeShowcaseData` (finance, application) |
| Tarefa de manutenção | `MaintenanceTask { name, schedule, run }` (bootstrap) |
| Conta sem lançamentos (sinal do cliente) | `isAccountEmpty(categories)` (mobile `src/core`, 10.13) |
| Desfazer (só app) | `DeferredActions` (exclusão adiada) e reenvio da edição (mobile `src/core`, 10.8) |

`LoginIdentifier` (rev. 2) **sai** da linguagem: com B5 rev. 3 o login é sempre um e-mail.

---

## 3. Modelo de domínio - identity

Tudo em `api/src/modules/identity/domain/`, sem Nest, Prisma ou `node:crypto`.

### 3.1 Value objects e políticas de cliente

| VO / política | Local | Regras |
|---|---|---|
| `ClientKind` | `domain/client/client-kind.ts` | `'WEB' \| 'MOBILE'`. |
| `AppVersion` | `domain/client/app-version.ts` | `^\d{1,4}\.\d{1,4}\.\d{1,4}$`; `compare(other): -1 \| 0 \| 1` numérico por segmento (`1.10.0 > 1.9.0`). |
| `ClientDescriptor` | `domain/client/client-descriptor.ts` | `{ kind; appVersion: AppVersion \| null }`. `WEB` => `appVersion = null`; `MOBILE` => `appVersion != null`. `parseClientHeader(raw: string \| undefined): Result<ClientDescriptor, 'INVALID_FORMAT'>`: ausente => `WEB`; `mobile/<semver>` => `MOBILE`; outra coisa => erro. |

```ts
// domain/client/minimum-app-version.policy.ts
export const MinimumAppVersionPolicy = {
  /** WEB sempre compatível. MOBILE abaixo de `minimum` => AppUpdateRequiredError. */
  assertSupported(client: ClientDescriptor, minimum: AppVersion, storeUrl: string | null): void,
};
```

O tipo de cliente **não é persistido** (ver 7 e 13): serve à compatibilidade (426) e à auditoria de login (RNF13), que é log.

### 3.2 `SessionPolicy` e `Session`

**Sem mudança.** 24 h fixas para web e app (B2). Sem `clientKind`, sem `familyId`, sem renovação. Um 401 no app significa "entre de novo".

### 3.3 Aggregate `User` (alterado) - conta de demonstração

`UserKind = 'REGULAR' | 'DEMO' | 'PENDING_FIRST_ADMIN' | 'SHOWCASE'`.

Constantes (`domain/user/showcase-account.ts`, puras):

```ts
export const ShowcaseAccount = {
  id: SHOWCASE_USER_ID,                 // shared/domain/well-known-ids.ts: '01900000-0000-7000-8000-0000000000d2'
  email: 'demo@showcase.invalid',       // o que a pessoa digita no login (TLD reservado, nunca entregável)
  name: 'Conta de demonstração',
} as const;
```

(rev. 3: `loginAlias` removido, B5.)

Invariantes novas (repetidas por CHECK no banco, 7.2):

1. `kind = SHOWCASE` => `id = SHOWCASE_USER_ID`, `email = ShowcaseAccount.email`, `passwordHash != null`, `role = USER`, `mustChangePassword = false`.
2. `canAuthenticate()` = `kind in (REGULAR, SHOWCASE) && status = ACTIVE`.
3. `isManageable()` continua só `REGULAR`: a conta não aparece em `/admin/users`, não pode ser editada, promovida, redefinida nem recuperada por `admin:recover` (todas já filtram por `isManageable`/`kind = 'REGULAR'`).
4. `isActiveAdmin()` continua só `REGULAR`: a conta nunca conta para `LAST_ADMIN`.

Comportamentos novos:

| Método | Regra | Evento |
|---|---|---|
| `User.showcase({ passwordHash, now })` | Cria com as constantes acima, `status = ACTIVE`. | `ShowcaseAccountProvisioned { userId, occurredAt }` |
| `replaceShowcasePassword(hash, now)` | Só para `SHOWCASE` (senão `InvariantViolationError`). Não mexe em `status` nem em `mustChangePassword`. Usado pelo seed quando a senha configurada muda. | `ShowcasePasswordReplaced { userId, occurredAt }` |
| `deactivate(now)` (existente) | Reaproveitado como **interruptor** da conta (seed com a conta desligada, 5.3). | `UserDeactivated` (existente) |
| `changePassword`, `rename` (existentes) | Não chamados para `SHOWCASE`: os use cases barram antes pela capacidade (3.4, B8). Por defesa em profundidade, ambos lançam `InvariantViolationError` se `kind = SHOWCASE`. | - |

### 3.4 Capacidades (política pura) e mitigações da conta de demonstração

```ts
// domain/user/account-capabilities.ts
export type Capability = 'MANAGE_USERS' | 'MANAGE_EXPENSES' | 'CHANGE_OWN_PASSWORD' | 'UPDATE_OWN_PROFILE';
export const AccountCapabilities = {
  of(account: { kind: UserKind; role: UserRole }): ReadonlySet<Capability>,
};
```

| Conta | Capacidades |
|---|---|
| `REGULAR` + `ADMIN` | `MANAGE_USERS`, `MANAGE_EXPENSES`, `CHANGE_OWN_PASSWORD`, `UPDATE_OWN_PROFILE` (comportamento atual) |
| `REGULAR` + `USER` | `MANAGE_EXPENSES` (**novo, B6**), `CHANGE_OWN_PASSWORD`, `UPDATE_OWN_PROFILE` |
| `SHOWCASE` (`USER`) | `MANAGE_EXPENSES` (B6; sem troca de senha nem perfil, B8) |
| `DEMO`, `PENDING_FIRST_ADMIN` | nenhuma (não autenticam) |

`MANAGE_EXPENSES` autoriza editar e excluir **os próprios** lançamentos; ela não amplia o alcance de dados. O escopo por dono é garantido em outra camada (repositório por `ownerId` do principal, 1 e 6.5): lançamento de outro usuário responde **404 `ENTRY_NOT_FOUND`**, nunca 403 (não revela existência). Criar, pagar, pagar em lote, pagar fatura, ler e sair continuam sem capacidade.

Por que manter `MANAGE_EXPENSES` se hoje toda conta autenticada a tem (alternativa: apagar a capacidade e o decorator de PUT/DELETE, como em pagar): os clientes (web e app) já decidem a visibilidade de editar/excluir por `capabilities` (S10); mantê-la conserva um único ponto de decisão no domínio e permite restringir de novo (por exemplo, um tipo de conta "somente leitura") sem mudar contrato nem clientes. Custo: um item a mais em `capabilities` que hoje está sempre presente.

Mitigações de segurança da conta de demonstração (B5, B7-B9):

| Risco | Mitigação |
|---|---|
| Visitante troca a senha e tranca a conta para todos (inclusive o revisor da Apple) | B8: sem `CHANGE_OWN_PASSWORD`: `PUT /api/account/password` => 403 `FORBIDDEN` antes de conferir a senha atual (CA48); o app e o web escondem a opção. |
| Visitante renomeia o perfil com texto ofensivo visto pelo próximo | Sem `UPDATE_OWN_PROFILE`: `PUT /api/account/profile` => 403 `FORBIDDEN` (mantido, B8). |
| Bloqueio da conta por tentativas erradas (`login-email-failures`, 5 falhas em 15 min) | A chave por identificador **não é consultada nem alimentada** quando o e-mail normalizado é `ShowcaseAccount.email` (a senha é pública; o bloqueio só serviria para negar acesso ao revisor). Não é exceção de formato: o e-mail passa pelo mesmo `EmailAddress.create` de qualquer conta; é só uma regra do limitador. Continua valendo o limite por IP (`auth-ip`, `AuthQuotaGuard`) e o N8 do nginx. Se o usuário preferir remover também esta regra, só 5.3 e 11.1 mudam. |
| Escalada de privilégio | `role` fixo `USER` por invariante e CHECK; `isManageable() = false` impede qualquer use case de administração de alterá-la. |
| Abuso de armazenamento, conteúdo ofensivo persistente (inclusive nome de cartão), dados de um visitante vistos por outro | B7/B9: `PurgeShowcaseData` apaga **lançamentos e cartões** da conta todo dia às 03:00 America/Sao_Paulo (5.4). A conta é compartilhada por definição; o app mostra um aviso (design). |
| Reutilização da senha `demo` como credencial de outra conta | Só o seed define o hash, por um caminho exclusivo (`PlainPassword.forShowcaseAccount`, 3.5); nenhum outro use case aceita senha com menos de 8 code points. |
| Precisar desligar a conta rapidamente (abuso, revisão concluída) | Interruptor por configuração: sem `SHOWCASE_ACCOUNT_PASSWORD`, o seed **inativa** a conta e encerra as sessões dela (5.3). Exige reinício do container. |
| Colisão com um usuário criado pelo admin com o mesmo e-mail | E-mail em TLD `.invalid`; se existir um usuário `REGULAR` com esse e-mail, o seed **não assume** a conta: registra erro e segue sem a conta de demonstração. Endurecimento (dívida D5, **resolvida**): `parseNewUser` e a edição de usuário rejeitam e-mails `isReserved()` com 400 `INVALID_FORMAT`; o comportamento do seed diante de uma linha legada é o descrito em 5.3. |
| Dados reais expostos | A conta é dona só dos próprios dados; o isolamento por dono (CA29) vale como para qualquer usuário. |

### 3.5 Value objects de credencial (alterados/novos)

| VO | Local | Regras |
|---|---|---|
| `EmailAddress` (existente) | inalterado | O login da conta de demonstração usa o fluxo comum: `demo@showcase.invalid` é um e-mail válido. |
| `PlainPassword.forShowcaseAccount(raw)` (novo factory) | `plain-password.ts` | `Result<PlainPassword, 'REQUIRED' \| 'TOO_LONG'>`: 1-72 code points, **sem mínimo de 8**. É o **único** caminho especial da conta (B5). Uso restrito por regra de lint (`no-restricted-syntax` permitindo só `ensure-showcase-account.ts`) e por teste que procura chamadas fora dele. `PlainPassword.create` (regra geral, 8-72) **não muda**. Verificar a senha no login já funciona por `forVerification` (sem regra de tamanho, D13). |

Descartados:
- `LoginIdentifier` com alias `demo` -> e-mail canônico (rev. 2): exigia um caso especial de formato no login; removido por B5 rev. 3.
- Relaxar `PlainPassword.create` com uma lista de exceções: enfraquece a regra geral e espalha o caso especial pelos use cases de definição de senha.

### 3.6 Domain events (novos)

| Evento | Payload |
|---|---|
| `ShowcaseAccountProvisioned` | `userId`, `occurredAt` |
| `ShowcasePasswordReplaced` | `userId`, `occurredAt` |

Nenhum evento carrega senha, hash, token ou e-mail.

### 3.7 Erros

| Classe | code | kind / HTTP | details |
|---|---|---|---|
| `AppUpdateRequiredError` (nova) | `APP_UPDATE_REQUIRED` | `upgrade_required` (novo) / **426** | `{ minimumVersion: "1.2.0", storeUrl: string \| null }` |
| `ForbiddenError` (existente) | `FORBIDDEN` | 403 | capacidade ausente: troca de senha da conta de demonstração (B8/CA48, devolvido **antes** de conferir a senha atual, então nunca vira 400 `currentPassword: INCORRECT` nem conta tentativa) e perfil da conta de demonstração; `/api/admin/*` sem `MANAGE_USERS`. Editar/excluir só respondem 403 se uma conta futura não tiver `MANAGE_EXPENSES`. `details: {}`. |
| `EntryNotFoundError` (existente, finance) | `ENTRY_NOT_FOUND` | 404 | lançamento inexistente **ou de outro dono** |
| `RequestValidationError` (existente, presentation) | `VALIDATION_ERROR` | 400 | `X-Client` malformado: `{ fields: [{ field: "header.X-Client", code: "INVALID_FORMAT" }] }` |

`shared/domain/app-error.ts`: `ErrorKind += 'upgrade_required'`; `HttpErrorFilter.STATUS_BY_KIND.upgrade_required = 426`. Mensagem: "Atualize o aplicativo para continuar.".

---

## 4. Interfaces de repositório (domain)

Nenhuma interface nova em identity. Alterações:

```ts
// domain/user/user.repository.ts - assinatura inalterada; semântica explícita:
//   findByEmail(email) encontra também a conta SHOWCASE (e-mail canônico).
//   insert/update aceitam SHOWCASE (o mapper passa a conhecer o kind).

// application/ports/session-principal-lookup.ts (port existente)
export interface SessionPrincipalRecord {
  userId: string;
  sessionId: string;
  kind: 'REGULAR' | 'DEMO' | 'PENDING_FIRST_ADMIN' | 'SHOWCASE';   // + SHOWCASE
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
}
```

Finance: `EntryRepository` e `CardRepository` **não mudam** (o escopo por dono de B6 já está em `findByIdsForUpdate(ownerId, ids)`). Port novo de application (5.4):

```ts
// finance/application/ports/showcase-data-purger.ts
export interface ShowcaseDataPurger {
  /**
   * Numa transação: (1) apaga os lançamentos do dono com created_at < before; (2) apaga os cartões do dono com
   * created_at < before que não tenham mais lançamentos (FK entries.card_id é RESTRICT). Devolve as contagens.
   */
  purgeCreatedBefore(ownerId: OwnerId, before: Date): Promise<{ entries: number; cards: number }>;
}
export const SHOWCASE_DATA_PURGER = Symbol('SHOWCASE_DATA_PURGER');
```

É um port de application (operação em massa de manutenção, sem regra de aggregate), como o `DemoDatasetStore` existente. Não reaproveita `EntryRepository.deleteAllOf` porque o corte por `created_at` é o que torna a execução de recuperação no boot segura (5.4).

Shared kernel:

```ts
// shared/domain/time/local-time-of-day.ts  (VO puro)
export class LocalTimeOfDay {
  static parse(raw: string): Result<LocalTimeOfDay, 'INVALID_FORMAT'>;   // "HH:MM", 00:00-23:59
  readonly hour: number; readonly minute: number;
}

// shared/application/ports/daily-time-calculator.ts
/** Horário civil de America/Sao_Paulo. Implementação com Intl em shared/infrastructure. */
export interface DailyTimeCalculator {
  /** Último instante <= now em que o relógio de São Paulo marcou `at`. */
  lastOccurrence(now: Date, at: LocalTimeOfDay): Date;
  /** Primeiro instante > now em que o relógio de São Paulo marca `at`. */
  nextOccurrence(now: Date, at: LocalTimeOfDay): Date;
}
export const DAILY_TIME_CALCULATOR = Symbol('DAILY_TIME_CALCULATOR');
```

---

## 5. Application: ports e use cases

### 5.1 Ports (`identity/application/ports/`)

```ts
// identity-audit-log.ts  (ALTERADO só em loginSucceeded/loginFailed: + client, RNF13)
export type ClientAuditInfo = { kind: 'WEB' | 'MOBILE'; appVersion: string | null };
loginSucceeded(e: AuditContext & { userId: string; client: ClientAuditInfo }): void;
loginFailed(e: AuditContext & { email: EmailAddress | null; userId: string | null; client: ClientAuditInfo }): void;

// client-compatibility-config.ts  (NOVO; valor montado no composition root a partir de loadEnv())
export interface ClientCompatibilityConfig {
  minimumMobileVersion: AppVersion;
  mobileStoreUrl: string | null;
}
export const CLIENT_COMPATIBILITY_CONFIG = Symbol('CLIENT_COMPATIBILITY_CONFIG');
```

`PasswordHasher`, `SessionTokenIssuer`, `IdentityUnitOfWork`, `AttemptLimiter`: sem mudança.

### 5.2 Views (application)

```ts
export interface CurrentUserView {
  id: string; name: string; email: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
  accountKind: 'REGULAR' | 'SHOWCASE';      // NOVO - sinal "conta demo" (P-ADR5)
  capabilities: Capability[];               // NOVO, ordenado
}
export interface PrincipalView {
  userId: string; sessionId: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
  capabilities: Capability[];               // NOVO (AuthenticatedPrincipal em shared/presentation idem)
}
```

`accountKind` é derivado de `User.kind` (só `REGULAR` e `SHOWCASE` autenticam, então o tipo do DTO não expõe os outros). Para a conta de demonstração, `email` é `demo@showcase.invalid`, o mesmo que a pessoa digitou; o app e o web o exibem como qualquer e-mail e **não** o usam para decidir nada (P-ADR5).

### 5.3 Use cases (identity)

| Use case | Input | Output | Fluxo / precedência |
|---|---|---|---|
| `LoginWithPassword` (alterado) | `{ email, password, clientIp, client: ClientDescriptor }` | `AuthResult` (inalterado na forma; `user` com os campos novos) | Igual ao atual (`EmailAddress.create`; formato inválido => `INVALID_CREDENTIALS`, D13), com duas diferenças: (1) se o e-mail normalizado for `ShowcaseAccount.email`, **não** consulta nem registra `login-email-failures` (3.4); a verificação do hash continua sempre (RNF05); (2) auditoria com `client`. Nenhuma conversão de identificador. Sessão de 24 h igual para web e app. |
| `AuthenticateSession` (alterado) | inalterado | `PrincipalView` + `capabilities` | Troca `record.kind !== 'REGULAR'` pela regra de domínio `AuthenticationEligibility.canAuthenticate(kind, status)` (a mesma usada por `User.canAuthenticate`, S8) e calcula `AccountCapabilities.of(record)`. Continua lendo do banco a cada chamada (T16). |
| `GetCurrentUser` (alterado) | inalterado | `CurrentUserView` com `accountKind` e `capabilities` | - |
| `ChangeOwnPassword` (alterado, B8, CA48) | inalterado | inalterado | **Primeiro passo**, antes de validar o corpo contra a senha atual, consultar o hasher ou o limitador `password-change-user-failures`: sem `CHANGE_OWN_PASSWORD` => `ForbiddenError` (403 `FORBIDDEN`). Na rota, o `@RequireCapability` (6.3) já barra antes do use case; a checagem no use case é defesa em profundidade. Resto inalterado (mantém a sessão atual, encerra as demais, inclusive web). |
| `UpdateOwnProfile` (alterado) | inalterado | inalterado | Sem `UPDATE_OWN_PROFILE` => `ForbiddenError`. |
| `EnsureShowcaseAccount` (novo) | `{ password: string \| null }` (do seed; nunca de HTTP) | `{ status: 'created' \| 'updated' \| 'unchanged' \| 'disabled' \| 'absent' \| 'conflict' }` | Num `uow.run`: busca por `SHOWCASE_USER_ID`. (a) `password = null` (interruptor desligado): conta existe e ativa => `deactivate` + `tx.sessions.deleteAllOfUser` => `disabled`; não existe => `absent`. (b) `password` presente: `PlainPassword.forShowcaseAccount` (erro => `ShowcaseConfigError`, só no boot, sem valor no log). Conta não existe: se `findByEmail(ShowcaseAccount.email)` achar outro usuário => `conflict` (log de erro, não lança); senão `User.showcase` => `created`. Conta existe: se `hasher.verify(senha, hash)` falhar => `replaceShowcasePassword` + `deleteAllOfUser` => `updated`; senão `unchanged`. **Não reativa** uma conta inativa (status `INACTIVE` com senha presente => `unchanged` + aviso): reativar exige ação explícita (D6). Idempotente. |
| `CheckClientCompatibility` (novo) | `{ client: ClientDescriptor }` | `void` | `MinimumAppVersionPolicy.assertSupported(client, config.minimumMobileVersion, config.mobileStoreUrl)`. Sem I/O. |
| `Logout`, `PurgeExpiredSessions`, `DeactivateUser`, `ResetUserPassword`, `RecoverAdminAccess` | inalterados | inalterados | Sem família, nenhum precisa mudar (12.2). |

Provisionamento: `run-seed.ts` (composition root) lê `SHOWCASE_ACCOUNT_PASSWORD` do ambiente e chama `EnsureShowcaseAccount` depois de `EnsureDemoUser`/`RefreshDemoDataset`. O seed já roda a cada subida da imagem, então ligar, desligar ou trocar a senha é "mudar a variável e reiniciar". A senha **não** fica no repositório: nem em `.env.example` (só o nome da variável com valor vazio e um comentário), nem em testes de integração/e2e (que geram uma senha própria). A spec e as notas de revisão da Apple citam `demo@showcase.invalid`/`demo` porque é uma credencial pública por definição.

### 5.4 Use case (finance) e agendamento diário (B7, B9)

| Use case | Input | Output | Fluxo |
|---|---|---|---|
| `PurgeShowcaseData` (novo, `finance/application/use-cases/maintenance/`) | `{ ownerId: string }` | `{ entries: number; cards: number }` | `cutoff = dailyTime.lastOccurrence(clock.now(), purgeAt)`; `purger.purgeCreatedBefore(ownerId, cutoff)`. `purgeAt: LocalTimeOfDay` (`03:00`) chega pelo construtor, montado no composition root. Idempotente, sem estado próprio. O `ownerId` vem do composition root (`SHOWCASE_USER_ID`), então finance não conhece o conceito de conta de demonstração. |

Por que um corte (`created_at < último 03:00 de São Paulo`) em vez de "apagar tudo do dono":
- Às 03:00 o corte é o próprio instante da execução, então o efeito é "apagar todos os lançamentos e cartões" (B7, B9).
- A execução de **recuperação** no boot (container reiniciado depois das 03:00, ou parado às 03:00) apaga só o que deveria ter sido apagado na última janela, sem levar o que um visitante criou depois das 03:00 de hoje. Sem esse corte, cada reinício no meio do dia limparia a conta.
- Nenhum estado "última limpeza" precisa ser persistido; rodar duas vezes não muda nada.

Cartões (B9): apagados na mesma transação, **depois** dos lançamentos, só os com `created_at < cutoff` e sem lançamentos restantes. Caso de borda: se um visitante criar, depois das 03:00, um lançamento num cartão antigo que escapou de uma limpeza (por exemplo, scheduler desligado), o cartão fica até a próxima execução, junto com o lançamento. Não há cascata em `entries.card_id` (continua `RESTRICT`): a ordem dentro do adapter é a garantia.

Agendamento (S9). `bootstrap/maintenance.scheduler.ts` passa a receber a lista de tarefas por token:

```ts
// bootstrap/maintenance-task.ts
export type MaintenanceSchedule =
  | { kind: 'interval' }                               // a cada MAINTENANCE_INTERVAL_MS (comportamento atual)
  | { kind: 'daily'; at: LocalTimeOfDay };             // horário civil de America/Sao_Paulo
export interface MaintenanceTask {
  readonly name: string;
  readonly schedule: MaintenanceSchedule;
  run(): Promise<void>;
}
export const MAINTENANCE_TASKS = Symbol('MAINTENANCE_TASKS');

// MaintenanceScheduler(intervalMs: number, tasks: readonly MaintenanceTask[], clock: Clock, dailyTime: DailyTimeCalculator)
```

Regras do scheduler:
1. `intervalMs <= 0` desliga **todas** as tarefas, inclusive as diárias (mesmo interruptor de hoje, usado nos testes e2e).
2. Tarefas `interval`: um `setInterval` como hoje, rodando na ordem da lista (`EnsureDemoUser` antes de `RefreshDemoDataset` preserva a dependência atual).
3. Tarefas `daily`: um `setTimeout` para `dailyTime.nextOccurrence(clock.now(), at)`; ao disparar, roda e reagenda a partir de um novo `now` (sem acumular deriva; o intervalo é sempre < 25 h, abaixo do limite de `setTimeout`). No `onModuleInit` roda **uma vez** cada tarefa diária (recuperação; segura pelo corte acima).
4. Cada tarefa num `try/catch` próprio, com log por `name` (e as contagens, sem conteúdo): a falha de uma não impede as outras nem a próxima execução.
5. Timers com `unref()`; `onModuleDestroy` limpa todos.

`app.module.ts` monta `MAINTENANCE_TASKS` com quatro adaptadores finos (`EnsureDemoUser`, `RefreshDemoDataset`, `PurgeExpiredSessions` como `interval`; `PurgeShowcaseData` com `{ kind: 'daily', at: 03:00 }` e `ownerId: SHOWCASE_USER_ID`). O horário é constante de código (decisão do usuário), não variável de ambiente. Uma réplica da API (R8): com mais réplicas a limpeza rodaria em cada uma, o que continua correto por ser idempotente.

---

## 6. Contratos HTTP

### 6.1 Transporte e exposição via nginx (B1)

Topologia de produção (o compose e a configuração do nginx ficam fora deste repositório; este ADR define os requisitos):

```
Internet ──HTTPS──> nginx :443  ├─ web.<domínio>  -> web:3000
                                └─ api.<domínio>  -> api:3001   (listener público da API)
web (BFF) ──HTTP rede interna──> nginx :8081 (listener interno, não publicado) -> api:3001
api:3001  não publicado no host; só o nginx alcança.
```

Requisitos do nginx (checklist de deploy, verificado pelo CA31 e por um teste manual pós-deploy):

| # | Requisito | Motivo |
|---|---|---|
| N1 | TLS 1.2+ no 443, redirecionamento 80 -> 443, `Strict-Transport-Security: max-age=31536000` em `api.<domínio>`. | RNF03, ATS do iOS (CA30). |
| N2 | Listener público da API: `proxy_set_header X-Forwarded-For $remote_addr;` (**sobrescreve**, nunca `$proxy_add_x_forwarded_for`). Idem no listener público do web. | Um `X-Forwarded-For` forjado pelo cliente não chega à API (CA31). |
| N3 | Listener interno (só na rede do compose, sem `ports:`), usado pelo BFF: `set_real_ip_from <IP fixo do web>; real_ip_header X-Forwarded-For; real_ip_recursive off;` e então `proxy_set_header X-Forwarded-For $remote_addr;`. | O BFF repassa o IP do usuário (que o próprio nginx gravou em N2); a API continua confiando num único salto, o nginx. O `API_URL` do web passa a apontar para esse listener. |
| N4 | Listener público: `location ^~ /api/admin/ { return 404; }` e `location ^~ /api/demo/ { return 404; }`. O listener interno não bloqueia (o web usa as duas). | O app não usa gestão de usuários nem `/api/demo/*` (B5); reduz a superfície exposta sem lista de permissões a manter. 404 em vez de 403 para não revelar a rota. |
| N5 | Só `/api/` é roteado no host da API; qualquer outro caminho => 404. | Superfície mínima. |
| N6 | `client_max_body_size 128k`; `proxy_read_timeout 30s`. | Maior corpo do app é pequeno; o app tem timeout de 15 s. |
| N7 | Log de acesso sem cabeçalho `Authorization` nem corpo (o formato `combined` padrão já atende); `server_tokens off`. | RNF01. |
| N8 | Recomendado (não obrigatório): `limit_req` por IP em `POST /api/auth/login` e nas rotas de escrita do host público. | Defesa em profundidade para a conta de demonstração, já que o limitador da API é em memória (R8). |
| N9 | IP fixo do nginx na rede do compose (`ipv4_address`) e o mesmo valor em `TRUST_PROXY` da API. | `trust proxy` do Express aceita IP/sub-rede, não nome de host. |
| N10 | Passa `X-Client` e `Authorization` sem alteração (padrão do nginx). | 426 e Bearer. |

`TRUST_PROXY` de produção: **só o IP do nginx** (ex.: `"172.30.0.10"`). Com N2/N3, `req.ip` é o IP real do usuário tanto no app quanto no web, e um XFF forjado não altera nada. Mudança em `bootstrap/env.ts`: com `NODE_ENV=production`, `TRUST_PROXY` passa a ser **obrigatória** e não pode ser `true`, inteiro de saltos, `uniquelocal` nem `loopback` (o boot falha com a mensagem do nome da variável, sem valor), porque o padrão atual confiaria em qualquer container da rede.

Alternativa descartada: incluir também o IP do container do web em `TRUST_PROXY` e manter o BFF chamando a API direto (mais simples, mas contraria "confiar só no nginx" e deixa dois saltos confiáveis a manter).

Demais pontos:
- Sem CORS (app nativo; Expo Web fora de escopo).
- `Cache-Control: no-store` nas respostas de `login` e `me`.

### 6.2 Endpoints de identity (alterados)

| # | Método e rota | Acesso | Mudança | Erros (precedência) |
|---|---|---|---|---|
| A1 | `POST /api/auth/login` | pública + `AuthQuotaGuard` | `X-Client` opcional; corpo inalterado (`{ email, password }`, strict); `email` continua sendo e-mail (sem alias, B5); `user` com `accountKind` e `capabilities` | 400 `X-Client` > 426 > 429 > 400 corpo > 401 `INVALID_CREDENTIALS` |
| A2 | `POST /api/auth/logout` | pública | só `X-Client`/426 | 400 `X-Client` > 426 (idempotente no resto) |
| A3 | `GET /api/auth/me` | protegida, `@AllowDuringPasswordChange` | `user` com `accountKind` (P-ADR5) e `capabilities` | 400 `X-Client` > 426 > 401 |
| A4 | `PUT /api/account/password` | protegida, `@AllowDuringPasswordChange`, `@RequireCapability('CHANGE_OWN_PASSWORD')`, `AuthQuotaGuard` | capacidade (B8, CA48) | 400 `X-Client` > 426 > 401 > **403 `FORBIDDEN`** > 429 > 400 corpo > 400 `currentPassword: INCORRECT` > ... O 403 vem antes de qualquer verificação de senha e não conta tentativa. |
| A5 | `PUT /api/account/profile` | protegida, `@RequireCapability('UPDATE_OWN_PROFILE')` | capacidade | ... > 403 `FORBIDDEN` > 400 |
| todas | qualquer rota casada | - | `X-Client: mobile/<v>` abaixo da mínima | 426 `APP_UPDATE_REQUIRED` antes de 401 |

```ts
type CurrentUserDto = {
  id: string; name: string; email: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
  accountKind: 'REGULAR' | 'SHOWCASE';                                   // NOVO (P-ADR5: SHOWCASE = conta demo)
  capabilities: ('MANAGE_USERS' | 'MANAGE_EXPENSES' | 'CHANGE_OWN_PASSWORD' | 'UPDATE_OWN_PROFILE')[]; // NOVO
};
type AuthResponse = { user: CurrentUserDto; session: { token: string; expiresAt: string } };  // inalterado
type ForbiddenBody = { code: 'FORBIDDEN'; message: string; details: {} };                      // existente
type AppUpdateRequiredBody = {
  code: 'APP_UPDATE_REQUIRED';
  message: 'Atualize o aplicativo para continuar.';
  details: { minimumVersion: string; storeUrl: string | null };
};
```

Compatibilidade (RNF11): campos só **acrescentados**; o web atual ignora campos extras; o web não envia `X-Client` => `WEB`. `X-Client` não é controle de segurança (quem o forja não ganha privilégio).

### 6.3 Presentation (identity)

- `AccessControlGuard` passa a receber duas listas: `prePolicies` (rodam em **todas** as rotas casadas, inclusive `@Public()`) e `policies` (como hoje). Injetadas por token (`ACCESS_PRE_POLICIES`) (OCP, S5).
- `ClientContextPolicy` (pre-policy): `parseClientHeader(req.header('X-Client'))` => `request.client`; inválido => 400. Depois `CheckClientCompatibility` => 426.
- `@CurrentClient()` (decorator do identity) lê `request.client`; usado por `AuthController.login`.
- `RolePolicy` vira `CapabilityPolicy`: `@RequireCapability(cap)` com `principal.capabilities` sem `cap` => 403 `FORBIDDEN`. `@RequireRole('ADMIN')` é removido; `AdminUsersController` passa a `@RequireCapability('MANAGE_USERS')` (mesmo efeito: só REGULAR+ADMIN tem). `access-metadata.ts` troca `REQUIRED_ROLE_KEY` por `REQUIRED_CAPABILITY_KEY` (S7).
- A `CapabilityPolicy` roda no `AccessControlGuard`, antes do `AuthQuotaGuard` da rota e dos pipes de corpo: é isso que garante o 403 do CA48 antes de 429 e de qualquer 400.
- Rotas sem casamento (404 `ROUTE_NOT_FOUND`) não passam por guards e não respondem 426 (aceitável).
- Precedência numa rota protegida: `MALFORMED_JSON`/413 (D12) > 400 `X-Client` > **426** > 401 > 403 `PASSWORD_CHANGE_REQUIRED` > 403 `FORBIDDEN` > 429 > 400 > 404 > 422; 409 depois de 400 e 404.

### 6.4 Configuração (`api/src/bootstrap/env.ts`)

| Variável | Obrigatória | Regra |
|---|---|---|
| `MOBILE_MIN_VERSION` | não | semver; padrão `1.0.0` |
| `MOBILE_STORE_URL` | não | URL `https://`; vai em `details.storeUrl` |
| `TRUST_PROXY` | **sim em produção** | IP(s) do nginx; recusados em produção: `true`, número, `loopback`, `uniquelocal`, ausente (6.1) |
| `SHOWCASE_ACCOUNT_PASSWORD` | não | lida **só** pelo seed. Ausente/vazia => conta de demonstração desligada (inativada se existir). 1-72 code points. Nunca logada. |
| `MAINTENANCE_INTERVAL_MS` | não (existente) | sem mudança de regra; `0` agora desliga também a limpeza diária (5.4) |

O horário da limpeza (03:00 America/Sao_Paulo) **não** é configurável (B7).

### 6.5 Endpoints de finanças usados pelo app (B3, todos existentes, contrato inalterado)

| Ação no app | Método e rota | Capacidade | Erros a tratar no app (por `code`) | Invalidação (10.8) |
|---|---|---|---|---|
| Ler | `GET /api/summary`, `/api/dashboard/monthly-series`, `/api/dashboard/category-distribution`, `/api/entries/initial-month`, `/api/entries/expenses`, `/api/entries/incomes`, `/api/invoices`, `/api/cards/:cardId/invoices/:referenceMonth/entries`, `/api/categories`, `/api/cards` | - | 400, 404 `CARD_NOT_FOUND` (detalhe da fatura) | - |
| Criar despesa/receita | `POST /api/entries` | - | 400 campos, 404 `CARD_NOT_FOUND` | finanças |
| Criar parcelada | `POST /api/entries/installments` | - | 400 campos, 404 `CARD_NOT_FOUND` | finanças |
| Pagar uma despesa (inclusive uma parcela; DM15) | `POST /api/entries/:id/pay` | - | 404 `ENTRY_NOT_FOUND`, 422 `ENTRY_NOT_PAYABLE`; idempotente (já paga => 200) | finanças |
| **Pagar em lote** (modo de seleção, 1-100; DM16, RF37) | `POST /api/entries/pay` com `{ ids: string[] }` | - | 400 `ids` (`EMPTY`, `TOO_MANY_ITEMS`, `ids[n]: INVALID_FORMAT`), 404 `ENTRIES_NOT_FOUND` (`details.missingIds`), 422 `ENTRIES_NOT_PAYABLE` (`details.incomeIds`); tudo ou nada; resposta com `paidIds`/`alreadyPaidIds` | finanças |
| Pagar fatura | `POST /api/cards/:cardId/invoices/:referenceMonth/pay` | - | 404 `CARD_NOT_FOUND`; `paidCount = 0` é sucesso | finanças |
| Editar despesa (inclusive uma parcela) | `PUT /api/entries/:id` (`{ description, category, date, amount }`) | `MANAGE_EXPENSES` (toda conta autenticada, B6) | 400 campos, 403 `FORBIDDEN` (defensivo), 404 `ENTRY_NOT_FOUND` (inexistente ou de outro dono), 422 `ENTRY_NOT_EDITABLE`, 422 `PAID_CARD_EXPENSE_DATE_LOCKED` | finanças |
| **Desfazer edição** (DM14, só app) | `PUT /api/entries/:id` com o payload **anterior** (`buildUpdateExpensePayload` dos valores originais), enviado se a pessoa tocar "Desfazer" em até 5 s | `MANAGE_EXPENSES` | os mesmos de Editar; 404 => "a despesa não existe mais"; 422 `PAID_CARD_EXPENSE_DATE_LOCKED` (paga no intervalo) => toast de erro; sem retry | finanças |
| Excluir despesa (inclusive uma parcela) | `DELETE /api/entries/:id`, enviado **ao expirar** o toast "Desfazer" (5 s) ou imediatamente se o app sair do primeiro plano/encerrar a sessão | `MANAGE_EXPENSES` (B6) | 403 `FORBIDDEN` (defensivo), 404 `ENTRY_NOT_FOUND` (tratado como "já excluída"), 422 `ENTRY_NOT_DELETABLE` (linha volta com a mensagem) | finanças (após o envio) |
| **Desfazer exclusão** (DM14, só app) | **nenhuma chamada**: cancela o `DELETE` ainda não enviado e restaura a linha local | - | - | nenhuma (nada mudou no servidor) |
| Troca de senha opcional | `PUT /api/account/password` | `CHANGE_OWN_PASSWORD` | 403 `FORBIDDEN` (CA48, primeiro); 400 `currentPassword: INCORRECT`, `newPassword: REQUIRED/TOO_SHORT/TOO_LONG/SAME_AS_CURRENT`; 429 `retryAfterSeconds` | `['me']` via `setQueryData` |

Desfazer não tem endpoint próprio nem muda contrato: o desfazer da exclusão é envio adiado no cliente; o da edição é uma segunda edição. Pagamento não tem desfazer (a API não desmarca). O web **não** ganha desfazer (spec rev. 3).

Parcelas: são despesas independentes (ADR 0010); não há operação de série. Editar/excluir/pagar uma parcela afeta só ela, como no web.

Mudança de autorização no finance (B6): `entries.controller.ts` troca `@RequireRole('ADMIN')` por `@RequireCapability('MANAGE_EXPENSES')` em PUT/DELETE. Efeito: ADMIN inalterado; **USER passa de 403 para 200/204** nos próprios lançamentos; lançamento de outro dono continua 404 para qualquer nível (escopo em `findByIdsForUpdate(ownerId, ...)`, com `ownerId` do principal). Nenhum corpo ou código de erro muda. `docs/api/finance.md` passa a dizer "exige a capacidade `MANAGE_EXPENSES`, concedida a toda conta autenticada; só alcança lançamentos do próprio usuário (outro dono => 404)" (doc-writer).

---

## 7. Persistência: schema Prisma e migration

Com B2, **nada muda em `sessions`** e não há tabelas novas. A coluna `client_kind` em `sessions` foi reavaliada e **descartada**: o tipo de cliente só serve à auditoria de login, que é log estruturado (RNF13); persistir sem consumidor seria especulativo. B6, B7 e B9 não exigem schema (usam `entries.created_at` e `cards.created_at`, já existentes; com a conta tendo no máximo os dados de um dia, o filtro por `user_id` e os índices atuais bastam). O que sobra é só a conta de demonstração.

### 7.1 Schema

```prisma
enum UserKind {
  REGULAR
  DEMO
  PENDING_FIRST_ADMIN
  SHOWCASE            // NOVO
  @@map("user_kind")
}
```

### 7.2 Migrations

Duas migrations, porque o PostgreSQL não permite usar um valor de enum na mesma transação em que ele foi criado (`ALTER TYPE ... ADD VALUE` + CHECK que cita `'SHOWCASE'` falharia com "unsafe use of new value"):

1. `20261103000001_user_kind_showcase`: `ALTER TYPE "user_kind" ADD VALUE IF NOT EXISTS 'SHOWCASE';`
2. `20261103000002_users_showcase_check` (SQL manual):
   ```sql
   ALTER TABLE "users" ADD CONSTRAINT "users_showcase_chk" CHECK (
     "kind" <> 'SHOWCASE' OR (
       "id" = '01900000-0000-7000-8000-0000000000d2'
       AND "email" = 'demo@showcase.invalid'
       AND "password_hash" IS NOT NULL
       AND "role" = 'USER'
       AND "must_change_password" = false));
   ```
   `users_regular_hash_chk`, `users_demo_chk` e `users_pending_first_admin_chk` não mudam (todas são `kind <> X OR ...`).

Rollback: forward-fix. Comentário no topo da 2: `ALTER TABLE "users" DROP CONSTRAINT "users_showcase_chk";` (o valor de enum não é removível sem recriar o tipo; fica inofensivo). Nenhum dado existente é alterado; a conta só nasce no seed, e só com a variável definida.

Deploy: o `CMD` atual (`migrate deploy` -> `db seed` -> `node`) garante a ordem. A API nova sobe com o web atual (campos só acrescentados; com B6, o web antigo continua escondendo editar/excluir de USER até o web novo subir, sem erro). O app só é publicado depois da API nova e do nginx (N1-N10) em produção.

### 7.3 Infraestrutura (adapters)

| Port / peça | Adapter | Notas |
|---|---|---|
| `UserRepository` | `PrismaUserRepository` + `UserMapper` | mapeia `SHOWCASE`; `listRegular`/`countActiveAdmins` continuam filtrando `REGULAR` (a conta não aparece na gestão). |
| `SessionPrincipalLookup` | `PrismaSessionPrincipalLookup` | tipo do `kind` + `SHOWCASE`. |
| `ShowcaseDataPurger` | `PrismaShowcaseDataPurger` (finance/infrastructure) | Numa transação: `DELETE FROM entries WHERE user_id = $1 AND created_at < $2`; depois `DELETE FROM cards c WHERE c.user_id = $1 AND c.created_at < $2 AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.card_id = c.id)`; devolve as duas contagens. |
| `DailyTimeCalculator` | `SaoPauloDailyTimeCalculator` (shared/infrastructure, ao lado de `SaoPauloBusinessCalendar`) | `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` para obter o deslocamento do dia; não fixa `-03:00` no código (caso o horário de verão volte). |
| `IdentityAuditLog` | `LoggerIdentityAuditLog` | `client` no login; nunca token, senha ou hash. |
| `ClientCompatibilityConfig` | valor montado no `IdentityModule` | |
| `AttemptLimiter` | `InMemoryAttemptLimiter` (inalterado) | válido com **uma** réplica (R8). |

---

## 8. Infraestrutura de deploy (B1)

- Nenhum arquivo novo de infraestrutura neste repositório (não há compose de produção nem nginx versionados). Os requisitos N1-N10 (6.1) entram como checklist em `docs/` pelo doc-writer (seção "Deploy" do README ou `docs/api/finance.md`, a critério dele), não como arquivo de configuração.
- Variáveis novas no ambiente de produção: API (`TRUST_PROXY` explícito, `MOBILE_MIN_VERSION`, `MOBILE_STORE_URL`, `SHOWCASE_ACCOUNT_PASSWORD`) e web (`API_URL` apontando para o listener interno do nginx, N3). `MAINTENANCE_INTERVAL_MS` não pode ser `0` em produção, senão a limpeza diária (B7) não roda.
- `deploy.yml` não muda além da versão da imagem; o build iOS é um workflow separado (10.12).
- Ordem do primeiro deploy: (1) nginx com N1-N10 e IP fixo; (2) API nova com `TRUST_PROXY` = IP do nginx; (3) web com `API_URL` novo; (4) teste manual do CA31 e de `/api/admin/*` => 404 no host público; (5) app.

---

## 9. Impacto no Next.js (`web/`)

| Item | Mudança |
|---|---|
| `app/(public)/privacy/page.tsx` | Nova página estática (RSC, sem chamada à API, sem Server Action): política de privacidade (nome e e-mail, finalidade funcional, sem rastreamento, exclusão via administrador; conta de demonstração compartilhada, com lançamentos e cartões apagados todo dia às 03:00). |
| `app/(public)/support/page.tsx` | Nova página estática: contato de suporte. |
| `lib/auth/route-policy.ts` | Sem mudança: `/privacy` e `/support` não estão em `PROTECTED_PREFIXES`. Testes de `decideRoute` ganham os dois casos. `decideAdminLayout` pode continuar por `role` (equivale a `MANAGE_USERS`); trocar por capacidade é opcional e só por consistência. |
| `lib/api/types.ts` | `CurrentUserDto` ganha `accountKind` e `capabilities` (arquivo sincronizado com o mobile, 10.3). |
| `app/(protected)/entries/page.tsx` (**B6**) | `canManageExpenses={user?.capabilities.includes("MANAGE_EXPENSES") ?? false}` no lugar de `role === "ADMIN"` (S10). **Mudança visível:** usuários USER passam a ver "Editar" e "Excluir" nas despesas (lista de desktop e cards do celular em `expenses-list.tsx`, e o drawer de edição), como hoje só ADMIN via. A página pública `/demo` não passa a prop e continua sem essas ações. O web **não** ganha "Desfazer" (DM14 é só do app). |
| `app/(protected)/entries/actions.ts` | Sem mudança de código: as Server Actions de editar/excluir já repassam ao BFF sem checar nível; com B6 a API passa a aceitar USER. O tratamento de 403 `FORBIDDEN` (mensagem genérica) continua como salvaguarda. |
| `components/account-menu.tsx` e páginas de conta (**B8**) | Escondem "Alterar senha" sem `CHANGE_OWN_PASSWORD` e "Perfil" sem `UPDATE_OWN_PROFILE` (só a conta de demonstração perde as duas); o link "Usuários" passa a usar `MANAGE_USERS`. As páginas `/account/password` e `/account/profile`, se acessadas pela URL, mostram o erro 403 com a mensagem genérica existente (ou `notFound()`, a critério do frontend-dev). |
| `lib/entries/payment-feedback.ts` (novo, extraído) | `invoicePaidFeedback`, `paidFeedback`, `countLabel` saem de `feedback.ts` (que importa navegação por URL) para um arquivo puro, sincronizado com o mobile. `feedback.ts` reexporta; sem mudança de comportamento. |
| `lib/entries/form.ts` | Ganha `buildUpdateExpensePayload(values)` extraído de `edit-expense-drawer.tsx` (o drawer passa a chamá-lo); sincronizado com o mobile. |
| Login, logout, BFF | Sem mudança de código. `API_URL` muda só no ambiente (N3). A conta de demonstração entra no web com `demo@showcase.invalid`/`demo` como qualquer e-mail. |
| Comportamento observado no web | Trocar a senha no web continua encerrando as outras sessões do usuário, inclusive as do app. |

Nenhuma Server Action nova. Nenhum gateway de repasse.

---

## 10. App mobile (`mobile/`)

### 10.1 T1 - Expo (EAS) em vez de React Native puro

**Decisão:** Expo SDK estável mais recente no início da implementação, **prebuild** (`ios/` gerada, não versionada), **New Architecture**, **Hermes**, Expo Router, **EAS Build** e **EAS Submit**.

Justificativa: o projeto não tem Mac de build nem pipeline iOS; EAS assina e gera o binário na nuvem e envia ao App Store Connect (R4, CA32). Os módulos necessários existem como pacotes Expo mantidos (`expo-secure-store`, `expo-application`, `expo-localization`, `expo-web-browser`). Prebuild mantém a saída para código nativo (config plugins).

Descartado: RN CLI puro (exige Xcode/Mac ou fastlane + runner macOS; nenhum ganho para este escopo). EAS Update (OTA) **fora da v1**: evita dois eixos de versão (binário x bundle) na política de versão mínima.

### 10.2 T2 - Local da pasta e estrutura (com DM8)

**Decisão:** `mobile/` na raiz, com `package.json` próprio. Sem monorepo na v1.

```
mobile/
  app/                              # Expo Router (só composição de telas)
    _layout.tsx                     # providers: QueryClient, tema, SessionProvider, PrivacyOverlay, Toast
    index.tsx                       # boot: decide login / tabs / atualização / sem conexão
    (auth)/_layout.tsx
    (auth)/login.tsx
    (auth)/password-change-required.tsx   # B4/P-ADR1 variante A: "troque a senha no site" (10.10; design 6.2.1)
    boot-offline.tsx
    update-required.tsx
    (tabs)/_layout.tsx              # Dashboard, Finanças, Ajustes
    (tabs)/dashboard/_layout.tsx    (tabs)/dashboard/index.tsx
    (tabs)/finances/_layout.tsx     # Stack da aba
    (tabs)/finances/index.tsx       # Despesas | Receitas | Faturas
    (tabs)/finances/invoice/[cardId]/[referenceMonth].tsx   # DM8: push dentro da pilha da aba (tab bar visível)
    (tabs)/settings/_layout.tsx     (tabs)/settings/index.tsx
    (tabs)/settings/change-password.tsx   # B4: troca opcional (push)
    new/_layout.tsx                 # folha modal
    new/expense.tsx  new/installments.tsx  new/income.tsx  new/pick-category.tsx  new/pick-card.tsx
    edit/_layout.tsx                # folha modal
    edit/[id].tsx                   # B3/B6: editar despesa (reaproveita o formulário de new/expense)
    edit/pick-category.tsx
    month-picker.tsx  filters.tsx
  src/
    lib/        # CÓPIA SINCRONIZADA do web (10.3) - TS puro
    core/       # regras puras do mobile: máquina de sessão, mapeamento de erros, chaves e predicados de cache,
                # inicial do usuário (sem Intl.Segmenter), capacidades -> ações visíveis, tipo de conta,
                # sinal de conta vazia, ações adiadas (desfazer)
    data/       # cliente HTTP, endpoints, hooks TanStack Query (queries e mutations)
    platform/   # adapters: SecureTokenStore, InstallMarker, AppInfo, PrivacyOverlay, ExternalBrowser
    ui/         # componentes base e tokens (ui-designer)
    features/   # telas por feature (auth, dashboard, finances, entries, invoices, settings)
  e2e/          # fluxos Maestro
  app.config.ts  eas.json
```

O grupo `(demo)` e o `FinanceReader` injetável da revisão anterior **saem**: o app tem um único leitor (`/api/...`), e a conta de demonstração usa as mesmas telas (B5). Ações de pagar/editar/excluir ficam nas linhas da lista (círculo de status, ações de deslizar e menu de contexto, DM15), no detalhe da fatura e no modo de seleção para pagar em lote (DM16).

Regra de dependência (`eslint no-restricted-imports`): `src/lib` e `src/core` não importam `react`, `react-native`, `expo-*`, `src/data` nem `src/platform`. `src/data` depende de `src/core` e de interfaces, nunca de `expo-secure-store` diretamente.

```ts
// src/core/ports.ts (mobile)
export interface StoredSession { token: string; expiresAt: string }   // B2: só a sessão de 24 h
export interface TokenStore {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}
export interface Clock { now(): Date }
export interface ExternalBrowser { open(url: string): Promise<void> }

// src/core/account-kind.ts (P-ADR5)
export function isDemoAccount(me: Pick<CurrentUserDto, 'accountKind'>): boolean;   // accountKind === 'SHOWCASE'
```

### 10.3 T2 - Compartilhamento de código com o web

**Decisão:** **cópia byte a byte com verificação de deriva em CI**, sem pacote compartilhado na v1.

- Sincronizados (fonte da verdade `web/lib/`, mesmo caminho relativo em `mobile/src/lib/`): `money/decimal.ts`, `dates/format.ts`, `entries/form.ts`, `entries/installments.ts`, `entries/payment-feedback.ts` (novo, 9), `dashboard/chart-data.ts`, `api/types.ts`, e os `*.spec.ts` correspondentes.
- Alias `@/lib/*` -> `src/lib/*` no mobile (Babel + tsconfig): arquivos idênticos, sem edição.
- `scripts/check-shared-rules.mjs` (raiz) compara a lista; diferença falha o CI do mobile e o do web. `npm run sync:shared` no mobile copia.
- `web/lib/auth/initial.ts` **não** entra (`Intl.Segmenter` ausente no Hermes): `mobile/src/core/initial.ts` faz NFC + primeiro code point + `toLocaleUpperCase('pt-BR')`.

Descartado agora: `packages/finance-rules` com npm workspaces (exige mudar o contexto de build do `web/Dockerfile` e do `deploy.yml`). Dívida registrada (12.2).

### 10.4 T2/RNF02 - Armazenamento seguro do token

**Decisão:** `expo-secure-store` (Keychain), `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, sem `requireAuthentication`. Um item JSON `fa.session` com `StoredSession`.

- Token também em memória (módulo do cliente HTTP) para não ler o Keychain a cada requisição.
- **Expiração local:** no boot, `expiresAt <= clock.now()` => apaga e vai para o login sem chamar a API ("Sua sessão expirou. Entre novamente."). Antes disso, a primeira chamada é `GET /api/auth/me`.
- **Reinstalação (CA10):** marcador não sensível `fa.installed` em AsyncStorage; sem marcador no boot => `TokenStore.clear()` e grava o marcador.
- Proibido: token em AsyncStorage, arquivos, logs, URL, deep link, estado do React Query (CA01).
- `PrivacyOverlay`: cobre a tela em `inactive`/`background` (P11).

### 10.5 T3 - Biblioteca de gráficos

**Decisão:** `react-native-gifted-charts` (sobre `react-native-svg`) no mobile. O CLAUDE.md agora diz: "Gráficos: Recharts (web). No app mobile (React Native), react-native-gifted-charts — ver ADR 0011." Não há mais exceção a registrar: a regra por plataforma está no CLAUDE.md, e este ADR é a referência da escolha (S8, resolvida). Recharts continua valendo para o `web/`.

- Motivo: Recharts depende do DOM e não roda em React Native (R5). gifted-charts cobre barras agrupadas (12 meses) e rosca (categorias) sem Skia nem Reanimated obrigatórios.
- Transformação dos dados em `src/lib/dashboard/chart-data.ts` (compartilhado); adapter fino `src/features/dashboard/chart-adapters.ts`.
- Acessibilidade (RNF08): gráfico oculto para o leitor de tela, com resumo textual e tabela acessível ao lado. Valores sempre por `formatBRL`.
- Descartados: Victory Native XL (Skia + Reanimated, pesado para 2 gráficos); SVG próprio + `d3-shape` (mais código a manter).

### 10.6 T5 - iOS mínimo, Hermes e Intl

- **iOS 16.4** (o texto original dizia 16.0; o Expo SDK 58 / React Native 0.88 exigem no mínimo 16.4 e o plugin `expo-build-properties` recusa menos; ver 12.3); só iPhone, retrato (P01).
- **Hermes** obrigatório. Suporta `BigInt` (`decimal.ts`) e, no iOS, `Intl.DateTimeFormat` com `timeZone` e `formatToParts` (`dates/format.ts`).
- **Verificação no motor real:** o build `e2e` tem uma tela de diagnóstico (só nesse perfil) que executa `currentYearMonthSP`, `todaySP` e `formatInstant` para instantes fixos (inclusive `2026-12-01T01:30:00Z`, CA15); um fluxo Maestro confere em `TZ=UTC` e `TZ=Asia/Tokyo` (CA15, CA18).
- **Plano B:** polyfills `@formatjs/intl-getcanonicallocales`, `@formatjs/intl-locale`, `@formatjs/intl-datetimeformat` só com `America/Sao_Paulo`, carregados em `app/_layout.tsx`.

### 10.7 T7 - Versão mínima suportada do app

- Versão: semver em `app.config.ts`; `buildNumber` com `autoIncrement` do EAS.
- Toda requisição envia `X-Client: mobile/<expo-application.nativeApplicationVersion>`.
- 426 `APP_UPDATE_REQUIRED` tratado globalmente: limpa o cache, **mantém** o token, navega para `update-required` ("Atualizar" abre `details.storeUrl`).
- Processo: subir `MOBILE_MIN_VERSION` só depois que a versão nova estiver aprovada na loja. Mudança incompatível de contrato: (1) API aceita os dois formatos, (2) app novo publicado, (3) mínima elevada, (4) formato antigo removido.
- Descartado: configuração remota consultada no boot (uma chamada a mais; o 426 já chega na primeira chamada real).

### 10.8 T9 - Estado, cache e invalidação (B3, B6, DM14, DM16)

**Decisão:** TanStack Query v5, **só em memória** (sem persister).

- Chaves (`src/core/query-keys.ts`): `['me']`, `['summary', month]`, `['series', month]`, `['category-distribution', month]`, `['expenses', month, filters]` e `['incomes', month, filters]` (infinite, `pageSize` 20), `['invoices', month, status]`, `['invoice-entries', cardId, referenceMonth]`, `['categories']`, `['cards']`, `['initial-month']`. Todas as financeiras começam com o prefixo lógico `finance` no predicado (`isFinanceQuery(key)`), exceto `['me']` e `['cards']`.
- `staleTime` 30 s, `gcTime` 5 min; `focusManager` ligado ao `AppState`, `onlineManager` ao NetInfo. Pull-to-refresh refaz os blocos da tela.
- Retry: nenhum em 4xx; 1 retry em erro de rede só nas leituras; **mutações nunca** têm retry automático (CA27).

Regra única de invalidação, depois de **qualquer** mutação financeira bem-sucedida (criar, criar parcelada, pagar, pagar em lote, pagar fatura, editar, desfazer edição, excluir): `invalidateQueries({ predicate: isFinanceQuery })`. Só as consultas ativas refazem a requisição; as outras ficam stale e são buscadas ao voltar à tela. Motivo: cada mutação afeta várias leituras de forma difícil de prever com exatidão (editar a data de uma compra no cartão a move de fatura e de mês; pagar muda o mês inicial, o resumo, os subtotais e o status da fatura; uma parcelada toca até 36 meses e a série cobre 12; uma categoria nova aparece em `['categories']`). `['cards']` não muda com nenhuma delas (a limpeza diária da conta de demonstração acontece fora do app; o app a percebe na próxima leitura).

| Mutação | Antes de invalidar | Erros com tratamento específico |
|---|---|---|
| Pagar uma despesa | - (resposta `Entry` mostra o toast com `paidFeedback`) | 404 => toast "não encontrada" + invalidar; 422 `ENTRY_NOT_PAYABLE` => mensagem |
| Pagar em lote (DM16) | sai do modo de seleção | 404 `ENTRIES_NOT_FOUND` / 422 `ENTRIES_NOT_PAYABLE`: nada foi pago (tudo ou nada); `InlineAlert` com os itens, seleção mantida + invalidar para refletir o estado real |
| Pagar fatura | toast com `invoicePaidFeedback` (usa `paidAmount` da resposta; avisa se difere do exibido) | 404 `CARD_NOT_FOUND` => volta para a lista + invalidar |
| Editar | fecha a folha | 400 => erros de campo (`mapApiFieldIssues`); 422 `PAID_CARD_EXPENSE_DATE_LOCKED` => erro no campo Data (o campo já vem desabilitado para despesa paga no cartão, como no web); 404 => fecha + invalidar; 403 `FORBIDDEN` => mensagem + `invalidateQueries(['me'])` (as ações somem se a capacidade foi retirada) |
| Excluir | confirmação destrutiva antes (design); envio adiado (abaixo) | 404 => tratado como já excluída (sucesso silencioso + invalidar); 422 => linha volta com a mensagem; 403 como em Editar |

Desfazer (DM14, só app; endpoints em 6.5):
- **Excluir:** depois da confirmação, a linha some localmente (filtro em memória por id sobre os dados em cache, sem `setQueryData` nos totais) e o `DELETE` só é enviado quando o toast "Desfazer" de 5 s expira. "Desfazer" cancela o envio e restaura a linha. Se o app for para segundo plano ou a sessão terminar antes de 5 s, o envio acontece imediatamente (não deixar exclusão confirmada pendurada); falha no envio => a linha volta com a mensagem de erro. A fila de exclusões adiadas é um módulo puro em `src/core/deferred-actions.ts` (relógio injetado), testado sem React.
- **Editar:** o `PUT` vai na hora; "Desfazer" (5 s) envia outro `PUT` com o payload anterior (`buildUpdateExpensePayload` dos valores originais). Erros desse segundo `PUT` (inclusive 422 `PAID_CARD_EXPENSE_DATE_LOCKED` se a despesa foi paga nesse meio-tempo) aparecem como toast de erro; sem retry.
- **Pagar** (uma, em lote, fatura): sem desfazer (a API não desmarca); confirmação obrigatória.

Demais regras:
- Atualização otimista dos totais: **não** na v1 (os totais e subtotais vêm do servidor e divergiriam até a resposta). A ocultação local da linha na exclusão adiada é apresentação, não otimismo de dados.
- Envio duplo: botões de mutação desabilitados enquanto `isPending` (CA27).
- Visibilidade das ações (B6, substitui DM11): editar/excluir com `me.capabilities` contendo `MANAGE_EXPENSES` (toda conta autenticada hoje) e só para despesas (receitas não são editáveis nem excluíveis, DM12). Pagar aparece para despesas pendentes. A regra fica em `src/core/entry-actions.ts` (pura, testada) e **não** lê `role` nem `accountKind`.
- Sair (RF05) e 401: `queryClient.clear()` (antes, as exclusões adiadas pendentes são enviadas, regra acima).
- Máquina de sessão pura (`src/core/session-machine.ts`): estados `booting | signedOut | passwordChangeRequired | signedIn | offline | updateRequired`; eventos `TOKEN_FOUND`, `TOKEN_EXPIRED_LOCALLY`, `ME_OK`, `ME_401`, `NETWORK_ERROR`, `LOGIN_OK`, `MUST_CHANGE_PASSWORD`, `SESSION_EXPIRED`, `UPDATE_REQUIRED`, `LOGOUT`.
- **Cliente HTTP:** timeout 15 s (`AbortController`), interpreta só `code` (RNF06). 401 em rota protegida => `SESSION_EXPIRED`: apaga a sessão, `queryClient.clear()`, login com "Sua sessão expirou. Entre novamente." (sem renovação, B2). 403 `PASSWORD_CHANGE_REQUIRED` => `MUST_CHANGE_PASSWORD` (10.10). 426 => 10.7.
- Listas com `@shopify/flash-list` (RNF07).

### 10.9 Formulários e teclado do Valor (DM9)

- Campo Valor: `keyboardType="decimal-pad"` (vírgula no teclado pt-BR), texto livre interpretado por `parseMoneyInput` (sincronizado). Ao sair do campo, formata com milhar e 2 casas ("1234,5" -> "1.234,50"); ao reentrar, mantém o texto formatado (pontos aceitos por `parseMoneyInput`). Envio: string decimal (`"1234.50"`, CA23). **Não** usar `maskMoneyInput` (máscara da direita para a esquerda; contraria o CA23).
- Como o `decimal-pad` do iOS não tem tecla de retorno, a folha tem uma barra acima do teclado com "Concluído"/"Próximo" (design).
- Edição (`edit/[id].tsx`): mesmo componente de formulário da criação, com `type`, forma de pagamento e cartão só leitura (DM12); payload por `buildUpdateExpensePayload` (sincronizado); Data desabilitada para despesa paga no cartão.

### 10.10 Troca de senha (B4, B8, P-ADR1)

**Troca obrigatória (não feita no app) - P-ADR1 = variante A** (design §5.3.1 e §6.2.1). Sinais verificados no código: `user.mustChangePassword = true` na resposta de `POST /api/auth/login` e de `GET /api/auth/me` (rota liberada durante a troca), e 403 `PASSWORD_CHANGE_REQUIRED` em qualquer outra rota protegida (`PasswordChangePolicy`).

Comportamento do app em qualquer um dos três casos:
1. Não grava a sessão no Keychain (no login) ou apaga a gravada (boot/meio da sessão); limpa o cache; fecha folhas e alertas.
2. Chama `POST /api/auth/logout` com o token, em melhor esforço (falha de rede é ignorada; a sessão expira em 24 h de todo modo).
3. Vai para `(auth)/password-change-required` (tela 6.2.1 do design, variante A): explica que é preciso definir uma nova senha no site, com "Abrir o site" (abre `EXPO_PUBLIC_WEB_URL` + `/login` no navegador do sistema via `ExternalBrowser`) e "Sair" (volta ao login; a sessão já foi encerrada no passo 2). Sem tabs e sem gesto de voltar.

Variante B (botão "Alterar senha" que troca a senha no próprio app em modo pendente) **descartada**: contraria B4 e exigiria manter viva uma sessão com troca pendente.

Por que encerrar a sessão em vez de mantê-la: a troca no web roda `ChangeOwnPassword`, que encerra todas as outras sessões do usuário, inclusive a do app; manter o token não teria utilidade e deixaria uma sessão viva de um usuário com troca pendente. Na prática o 403 no meio da sessão é raro: `ResetUserPassword` e `RecoverAdminAccess` já encerram as sessões (o app recebe 401); ele cobre a janela de corrida.

**Troca opcional em Ajustes.** `(tabs)/settings/change-password.tsx`, **visível só** com `CHANGE_OWN_PASSWORD` (a conta de demonstração não vê o item, B8; não é um item desabilitado). Campos: senha atual, nova, confirmação. Validação local de apoio: presença, nova com 8-72 code points, confirmação igual (sem chamar a API se divergir). `PUT /api/account/password` com `{ currentPassword, newPassword }`. Sucesso: `setQueryData(['me'], resposta)`, a sessão do app continua válida (a API mantém a sessão atual) e o app informa que as outras sessões, inclusive no site, foram encerradas. Erros: 403 `FORBIDDEN` (mensagem genérica + `invalidateQueries(['me'])`, o item some), 400 por campo (`INCORRECT` em senha atual; `TOO_SHORT`/`TOO_LONG`/`SAME_AS_CURRENT` em nova), 429 com `retryAfterSeconds` ("Tente novamente em N min"). Sem retry automático.

### 10.11 Conta de demonstração no app (B5-B9, P-ADR5)

- Sem botão "Ver demonstração" e sem `/api/demo/*`: a pessoa digita `demo@showcase.invalid` e `demo` no login, como qualquer conta. O campo de login é de e-mail (teclado `email-address`, `autoCapitalize="none"`); a validação local continua só de presença, como no web.
- "É a conta demo?" = `isDemoAccount(me)` (`accountKind === 'SHOWCASE'`, P-ADR5). Nunca por e-mail. Uso único: o aviso de que a conta é compartilhada e que lançamentos e cartões são apagados todo dia às 03:00 (horário de Brasília) (card de boas-vindas e Ajustes, textos do design). "Alterar senha" some pela capacidade (B8), não por `accountKind`.
- Todas as ações financeiras do app ficam disponíveis (a conta tem `MANAGE_EXPENSES`, B6). Sem cartão, a opção Cartão segue RF21 ("Cadastre um cartão no site").
- Notas para a revisão da Apple: credenciais `demo@showcase.invalid` / `demo` e explicação de que a conta começa vazia (e volta a ficar vazia todo dia às 03:00 BRT).

### 10.12 T8, T10, T11 - Observabilidade, CI e stub

- **T8:** sem SDK de crash reporting na v1 (RNF09); relatórios do TestFlight/App Store Connect. Logger do app: em produção não emite nada; em dev, redige `Authorization`, senhas, e-mail e valores.
- **T10:** `.github/workflows/mobile.yml`: em PR que toca `mobile/` ou arquivos sincronizados: lint, `tsc --noEmit`, Vitest, Jest, `check-shared-rules`. Em tag `mobile-v*`: `eas build --platform ios --profile production --auto-submit` (TestFlight). Segredo `EXPO_TOKEN` no GitHub; chave da App Store Connect API nas credenciais do EAS.
- **T11:** os e2e do app reaproveitam `web/e2e/stub-api/server.mjs`, estendido com `X-Client`/426, `accountKind`/`capabilities` no `me`, login `demo@showcase.invalid` (conta SHOWCASE com 403 `FORBIDDEN` na troca de senha), usuário USER com editar/excluir liberados (B6) e dois usuários (CA29, lançamento do outro => 404). Pagar, pagar em lote, editar e excluir já existem no stub (usados pelo web); conferir paridade.

### 10.13 Sinal de "conta sem dados" (design 6.3.1 e 6.4.1)

**Validação da proposta do design** (categorias vazias **e** série de 12 meses zerada):

- `GET /api/categories` é derivado de `entries` sem filtro de mês nem de tipo (1): `items = []` **se e somente se** o usuário não tem nenhum lançamento. Não existe catálogo de categorias que possa existir sem lançamentos, então a ressalva do design ("se as categorias puderem existir sem lançamentos") não se aplica.
- A série de 12 meses é, portanto, **redundante** como confirmação (categorias vazias implicam série zerada) e só piora o sinal: o card de boas-vindas esperaria uma segunda resposta e teria um modo de falha a mais.
- Cartões não entram no sinal: uma conta com cartão e sem lançamentos continua "sem dados" para Dashboard e Finanças (o que é verdade para o que essas telas mostram). Na conta de demonstração, depois da limpeza diária, não sobra nem cartão (B9).

**Decisão:** o sinal é **só** `categories.items.length === 0`, numa função pura `isAccountEmpty(categories: string[] | undefined): boolean | undefined` em `mobile/src/core/account-empty.ts` (`undefined` enquanto carrega ou em erro: nesses casos as telas usam o layout normal, como o design já prevê). Dashboard e Finanças leem a mesma chave `['categories']` (que já é invalidada por toda mutação financeira, 10.8), então criar o primeiro lançamento ou excluir o último troca o estado nas duas abas sem lógica extra. A série continua sendo buscada em paralelo para o layout normal, mas não decide nada.

**Contrato:** nenhuma mudança na API. A semântica passa a ser **documentada** em `docs/api/finance.md` (doc-writer): "`GET /api/categories`: categorias usadas nos lançamentos do usuário (receitas e despesas, qualquer mês). Lista vazia se e somente se o usuário não tem lançamentos." Um teste de integração do read model (11.1) fixa essa propriedade, para que uma mudança futura (por exemplo, catálogo de categorias padrão) quebre o teste antes de quebrar o app.

Alternativa descartada: campo `hasEntries` em `GET /api/auth/me` ou endpoint `GET /api/entries/exists` (contrato novo e acoplamento de identity a finanças, para uma informação que a API já expõe de forma exata).

---

## 11. Plano de testes por camada

### 11.1 API

| Camada | Tipo | O que cobre |
|---|---|---|
| domain | unitário | `AppVersion.compare` (`1.10.0 > 1.9.0`, igualdade, inválido); `parseClientHeader` (ausente => WEB, `mobile/1.2.3`, lixo => erro); `MinimumAppVersionPolicy` (WEB sempre ok; MOBILE abaixo/igual/acima). `User.showcase` e `restore` com as invariantes de SHOWCASE (hash nulo, role ADMIN, `mustChangePassword` true, id/e-mail errados => erro); `canAuthenticate` (REGULAR/SHOWCASE ativos sim; DEMO, marcador, inativos não); `isManageable`/`isActiveAdmin` falsos para SHOWCASE; `replaceShowcasePassword` só em SHOWCASE; `changePassword`/`rename` lançam em SHOWCASE. `AccountCapabilities.of` (tabela 3.4 completa, **inclusive REGULAR USER com `MANAGE_EXPENSES`**). `PlainPassword.forShowcaseAccount` (`demo` ok; vazio; > 72) e `PlainPassword.create('demo')` continua `TOO_SHORT` (regressão da regra geral). `LocalTimeOfDay.parse` (`03:00`, `23:59`, `24:00` e `3:00` inválidos). Eventos sem dados sensíveis. |
| application | unitário com fakes | `LoginWithPassword`: `demo@showcase.invalid` + senha encontra a conta pelo fluxo comum; `demo` (sem domínio) => `INVALID_CREDENTIALS` sem consultar o repositório (não há alias); falhas com o e-mail da conta **não** alimentam `login-email-failures` (6 erros seguidos e o 7º login correto passa); e-mail comum continua bloqueando (regressão); auditoria com `client`; RNF05 (verify chamado em todos os ramos). `AuthenticateSession`: SHOWCASE autentica com `MANAGE_EXPENSES`; REGULAR USER recebe `MANAGE_EXPENSES`; DEMO continua 401. `GetCurrentUser`: `accountKind` `SHOWCASE`/`REGULAR`. `ChangeOwnPassword` (CA48): SHOWCASE => `ForbiddenError` **mesmo com senha atual errada**, sem chamar o hasher, sem consultar nem alimentar `password-change-user-failures`; `UpdateOwnProfile`: SHOWCASE => `ForbiddenError`. `EnsureShowcaseAccount`: created, unchanged (mesma senha), updated (senha mudou => sessões encerradas), disabled (sem senha => inativa e encerra sessões), absent, conflict (e-mail tomado por REGULAR => não altera nada), não reativa conta inativa, senha > 72 => erro de configuração sem valor na mensagem. `CheckClientCompatibility`. `UpdateExpense`/`DeleteExpense` (finance): id de outro dono => `EntryNotFoundError` e nada alterado (regressão explícita do escopo de B6). `PurgeShowcaseData`: com relógio e `DailyTimeCalculator` falsos, repassa o dono e o corte = último 03:00 (às 03:00:00 exatas, às 02:59 => corte do dia anterior, às 14:00 => 03:00 do mesmo dia) e devolve as contagens de lançamentos e cartões. Cobertura >= 80% em domain/application. |
| bootstrap | unitário | `MaintenanceScheduler` com timers falsos (`vi.useFakeTimers`), `Clock` e `DailyTimeCalculator` falsos: `intervalMs = 0` não agenda nada (nem diária); tarefas `interval` rodam em ordem a cada tick; tarefa `daily` roda no boot (recuperação) e de novo exatamente no próximo 03:00, e reagenda; falha numa tarefa não impede as outras nem a próxima execução (log com `name`); `onModuleDestroy` limpa os timers. |
| infrastructure | integração (testcontainers) | Migrations aplicadas sobre o schema atual (duas etapas, enum + CHECK). `users_showcase_chk` rejeita SHOWCASE sem hash, com role ADMIN, com outro id ou e-mail, com `must_change_password = true`. `PrismaUserRepository` grava/lê SHOWCASE; listagem e contagem de administradores ignoram a conta. `PrismaSessionPrincipalLookup` devolve `kind = SHOWCASE`. `PrismaShowcaseDataPurger` (B7, B9): apaga lançamentos do dono anteriores ao corte e mantém os posteriores; apaga cartão antigo (inclusive o que tinha lançamentos antigos, já apagados na mesma transação); mantém cartão antigo com lançamento posterior ao corte; mantém cartão criado depois do corte; não toca outro dono; tudo ou nada (falha no segundo `DELETE` desfaz o primeiro). `PrismaCategoryReadModel`: dono sem lançamentos => `[]`; com uma receita em qualquer mês => não vazio; com cartão e sem lançamentos => `[]` (propriedade de 10.13). `SaoPauloDailyTimeCalculator` (sem banco, roda com os testes de infraestrutura): `lastOccurrence`/`nextOccurrence` para 03:00 em instantes UTC próximos da virada (`2026-11-02T05:59:59Z`, `06:00:00Z`, `06:00:01Z`) e com o processo em `TZ=UTC` e `TZ=Asia/Tokyo`. |
| presentation | e2e (supertest) | Login com e sem `X-Client`; `X-Client` inválido => 400; versão abaixo da mínima => 426 em login, `me`, rota do finance e `/api/demo/*`, antes do 401. Conta de demonstração (senha gerada no teste): `demo@showcase.invalid` + senha => 200 com `accountKind: SHOWCASE` e `capabilities: ['MANAGE_EXPENSES']`; `email: "demo"` => 401 `INVALID_CREDENTIALS`; `PUT /api/entries/:id` e `DELETE` => 200/204; **CA48:** `PUT /api/account/password` => 403 `FORBIDDEN` com senha atual correta, errada e com corpo inválido (o 403 vence o 400), e 6 tentativas seguidas continuam 403 (nunca 429); `/profile` => 403 `FORBIDDEN`; `/api/admin/users` => 403. **B6:** REGULAR USER edita (200) e exclui (204) o próprio lançamento; USER e ADMIN recebem **404 `ENTRY_NOT_FOUND`** ao editar/excluir lançamento de outro usuário, e o lançamento continua intacto; ADMIN inalterado; `me` de USER traz `MANAGE_EXPENSES` e `accountKind: REGULAR`. `Cache-Control: no-store` em login e `me`. **CA31**: com `TRUST_PROXY=127.0.0.1` (simulando o nginx), 21 logins variando `X-Forwarded-For` vindos do mesmo peer com XFF sobrescrito => o 21º é 429; e um teste de `loadEnv` em produção rejeitando `TRUST_PROXY` ausente, `true`, `2`, `uniquelocal`. Respostas do web compatíveis (snapshot do `AuthResponse`: só campos acrescentados). |

### 11.2 Web

- Unitário: `decideRoute('/privacy')` e `('/support')` => `next` com e sem cookie; `buildUpdateExpensePayload` (mesmos casos que hoje estão no teste do drawer); `payment-feedback.ts` (casos que hoje estão em `feedback.spec.ts`, sem mudança de texto).
- Componentes (B6, B8): `entries/page.tsx`/lista mostra editar/excluir para USER, ADMIN e SHOWCASE (todos com `MANAGE_EXPENSES`) e esconde quando a capacidade falta (caso sintético); a página `/demo` continua sem as ações; nenhuma ação de "Desfazer" no web; menu da conta esconde "Alterar senha"/"Perfil" para SHOWCASE e "Usuários" sem `MANAGE_USERS`.
- E2E (Playwright): as duas páginas públicas acessíveis sem login, sem chamadas à API, axe sem violações; login `demo@showcase.invalid` no stub; USER edita e exclui uma despesa própria.
- CI: `check-shared-rules` também no pipeline do web.

### 11.3 Mobile

| Camada | Ferramenta | O que cobre |
|---|---|---|
| `src/lib` (sincronizado) | Vitest (Node) | os mesmos specs do web, sem edição (CA23, CA24, CA18 em string). |
| `src/core` | Vitest | máquina de sessão (todas as transições, inclusive `TOKEN_EXPIRED_LOCALLY` e `MUST_CHANGE_PASSWORD` a partir de login, boot e 403); mapeamento de erros por `code` (401, 403 `PASSWORD_CHANGE_REQUIRED`, 403 `FORBIDDEN`, 404 de cada mutação, 422 de cada mutação, 426, 429 com `retryAfterSeconds`, rede, timeout); `isFinanceQuery` (inclui todas as chaves financeiras, exclui `me` e `cards`); `entry-actions` (editar/excluir só despesa e só com `MANAGE_EXPENSES`, independente de `role` e `accountKind`; pagar só pendente; receita nunca); `isDemoAccount` (só por `accountKind`; um `me` REGULAR com e-mail `demo@showcase.invalid` => false); `isAccountEmpty` (`[]` => true, lista => false, `undefined` => undefined); `deferred-actions` (envio após 5 s, desfazer cancela sem chamada, flush imediato em segundo plano/logout, falha restaura); `initial.ts`; `currentYearMonthSP`/`todaySP` com relógio falso (CA15). |
| `src/data` | Jest + MSW (`msw/node`) | cliente HTTP: Bearer, `X-Client`, timeout 15 s, 401 => sessão apagada e cache limpo, 426 global; cada mutação chama a rota e o corpo exatos de 6.5 (inclusive `POST /api/entries/pay` com `{ ids }` e o `PUT` de desfazer com o payload anterior) e dispara a invalidação; mutação sem retry; 404 em excluir tratado como sucesso; desfazer exclusão não faz requisição. |
| `src/platform` | Jest com mocks | opções do Keychain; marcador de instalação (CA10); nada de token em AsyncStorage (CA01); `ExternalBrowser` abre a URL do site. |
| telas/componentes | Jest + jest-expo + RNTL + MSW | login (banner genérico CA02, 429 CA03, envio duplo, `demo@showcase.invalid` aceito); troca obrigatória variante A (logout chamado, sessão não gravada, "Abrir o site", "Sair", sem tabs); troca opcional (confirmação divergente sem chamar a API, erros por campo, 429, 403 remove o item, sucesso mantém a sessão; item ausente para SHOWCASE); formulários de criação (payloads exatos CA21/CA22/CA25, `decimal-pad` + `parseMoneyInput`, CA23, envio duplo CA27, sem cartão CA28, prévia CA24); edição (campos só leitura, Data desabilitada para paga no cartão, 422 no campo Data, desfazer); excluir com confirmação e desfazer; pagar uma (círculo, DM15), em lote (modo de seleção, até 100, DM16) e fatura (toast com valor da resposta); ações visíveis para USER (B6); aviso da conta demo só com `accountKind = SHOWCASE`; conta sem dados: card de boas-vindas só com `categories = []`, layout normal com categorias em erro, volta ao normal após criar o primeiro lançamento; Dashboard (erro isolado por bloco CA14, saldo negativo CA12, resumo acessível CA13); Finanças (mês inicial CA16, paginação CA17, faturas CA19, vazio/erro CA20); detalhe da fatura dentro da aba com tab bar visível (DM8). |
| E2E | Maestro em simulador iOS (build `e2e`) contra o stub | login, troca obrigatória (bloqueio e saída), sessão expirada (401 => login), criação dos três tipos, pagar/editar/excluir (com desfazer) uma despesa e uma parcela como USER, pagar em lote, pagar fatura, conta `demo@showcase.invalid` (começa no card de boas-vindas, com o aviso de limpeza), navegação de Finanças e Dashboard, diagnóstico de Intl em `TZ=UTC` e `TZ=Asia/Tokyo`, dois usuários (CA29), atualização obrigatória (426). |
| Configuração | teste de build | `app.config.ts` de produção sem exceção de ATS e com URLs `https://` (API e site) (CA30). |
| Acessibilidade | manual guiado + RNTL | rótulos, alvos >= 44 pt, Dynamic Type XXL, ações de deslizar com alternativa acessível (`accessibilityActions`), "Desfazer" alcançável pelo VoiceOver antes de expirar. |

---

## 12. Violações de SOLID e dívida técnica

### 12.1 Violações que afetam a feature (tratadas neste ADR)

| # | Onde | Problema | Ação |
|---|---|---|---|
| S5 | `identity/presentation/guards/access-control.guard.ts:24` | **OCP**: o atalho de rota pública está fixo no guard; nenhuma política consegue valer para rotas públicas (o 426 precisa valer no login) sem editá-lo. | `prePolicies` injetadas por token (6.3). |
| S7 | `entries.controller.ts:60,71`, `role.policy.ts`, `access-metadata.ts` | **OCP/SRP**: autorização expressa como nível (`@RequireRole('ADMIN')`) mistura "quem administra usuários" com "quem edita despesas". B6 mostra o custo: liberar edição para USER, mantendo a gestão de usuários só para ADMIN e tirando a troca de senha da conta de demonstração, não cabe em "nível". | `Capability` + `AccountCapabilities` (domínio) + `@RequireCapability` (3.4, 6.3). Liberar USER (B6) vira uma linha na tabela de capacidades. |
| S8 | `authenticate-session.ts:19` x `user.ts:182` | **SRP/DRY**: "quem pode autenticar" está em dois lugares (aggregate e use case, este sobre o registro cru). Acrescentar SHOWCASE só num deles abriria uma falha silenciosa. | Função de domínio `AuthenticationEligibility.canAuthenticate(kind, status)` usada pelos dois. |
| S9 | `bootstrap/maintenance.scheduler.ts`, `app.module.ts:18-20` | **OCP/DIP/SRP**: depende concretamente de cada tarefa (`EnsureDemoUser`, `RefreshDemoDataset`, `PurgeExpiredSessions`); cada tarefa nova edita o construtor, o `runOnce` e a factory; um único `try/catch` faz uma falha pular as tarefas seguintes; e o agendamento só conhece "a cada N ms", então B7 (horário fixo de São Paulo) não cabe sem reescrever a classe. | `MaintenanceTask { name; schedule; run }` com `schedule` `interval` ou `daily` (5.4), lista injetada por `MAINTENANCE_TASKS`; cálculo de horário civil isolado no port `DailyTimeCalculator` (DIP: o scheduler não usa `Intl`); `try/catch` por tarefa. `PurgeShowcaseData` entra como tarefa diária. |
| S10 | `web/app/(protected)/entries/page.tsx:16`, `web/components/account-menu.tsx:51` | **SRP/DRY** (cliente): a regra de autorização (`role === "ADMIN"`) é reimplementada no web e seria copiada no app. Com B6 ela fica errada (USER passa a poder editar). Do mesmo modo, "é a conta demo" por comparação de e-mail (sugestão de fallback do design, P-ADR5) duplicaria uma regra do domínio no cliente. | O cliente lê `capabilities` e `accountKind` da API (9, 10.8, 10.11). |
| S11 | `web/lib/entries/feedback.ts`, `web/features/entries/_components/edit-expense-drawer.tsx` | **SRP**: mensagens puras misturadas com navegação por URL; validação/payload da edição dentro do componente. Impedem reaproveitar no app sem cópia divergente (e o desfazer da edição, DM14, precisa do payload fora do componente). | Extrair `payment-feedback.ts` e `buildUpdateExpensePayload` (9), sincronizados (10.3). |

### 12.2 Dívida técnica (registrada, fora desta feature)

| # | Item | Por que não agora |
|---|---|---|
| D1 | **`SessionIssuer`** (extrair a abertura de sessão de `LoginWithPassword`, que tem 9 dependências, SRP - antigo S1). | Sem refresh, o login é o único emissor de sessão; extrair agora não remove duplicação. Volta a valer se surgir um segundo emissor (renovação, SSO). |
| D2 | **`UserSessionsTerminator`** (a regra "encerrar sessões do usuário" repetida em `change-own-password.ts:80`, `deactivate-user.ts:34`, `reset-user-password.ts:42`, `recover-admin-access.ts:41` e agora `EnsureShowcaseAccount` - antigo S3). | Sem famílias de renovação, cada chamada continua sendo uma linha em `tx.sessions`; o risco de esquecimento existe mas não cresce com esta feature. Fazer junto com D1. |
| D3 | `Logout` fora do UoW (antigo S6). | Sem família, é uma exclusão só; não há atomicidade a garantir. |
| D4 | `IdentityAuditLog` com 11 métodos para consumidores distintos (ISP, antigo S4). | Esta feature só acrescenta um parâmetro a dois métodos; dividir o port mexe em todos os fakes. |
| D5 | **RESOLVIDA.** `parseNewUser` aceitava e-mails `.invalid` (reservados): um admin poderia criar `demo@showcase.invalid` antes do seed. | Agora criar ou editar usuário com e-mail `.invalid` responde 400 `INVALID_FORMAT` (antes 409 `EMAIL_TAKEN` para o e-mail demo). Mudança de contrato de admin aceita; spec de autenticação (P06, CA17) atualizada. O seed ainda detecta conflito legado. |
| D6 | Reativar a conta de demonstração exige ação explícita (hoje: SQL ou apagar a linha e reiniciar). | Caso raro; um script `npm run showcase:enable` pode vir depois. |
| D7 | Pacote `packages/finance-rules` com npm workspaces no lugar da cópia sincronizada. | Exige refazer o contexto de build do web. |
| D8 | `AttemptLimiter` em memória (R8). | Válido com uma réplica. |
| D9 | `SaoPauloBusinessCalendar` e `SaoPauloDailyTimeCalculator` repetem a montagem do `Intl.DateTimeFormat` de São Paulo. | Dois adapters pequenos no mesmo diretório; unificar num helper de infraestrutura quando surgir um terceiro uso. |

### 12.3 Divergências do código e pendências (registradas na documentação final)

O que o código realmente faz difere do texto acima nos pontos a seguir; cada pendência tem motivo e critério de saída.

| # | Item | Motivo | Critério de saída |
|---|---|---|---|
| I7 | Os fluxos Maestro (`mobile/e2e/maestro/*.yaml`) **não foram executados**. O stub `web/e2e/stub-api/server.mjs` não tem `X-Client`, 426 nem a conta showcase. | Não há simulador iOS no ambiente Linux de desenvolvimento. | Estender o stub conforme a T11 e rodar os fluxos num Mac ou em CI macOS, todos verdes. |
| S8 | O ADR 10.5 tratava gifted-charts como exceção ao CLAUDE.md. | O CLAUDE.md agora diz: "Gráficos: Recharts (web). No app mobile (React Native), react-native-gifted-charts — ver ADR 0011." | **Resolvida:** 10.5 alinhada; nada a fazer. |
| D5 | `.invalid` em criação/edição de usuário. | Ver 12.2. | **Resolvida** (400 `INVALID_FORMAT`). |

**Desvios de UI aceitos na v1** (o design rev. 3 previa o contrário):

- Sem swipe e sem menu de contexto: as ações (editar, excluir, pagar) ficam como botões na linha.
- Data digitada no formato `dd/mm/aaaa`, sem date picker nativo.
- Sem SF Symbols e sem háptica.
- Sem barra "Concluído" acima do teclado.
- "Sair" sem confirmação.
- Categoria e cartão escolhidos dentro do formulário.
- iOS mínimo **16.4** no lugar de 16.0 (exigência do SDK 58).
- Rótulo oficial "Trocar senha", igual ao web.
- Na conta demo, "Trocar senha" aparece **visível e desabilitado**. O design prevalece sobre a spec, que dizia "oculto" (8, B8).

**Validação manual pendente** (não automatizável no ambiente atual): gráficos, VoiceOver, Dynamic Type, Keychain real em aparelho e `/diagnostics` com outro fuso (`TZ=UTC`, `Asia/Tokyo`).

**Placeholders antes do primeiro build:** ícone, splash, `ascAppId`, `appleTeamId`, `projectId` do EAS, `bundleIdentifier` e URLs reais de API/web (`mobile/README.md`).

**Deploy** (checklist em 6.1 e 8):

- `TRUST_PROXY` é obrigatório em produção, **inclusive para o seed** (o processo de seed carrega a mesma configuração e falha sem ela).
- `SUPPORT_EMAIL` é obrigatório no web em produção (a App Store exige contato em `/support`; sem ela o build apenas avisa e a página mostra texto genérico).
- Requisitos N1-N10 do nginx, incluindo bloquear `/api/admin/*` e `/api/demo/*` no listener público (N4) e fazer o web chamar a API por um listener interno (N3).

---

## 13. Decisões, alternativas descartadas e trade-offs

| Decisão | Alternativas descartadas | Trade-off aceito |
|---|---|---|
| B1: API pública atrás do nginx, `TRUST_PROXY` só no nginx, BFF passando pelo listener interno | BFF direto na API com o IP do web também confiável; gateway de repasse no Next; lista de rotas permitidas no nginx | Um salto a mais nas chamadas do BFF (rede interna, desprezível) e uma configuração de nginx com dois listeners, mantida fora do repo. |
| Bloquear `/api/admin/*` e `/api/demo/*` no host público | Expor tudo (o guard já barra admin) | Defesa em profundidade com custo mínimo; o web continua alcançando pelo listener interno. |
| B2: sessão mobile = web (24 h fixas), sem renovação | Refresh rotativo com família (revisão anterior); sessão deslizante | O usuário do app entra de novo a cada 24 h; em troca, zero tabelas e zero estados novos de sessão. |
| Não persistir `client_kind` | Coluna em `sessions` "para auditoria" | Auditoria de login fica só em log (já atende RNF13). |
| Conta de demonstração como `UserKind = SHOWCASE` com role USER + capacidades | Torná-la ADMIN e bloquear `/api/admin/*` por exceção (contaria para `LAST_ADMIN`, apareceria na gestão); reaproveitar o `DEMO` existente (é dono do dataset público e não pode ter senha, CHECK); coluna `username` em `users` | Um tipo de conta novo e a troca de "nível" por "capacidade" na autorização. |
| B5 rev. 3: login da conta com o e-mail `demo@showcase.invalid` pelo fluxo comum | Alias `demo` convertido em e-mail (`LoginIdentifier`, rev. 2); coluna `username` | O visitante digita um e-mail mais longo; em troca, nenhum caso especial de formato no login. |
| Isenção de `login-email-failures` para o e-mail da conta | Aplicar o bloqueio por e-mail também a ela | Qualquer um pode tentar senhas na conta sem bloqueio por conta (a senha é pública de todo modo); continua o limite por IP e o N8. |
| `PlainPassword.forShowcaseAccount` restrito por lint | Relaxar a regra geral; senha da conta com 8+ caracteres (contraria B5) | Um factory a mais, com uso controlado. |
| P-ADR5: `accountKind` (enum) em `me` | `isShowcase: boolean`; comparar o e-mail no cliente | Um enum com dois valores hoje; em troca, um tipo de conta futuro não exige um booleano novo, e o cliente não replica regra de domínio. |
| B6: `MANAGE_EXPENSES` para toda conta autenticada, escopo por dono no repositório (404) | Apagar a capacidade e o decorator de PUT/DELETE; 403 para lançamento de outro dono | Uma capacidade sempre presente; em troca, um único ponto para restringir de novo e clientes que não leem `role`. 404 não revela a existência do lançamento alheio. |
| B8/CA48: conta sem troca de senha nem renomear perfil; 403 antes de conferir a senha | "Todas as ações" literal; responder 400 `INCORRECT` primeiro | A conta compartilhada não pode ser trancada nem vandalizada no nome; o 403 não vaza se a senha atual estava certa nem consome o limitador. |
| B7/B9: limpeza diária às 03:00 de São Paulo, por corte `created_at < último 03:00`, de lançamentos e cartões | 24 h após a criação de cada registro (rev. 2); `deleteAllOf` sem corte (um reinício no meio do dia limparia a conta); estado "última limpeza" persistido; cron de sistema fora da API; `ON DELETE CASCADE` em `entries.card_id` | Lançamentos criados logo antes das 03:00 duram minutos; um cartão antigo com lançamento novo sobrevive até a execução seguinte. |
| Scheduler com tarefas `interval` e `daily` por token | Biblioteca de cron (`@nestjs/schedule`, `node-cron`); continuar no `setInterval` checando a hora a cada tick | Um pouco de código de agendamento próprio (testado com timers falsos), sem dependência nova; precisão de horário sem depender de `MAINTENANCE_INTERVAL_MS`. |
| Sinal de conta sem dados = `GET /api/categories` vazio (10.13) | Categorias + série (design); `hasEntries` em `me`; endpoint novo | A semântica de `/api/categories` vira contrato documentado e testado. |
| P-ADR1 = variante A: troca obrigatória fora do app, com logout e "Abrir o site" | Variante B (troca no app em modo pendente); manter o token até o usuário trocar no site | Usuário refaz o login no app depois da troca (que de todo modo derruba a sessão do app). |
| Provisionamento no seed, por variável de ambiente | Script manual; senha fixa no código | Ligar/desligar exige reiniciar a API. |
| Sem `client_kind` mas com `X-Client` + 426 | Configuração remota no boot | 426 é uso pragmático; o `code` guia o app. |
| Invalidação ampla após qualquer mutação | Invalidação cirúrgica por mês/fatura; atualização otimista | Algumas requisições a mais nas telas ativas. |
| DM14 (só app): exclusão adiada 5 s no cliente; desfazer da edição por um segundo `PUT` | Exclusão lógica na API com restauração; endpoint de desfazer; levar o desfazer ao web | Uma exclusão confirmada pode ficar pendente por até 5 s (enviada na hora se o app sair do primeiro plano); web e app diferem nesse ponto. |
| Expo + EAS | RN CLI | Dependência de serviço externo para build. |
| Cópia sincronizada com verificação | npm workspaces agora; cópia livre | Arquivos duplicados até D7. |
| gifted-charts (exceção ao Recharts, só mobile, registrada aqui) | Victory Native XL, SVG próprio | CLAUDE.md não muda; a exceção vive neste ADR. |
| TanStack Query só em memória | persister em disco | Abertura a frio sempre busca na rede. |
| Sem crash reporting na v1 | Sentry com scrubbing | Menos visibilidade de falhas. |

---

## 14. Riscos que permanecem

- **R3 (revisão da Apple):** a conta de demonstração começa vazia e sem cartão; o revisor vê o card de boas-vindas até criar algo. Mitigar com notas de revisão explicando o fluxo (criar uma despesa PIX). Se rejeitado por "app de uso restrito", avaliar distribuição "Unlisted". Se a revisão cruzar as 03:00 BRT, o que o revisor criou some (registrar nas notas).
- **Conta compartilhada:** conteúdo criado por um visitante (lançamentos e cartões) fica visível a outros até as 03:00 seguintes (até ~24 h). Mitigado pela limpeza (B7/B9), pelo interruptor e pelo aviso no app.
- **B6 no web:** USER passa a poder excluir despesas por engano; no web a confirmação existente continua sendo a única proteção (sem lixeira e sem desfazer, que é só do app).
- **Exclusão adiada no app (DM14):** se o processo do app for morto pelo sistema dentro dos 5 s sem passar por segundo plano (raro no iOS), a exclusão confirmada não é enviada; a despesa reaparece na próxima abertura. Aceito (falha segura: nada é perdido).
- **R8:** limitador em memória correto só com uma réplica (D8); o N8 do nginx ajuda.
- **Configuração do nginx fora do repo:** N1-N10 não são verificáveis no CI; dependem do checklist de deploy e do teste manual pós-deploy (8).
- **Hermes/Intl:** depende da verificação em simulador (10.6); plano B definido.
- **Sessão de 24 h no celular:** usuários podem achar incômodo entrar todo dia; revisitar B2 com dados de uso.

---

## 15. Ordem de implementação sugerida

1. [api] Refatorações S5, S7, S8, S9 sem mudança de comportamento (testes atuais verdes; capacidades reproduzem exatamente ADMIN/USER; scheduler com as três tarefas atuais como `interval`).
2. [api] B6: `MANAGE_EXPENSES` para REGULAR USER + e2e de dono (404) e de USER editando/excluindo. Primeira mudança de comportamento, isolada.
3. [db] Migrations 7.2 + integração.
4. [api] Cliente/426, conta SHOWCASE (domínio, `forShowcaseAccount`, `EnsureShowcaseAccount`, seed, isenção do limitador, CA48), `accountKind` e `capabilities` em `me`, `PurgeShowcaseData` (lançamentos e cartões) + `DailyTimeCalculator` + tarefa diária, `TRUST_PROXY` obrigatório em produção, e2e (inclui CA31).
5. [web] `/privacy`, `/support`, `capabilities` (USER passa a ver editar/excluir; SHOWCASE sem senha/perfil), extrações S11, `check-shared-rules`.
6. [deploy] nginx N1-N10, `API_URL` do web, variáveis novas; teste manual.
7. [mobile] Fundação (10.2-10.4, diagnóstico de 10.6), leitura, sinal de conta vazia (10.13), criação, ações de B3 com pagar em lote (DM16) e desfazer (DM14), troca de senha (10.10, variante A), conta de demonstração (`accountKind`).
