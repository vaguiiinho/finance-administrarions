# ADR 0005 - Autenticação, gestão de usuários, autorização por dono e modo demonstração

- **Status:** Aprovado (rev. 2, 2026-10-29). B1-B5, D1, D12, D13 e os pontos A1-A7 aprovados pelo usuário; D11 fechada (API não exposta).
- **Data:** 2026-10-28 (rev. 2: 2026-10-29)
- **Spec:** `docs/specs/autenticacao-autorizacao.md` (rev. 2)
- **Relacionados:** ADR 0001 (contratos, schema, estratégia BFF da 9.2), `docs/api/finance.md`, `docs/design/autenticacao-autorizacao.md`, `docs/specs/categorias-inativacao.md` (Feature B, depende deste ADR)
- **Autor:** architect
- **Escopo:** `api/` (NestJS 12 ESM, Prisma 7 + adapter-pg, PostgreSQL) e `web/` (Next.js 16 App Router)

### Histórico de revisões

- **rev. 2 (2026-10-29):** sai o cadastro público (`RegisterUser`, A1 `/api/auth/register`, `/register`, `registerAction`) e sai o `DemoInvite`. Entram: nível (`ADMIN`/`USER`), situação (`ACTIVE`/`INACTIVE`) e troca obrigatória de senha no `User`; gestão de usuários só para administrador (criar, editar, inativar, reativar, redefinir senha) com `CANNOT_TARGET_SELF` e `LAST_ADMIN` sob concorrência; "Meu perfil" e "Trocar senha"; inicialização do primeiro administrador por `ADMIN_*`, idempotente, que recebe os dados legados (substitui `ClaimLegacyOwner`/`OWNER_*`); principal com nível, situação e troca obrigatória lidos a cada requisição; inativação e redefinição encerram sessões; sessão de 24 h; demo só de visualização; remoção de `NEXT_PUBLIC_API_URL`. Respostas às técnicas T12-T16.
- **rev. 1 (2026-10-28):** versão inicial.

---

## 0. Decisões de negócio (B1-B5, decididas pelo usuário)

| Id | Decisão | Onde impacta neste ADR |
|---|---|---|
| **B1** | Protege só as operações que já existem. Categoria como entidade, inativação de cartão e cancelamento de lançamento são da Feature B. | 5.5, 6.4. A seção 14.1 lista o que este ADR garante para a Feature B. |
| **B2** | Entidade Usuário gerida por administrador, níveis `ADMIN`/`USER`, situação ativo/inativo. Primeiro administrador por `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` com troca obrigatória; recebe todos os dados existentes, que não viram demo. Administrador não vê dados financeiros alheios. | 3 (aggregate `User`), 5.3-5.4 (use cases), 7.3 (migração com marcador do primeiro administrador), 7.5 (inicialização no boot) |
| **B3** | Sem cadastro público. `EMAIL_TAKEN` continua na criação e edição feitas pelo administrador. | 5.3 (não há `RegisterUser`), 6.2 (não há rota de cadastro), 9 (não há `/register`) |
| **B4** | Demo só de visualização: elementos de escrita e checkboxes **não são renderizados**; sem convite. | 9.6 |
| **B5** | Dados da demo relativos ao mês atual (12 meses até o atual + 1 de fatura futura). | 5.6, 7.1 (`demo_datasets`), 7.6 |

Premissas P01-P20 da spec adotadas integralmente. Propostas do design PA1, PA2, PA4 e PA5 aprovadas (P19); PA3 não existe mais.

---

## 1. Contexto

A aplicação é monousuário (ADR 0001). `cards` e `entries` não têm dono, `cards_name_key_uq` é global, `PrismaCategoryCatalog.findByKey` e todos os read models (`$queryRaw`) agregam sobre a tabela inteira. O web é um BFF: o navegador nunca chama a API; leituras por RSC e mutações por Server Actions via `web/lib/api/http.ts` (server-only). O `api/Dockerfile` executa `npx prisma migrate deploy && npx prisma db seed && node dist/main.js`, mas `prisma.config.ts` não configura seed. O `web/Dockerfile` (linhas 12-13) e `.github/workflows/deploy.yml` (linha 56) ainda injetam `NEXT_PUBLIC_API_URL`.

Este ADR introduz o contexto de identidade (usuários, sessões, gestão de usuários), isolamento por dono em todo o `finance`, rotas públicas somente leitura de demo e a separação de rotas no web.

---

## 2. Bounded contexts e linguagem ubíqua

### 2.1 Novo contexto: **Identidade e acesso** (`api/src/modules/identity/`) - T6

Responsável por usuários (nível, situação, credenciais, troca obrigatória), sessões, gestão de usuários, inicialização do primeiro administrador, limite de tentativas e trilha de auditoria. **Não** conhece cartões nem lançamentos, e nenhuma consulta dele lê tabelas financeiras (RNF06, RF19).

A gestão de usuários fica **no mesmo contexto** (sugestão do T6 aceita): as regras de último administrador, troca obrigatória e encerramento de sessões cruzam `User` e `Session` na mesma transação; separá-las em outro contexto exigiria consistência eventual onde a spec exige efeito imediato (RNF14). Internamente a application é dividida por subdomínio (`auth/`, `account/`, `user-admin/`, `bootstrap/`, 10).

### 2.2 Contexto existente: **Finanças pessoais** (`api/src/modules/finance/`)

Passa a ter o conceito de **Dono (Owner)**, VO próprio `OwnerId` (UUID). O `finance` não importa nada de `identity`. Relação **Customer/Supplier com Published Language mínima**: o único dado que atravessa a fronteira é o id do usuário autenticado, string UUID, entregue pela presentation (principal). Nível e situação **não** atravessam: no `finance`, administrador é um usuário qualquer (RF19).

### 2.3 Shared kernel (acréscimos em `api/src/shared/`)

| Item | Onde | Motivo |
|---|---|---|
| `normalizeLabel`, `normalizeText`, `codePointLength`, `labelKey` | mover de `finance/domain/text.ts` para `shared/domain/text.ts` | `UserName` usa a mesma normalização de `CardName`. |
| `ErrorKind` += `'unauthenticated'` (401), `'forbidden'` (403), `'rate_limited'` (429) | `shared/domain/app-error.ts` + `STATUS_BY_KIND` | Novos erros previstos (P09). |
| `WELL_KNOWN_USER_IDS` (`DEMO_USER_ID`, `FIRST_ADMIN_ID`) | `shared/domain/well-known-ids.ts` | Constantes que a migração, o seed, a inicialização e as rotas de demo precisam. |
| `AuthenticatedPrincipal`, `@Public()`, `@AllowDuringPasswordChange()`, `@RequireRole()`, `@CurrentOwnerId()`, `@CurrentPrincipal()` | `shared/presentation/auth/` | Contrato HTTP comum: o guard (identity) escreve o principal; os controllers (finance e identity) leem. `finance/presentation` não importa `identity`. |

Valores fixos: `DEMO_USER_ID = "01900000-0000-7000-8000-0000000000d1"`, `FIRST_ADMIN_ID = "01900000-0000-7000-8000-0000000000a1"` (versão 7, variante 8; timestamp antigo propositalmente, não colidem com ids gerados).

```ts
// shared/presentation/auth/principal.ts
export type PrincipalRole = 'ADMIN' | 'USER';
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  role: PrincipalRole;              // lido do banco nesta requisição (T16)
  mustChangePassword: boolean;      // idem
}
```

### 2.4 Linguagem ubíqua (código em inglês, termo de negócio em pt-BR)

| Negócio (spec) | Código |
|---|---|
| Usuário | `User` (aggregate), `UserId` |
| Nível / Administrador / Usuário comum | `UserRole` = `'ADMIN' \| 'USER'` |
| Situação / Ativo / Inativo | `UserStatus` = `'ACTIVE' \| 'INACTIVE'` |
| Inativar / Reativar | `User.deactivate()` / `User.reactivate()`; `DeactivateUser` / `ReactivateUser` |
| Último administrador ativo | `LastActiveAdminPolicy` (domain service), `LastAdminError` |
| Primeiro administrador | `FIRST_ADMIN_ID`; `BootstrapFirstAdmin` |
| Marcador do primeiro administrador (dados legados à espera da inicialização) | `User` com `kind = PENDING_FIRST_ADMIN` |
| Senha temporária | `PlainPassword` usada em `CreateUser`/`ResetUserPassword`/`BootstrapFirstAdmin`; liga `mustChangePassword` |
| Troca obrigatória de senha | `User.mustChangePassword`, `PasswordChangeRequiredError` |
| Redefinir senha (admin) | `User.resetPassword()`, `ResetUserPassword` |
| Trocar senha (próprio) | `User.changePassword()`, `ChangeOwnPassword` |
| Meu perfil | `UpdateOwnProfile` |
| Gestão de usuários | `identity/application/use-cases/user-admin/*` |
| Visitante | ausência de `AuthenticatedPrincipal` |
| Login / Logout / Sessão | `LoginWithPassword` / `Logout` / `Session` (aggregate), token opaco |
| Dono | `OwnerId` (finance), `userId` (identity, coluna `user_id`) |
| Usuário demo | `User` com `kind = DEMO`, id `DEMO_USER_ID` |
| Dados de exemplo | `DemoDataset` (modelo + âncora de mês) |
| Rota pública / protegida / de administrador | `@Public()` / padrão (guard global) / `@RequireRole('ADMIN')` |
| Limite de tentativas | `AttemptLimiter` |
| Trilha de auditoria | `IdentityAuditLog` |

---

## 3. Modelo de domínio - identity

`api/src/modules/identity/domain/` - nenhuma dependência externa (sem Nest, Prisma, argon2, crypto).

### 3.1 Value objects

| VO | Regras | Erros (código de campo) |
|---|---|---|
| `UserId` | UUID (qualquer versão na leitura; gerado v7). | invariante |
| `UserName` | `normalizeLabel` (NFC, trim, colapso). 1 a 60 **code points**. | `REQUIRED`, `TOO_LONG` |
| `EmailAddress` | trim + `toLowerCase()` (P01). Até 254 code points. Formato pragmático: um `@`, parte local 1-64, domínio com ponto, sem espaços. `isReserved()`: TLD `.invalid` (demo e marcador, P06). | `REQUIRED`, `INVALID_FORMAT`, `TOO_LONG` |
| `PlainPassword` | 8 a 72 code points, **sem trim** (P02). `reveal()` é o único acesso; `toString()`/`toJSON()` devolvem `"[REDACTED]"` (RNF01). Vale para senha temporária, nova senha e `ADMIN_PASSWORD`. | `REQUIRED`, `TOO_SHORT`, `TOO_LONG` |
| `PasswordHash` | String opaca PHC (`$argon2id$...`). | invariante |
| `UserRole` | `'ADMIN' \| 'USER'`. `parseRole(raw)`. | `REQUIRED`, `INVALID_VALUE` |
| `UserStatus` | `'ACTIVE' \| 'INACTIVE'`. | invariante |
| `SessionTokenDigest` | Hex de 64 caracteres. O token em claro nunca é VO de domínio. | invariante |
| `SessionPolicy` | `ttl = 24 h` fixo (P03), sem renovação. `expiresAt(createdAt)`. | - |

Parsers que **acumulam** violações (como `parseCardProps`), lançando `UserValidationError`:
- `parseNewUser({ name, email, role, password })` (CA18): e-mail reservado `.invalid` -> `email: INVALID_FORMAT`.
- `parseUserDetails({ name, email, role })` (edição).
- `parseFirstAdminConfig({ ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD })`: mesmas regras, mas os campos são os **nomes das variáveis** (CA13), e o erro é `FirstAdminConfigError` (nunca contém valores).

### 3.2 Aggregate `User`

Estado: `id`, `name: UserName`, `email: EmailAddress`, `passwordHash: PasswordHash | null`, `kind: 'REGULAR' | 'DEMO' | 'PENDING_FIRST_ADMIN'`, `role: UserRole`, `status: UserStatus`, `mustChangePassword: boolean`, `createdAt`, `updatedAt`.

Invariantes (repetidas como `CHECK` no banco, 7.3):
1. `kind = REGULAR` => `passwordHash != null`.
2. `kind = DEMO` => `passwordHash = null`, `role = USER`.
3. `kind = PENDING_FIRST_ADMIN` => `passwordHash = null`, `id = FIRST_ADMIN_ID`. Existe só entre a migração e a inicialização (7.5).
4. `canAuthenticate()` = `kind = REGULAR && status = ACTIVE` (o hash existe por 1). Inativo e demo nunca autenticam (RF01, RNF05).
5. `isActiveAdmin()` = `kind = REGULAR && role = ADMIN && status = ACTIVE`. Só esses contam para `LAST_ADMIN`.
6. `isManageable()` = `kind = REGULAR`. Demo e marcador respondem `USER_NOT_FOUND` e não aparecem na lista (RF18, P06).
7. `updatedAt >= createdAt`.
8. E-mail único entre **todos** os usuários, inclusive inativos e demo (repositório + índice único).

Comportamentos (cada um recebe `now`; os que podem não mudar nada devolvem `boolean changed` e só emitem evento se mudou):

| Método | Efeito | Evento |
|---|---|---|
| `User.create({ id, name, email, role, temporaryPasswordHash, now })` | `REGULAR`, `ACTIVE`, `mustChangePassword = true` (RF12) | `UserCreated` |
| `User.demo({ now })` | `DEMO`, nome "Demonstração", `demo@finance.invalid` | - |
| `User.firstAdmin({ name, email, temporaryPasswordHash, now })` | id `FIRST_ADMIN_ID`, `REGULAR`, `ADMIN`, `ACTIVE`, `mustChangePassword = true` (banco sem dados legados) | `FirstAdminBootstrapped` |
| `provisionFirstAdmin({ name, email, temporaryPasswordHash, now })` | só se `kind = PENDING_FIRST_ADMIN`; vira o mesmo estado de `firstAdmin`, **mantendo o id** (os dados legados já apontam para ele) | `FirstAdminBootstrapped` |
| `updateDetails({ name, email, role }, now)` | devolve `changedFields: ('name'\|'email'\|'role')[]`; não mexe em senha nem sessões (RF13, P17) | `UserUpdated { changedFields }` |
| `rename(name, now)` | só nome (RF09) | `UserUpdated { changedFields: ['name'] }` |
| `deactivate(now)` | `INACTIVE`; idempotente (P18) | `UserDeactivated` |
| `reactivate(now)` | `ACTIVE`; não liga troca obrigatória (P16) | `UserReactivated` |
| `resetPassword(temporaryPasswordHash, now)` | novo hash, `mustChangePassword = true`; vale também para inativo (RF16) | `UserPasswordReset` |
| `changePassword(newHash, now)` | novo hash, `mustChangePassword = false` (RF08) | `PasswordChanged` |

O aggregate **não** encerra sessões nem conta administradores: isso exige outro aggregate e estado global, e fica nos use cases (5.4) e no domain service abaixo.

### 3.3 Domain services e políticas (puros)

```ts
// identity/domain/user/last-active-admin.policy.ts
export const LastActiveAdminPolicy = {
  /**
   * target: estado ANTES da mudança; after: estado DEPOIS (clone).
   * otherActiveAdmins: quantidade de administradores ativos além do target, lida sob lock (T14).
   * Lança LastAdminError se a mudança tira o último administrador ativo.
   */
  assertKeepsAnActiveAdmin(target: User, after: User, otherActiveAdmins: number): void,
};

// identity/domain/user/self-target.policy.ts
export const SelfTargetPolicy = {
  /** Inativar e redefinir senha de si mesmo -> CannotTargetSelfError (RF17). Editar a si mesmo é permitido. */
  assertNotSelf(actorId: UserId, targetId: UserId): void,
};
```

### 3.4 Aggregate `Session`

Estado: `id: SessionId` (UUID v7), `userId`, `tokenDigest`, `createdAt`, `expiresAt`.

Invariantes: `expiresAt = createdAt + 24 h`; `isActiveAt(now)` = `now < expiresAt`. Sem renovação (RF04).

Comportamentos: `Session.open(...)` emite `SessionOpened`; `revoke(now)` emite `SessionRevoked`. Encerramentos em massa (inativação, redefinição, troca de senha) são operações de repositório sobre um conjunto (4.1) e emitem um único `UserSessionsRevoked { userId, reason, count }` publicado pelo use case.

Decisão mantida: `Session` é aggregate separado de `User` (ciclo de vida e volume próprios).

### 3.5 Domain events

| Evento | Payload | Observação |
|---|---|---|
| `UserCreated` | `userId`, `createdBy`, `role`, `occurredAt` | sem e-mail, nome ou senha |
| `UserUpdated` | `userId`, `changedFields`, `occurredAt` | só nomes de campos |
| `UserDeactivated` / `UserReactivated` | `userId`, `occurredAt` | |
| `UserPasswordReset` | `userId`, `occurredAt` | |
| `PasswordChanged` | `userId`, `occurredAt` | |
| `FirstAdminBootstrapped` | `userId`, `receivedLegacyData: boolean`, `occurredAt` | |
| `SessionOpened` | `sessionId`, `userId`, `occurredAt` | |
| `SessionRevoked` | `sessionId`, `userId`, `occurredAt` | logout |
| `UserSessionsRevoked` | `userId`, `reason: 'deactivated' \| 'password-reset' \| 'password-changed'`, `count`, `occurredAt` | |

Publicados pelo `DomainEventPublisher` existente, **depois do commit** (sem handlers nesta entrega). A trilha de auditoria (RNF13) não é derivada dos eventos: precisa de IP e do id do administrador, que não pertencem ao domínio; vai pelo port `IdentityAuditLog` (5.2). Falha de login também vai só para o port.

### 3.6 Erros (`AppError`)

| Classe | code | kind / HTTP | details |
|---|---|---|---|
| `UserValidationError` | `VALIDATION_ERROR` | validation / 400 | `{ fields: [{ field, code, message }] }` (inclui `currentPassword: INCORRECT`, `newPassword: SAME_AS_CURRENT`, `role: INVALID_VALUE`) |
| `EmailTakenError` | `EMAIL_TAKEN` | conflict / 409 | `{ fields: [{ field: "email", code: "EMAIL_TAKEN", message: "Este e-mail já está em uso." }] }` |
| `InvalidCredentialsError` | `INVALID_CREDENTIALS` | unauthenticated / 401 | `null` |
| `UnauthenticatedError` | `UNAUTHENTICATED` | unauthenticated / 401 | `null` |
| `PasswordChangeRequiredError` | `PASSWORD_CHANGE_REQUIRED` | forbidden / 403 | `null` |
| `ForbiddenError` | `FORBIDDEN` | forbidden / 403 | `null` |
| `UserNotFoundError` | `USER_NOT_FOUND` | not_found / 404 | `{ id }` |
| `CannotTargetSelfError` | `CANNOT_TARGET_SELF` | business_rule / 422 | `null` |
| `LastAdminError` | `LAST_ADMIN` | business_rule / 422 | `null` |
| `TooManyAttemptsError` | `TOO_MANY_ATTEMPTS` | rate_limited / 429 | `{ retryAfterSeconds }` + header `Retry-After` |
| `FirstAdminConfigError` | `FIRST_ADMIN_CONFIG_INVALID` | (só boot, nunca HTTP) | `{ variables: [{ name: "ADMIN_PASSWORD", code: "REQUIRED" }] }` |

Mensagens (pt-BR): `UNAUTHENTICATED` "Sessão inválida ou expirada."; `INVALID_CREDENTIALS` "E-mail ou senha inválidos."; `PASSWORD_CHANGE_REQUIRED` "Defina uma nova senha para continuar."; `FORBIDDEN` "Você não tem permissão para esta ação."; `USER_NOT_FOUND` "Usuário não encontrado."; `CANNOT_TARGET_SELF` "Você não pode executar esta ação na sua própria conta."; `LAST_ADMIN` "É preciso manter pelo menos um administrador ativo."; `TOO_MANY_ATTEMPTS` "Muitas tentativas. Tente novamente em instantes."; `EMAIL_TAKEN` "Este e-mail já está em uso."; `INCORRECT` "Senha atual incorreta."; `SAME_AS_CURRENT` "A nova senha deve ser diferente da atual."

---

## 4. Interfaces de repositório (domain)

### 4.1 identity

```ts
// identity/domain/user/user.repository.ts
export interface UserRepository {
  /** Lança EmailTakenError se users_email_uq for violado (inclusive em corrida). */
  insert(user: User): Promise<void>;
  /** Persiste todos os campos mutáveis. Idem EmailTakenError. */
  update(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  /** Só kind = REGULAR (RF11, P06). Ordem: ACTIVE antes de INACTIVE, depois nome (collation pt-BR) (P14). */
  listManageable(): Promise<User[]>;
  /** kind = REGULAR, role = ADMIN, status = ACTIVE, id <> except. Chamar sob lockAdminSet (T14). */
  countActiveAdminsExcept(except: UserId): Promise<number>;
  /** Quantos usuários kind = REGULAR existem (decide a inicialização, RF20). */
  countRegular(): Promise<number>;
}
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// identity/domain/session/session.repository.ts
export interface SessionRepository {
  insert(session: Session): Promise<void>;
  findActiveByDigest(digest: SessionTokenDigest, now: Date): Promise<Session | null>;
  delete(id: SessionId): Promise<void>;
  /** Inativação e redefinição (RF14, RF16). Devolve quantas. */
  deleteAllOfUser(userId: UserId): Promise<number>;
  /** Troca da própria senha: mantém a sessão atual (RF08, P16). */
  deleteAllOfUserExcept(userId: UserId, keep: SessionId): Promise<number>;
  deleteExpired(now: Date): Promise<number>;
}
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
```

### 4.2 finance (mudanças) - isolamento obrigatório na assinatura (RNF06, R1)

Inalterado em relação à rev. 1. Regra: **todo** método de leitura ou escrita recebe `ownerId: OwnerId` como primeiro parâmetro (ou o lê do aggregate, que o carrega imutável no snapshot). Esquecer o filtro vira erro de compilação na interface e falha nos testes de integração com dois usuários.

```ts
// finance/domain/owner/owner-id.ts  -> VO OwnerId (UUID)

export interface CardRepository {
  insert(card: Card): Promise<void>;                          // owner vem de card.ownerId
  update(card: Card): Promise<void>;                          // WHERE id AND user_id = card.ownerId
  findById(ownerId: OwnerId, id: CardId): Promise<Card | null>;
  findByNameKey(ownerId: OwnerId, key: string): Promise<Card | null>;
}

export interface EntryRepository {
  insert(entry: Entry): Promise<void>;
  findByIdsForUpdate(ownerId: OwnerId, ids: readonly EntryId[]): Promise<Entry[]>;
  findPendingByInvoiceForUpdate(ownerId: OwnerId, key: InvoiceKey): Promise<Entry[]>;
  saveAll(entries: readonly Entry[]): Promise<void>;          // WHERE id AND user_id = entry.ownerId AND status = PENDING
  deleteAllOf(ownerId: OwnerId): Promise<void>;              // usado só pelo DemoDatasetStore (5.6)
}

export interface CategoryCatalog {
  /** Grafia canônica do PRIMEIRO uso deste dono (RF26, CA33). */
  findByKey(ownerId: OwnerId, key: string): Promise<Category | null>;
}
```

Invariantes nos aggregates: `Card.create({ ownerId, ... })`; unicidade de nome **por dono** (use case + índice `(user_id, name_key)`, CA32). `Entry.create({ ownerId, input, card })`: cartão de outro dono -> `InvariantViolationError` (defesa em profundidade; o use case já devolveu 404). `CardCreated`/`EntryCreated` ganham `ownerId` no payload (não sai em HTTP, P10).

---

## 5. Application: ports e use cases

### 5.1 Ports compartilhados

Existentes: `Clock`, `IdGenerator` (UUID v7), `DomainEventPublisher`. Novo: `BusinessCalendar { currentMonth(): YearMonth }` em `shared/application/ports/` (America/Sao_Paulo, usado pela demo, P08/B5).

### 5.2 Ports do identity (`identity/application/ports/`)

```ts
export interface PasswordHasher {
  hash(password: PlainPassword): Promise<PasswordHash>;
  /** Com hash null verifica contra um hash fictício e devolve false no mesmo tempo (RNF05). */
  verify(password: PlainPassword, hash: PasswordHash | null): Promise<boolean>;
}
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface IssuedSessionToken { token: string; digest: SessionTokenDigest }
export interface SessionTokenIssuer {
  issue(): IssuedSessionToken;                          // 32 bytes base64url + HMAC-SHA256
  digest(token: string): SessionTokenDigest | null;     // null se o formato for inválido
}
export const SESSION_TOKEN_ISSUER = Symbol('SESSION_TOKEN_ISSUER');

/** Leitura por requisição (T16): uma consulta sessions JOIN users, sem cache. */
export interface SessionPrincipalLookup {
  findByDigest(digest: SessionTokenDigest, now: Date): Promise<{
    sessionId: string; userId: string;
    kind: 'REGULAR' | 'DEMO' | 'PENDING_FIRST_ADMIN';
    role: 'ADMIN' | 'USER'; status: 'ACTIVE' | 'INACTIVE'; mustChangePassword: boolean;
  } | null>;
}
export const SESSION_PRINCIPAL_LOOKUP = Symbol('SESSION_PRINCIPAL_LOOKUP');

/** Transação do identity (mesmo padrão do FinanceUnitOfWork). */
export interface IdentityTransactionScope {
  users: UserRepository;
  sessions: SessionRepository;
  /** Serializa toda mudança no conjunto de administradores ativos até o fim da transação (T14). */
  lockAdminSet(): Promise<void>;
  /** Serializa a inicialização do primeiro administrador entre instâncias (T12). */
  lockFirstAdminBootstrap(): Promise<void>;
}
export interface IdentityUnitOfWork {
  run<T>(work: (scope: IdentityTransactionScope) => Promise<T>): Promise<T>;
}
export const IDENTITY_UNIT_OF_WORK = Symbol('IDENTITY_UNIT_OF_WORK');

export type AttemptScope = 'auth-ip' | 'login-email-failures' | 'password-change-user-failures';
export interface AttemptKey { scope: AttemptScope; value: string }
export type AttemptDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };
export interface AttemptLimiter {
  consume(key: AttemptKey): Promise<AttemptDecision>;
  peek(key: AttemptKey): Promise<AttemptDecision>;
  recordFailure(key: AttemptKey): Promise<void>;
  reset(key: AttemptKey): Promise<void>;
}
export const ATTEMPT_LIMITER = Symbol('ATTEMPT_LIMITER');

export interface AuditContext { clientIp: string; at: Date }
export interface IdentityAuditLog {
  loginSucceeded(e: AuditContext & { userId: string }): void;
  loginFailed(e: AuditContext & { email: EmailAddress | null; userId: string | null }): void;
  rateLimited(e: AuditContext & { scope: AttemptScope; userId: string | null }): void;
  passwordChanged(e: AuditContext & { userId: string }): void;
  userCreated(e: AuditContext & { actorId: string; userId: string; role: string }): void;
  userUpdated(e: AuditContext & { actorId: string; userId: string; changedFields: string[] }): void;
  userDeactivated(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }): void;
  userReactivated(e: AuditContext & { actorId: string; userId: string }): void;
  userPasswordReset(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }): void;
  firstAdminBootstrapped(e: { userId: string; receivedLegacyData: boolean; at: Date }): void;
  adminRecovered(e: { userId: string; at: Date }): void;   // T15
}
export const IDENTITY_AUDIT_LOG = Symbol('IDENTITY_AUDIT_LOG');
```

`AuthAuditLog` da rev. 1 é substituído por `IdentityAuditLog` (mesmo adapter, mais métodos). Os métodos de gestão nunca recebem valores de nome/e-mail, só nomes de campos (RNF13).

Políticas (`identity/application/policies/attempt-policies.ts`): `auth-ip` 20 por 60 s (login + trocar senha, RNF04); `login-email-failures` 5 falhas por 15 min (chave: `EmailAddress` normalizado); `password-change-user-failures` 5 falhas por 15 min (chave: `userId`, sugestão T8 aceita). `register-email` deixa de existir.

### 5.3 Use cases de autenticação e conta (`auth/`, `account/`)

Todos os inputs que geram auditoria levam `clientIp` (vem da presentation).

| Use case | Input | Output | Fluxo / precedência |
|---|---|---|---|
| `LoginWithPassword` | `{ email, password, clientIp }` | `AuthResult = { user: CurrentUserView, session: { token, expiresAt } }` | 400 (só presença/tipo, D13) > 429 (`peek` de `login-email-failures`, mesmo com senha correta, CA04) > `findByEmail` -> `hasher.verify(pw, user?.canAuthenticate() ? user.passwordHash : null)` **sempre executado** (RNF05; inativo, demo, marcador e inexistente caem no hash fictício) -> falha: `recordFailure`, `auditLog.loginFailed`, 401 `INVALID_CREDENTIALS` (CA03); sucesso: `reset`, `Session.open` (24 h), `auditLog.loginSucceeded`. `mustChangePassword` vai na resposta; o login **não** é bloqueado por ele (RF07). |
| `AuthenticateSession` | `{ token }` | `AuthenticatedPrincipal` | `issuer.digest(token)` null -> 401. `SessionPrincipalLookup.findByDigest(digest, now)` null -> 401. `kind <> REGULAR` ou `status = INACTIVE` -> 401 (defesa em profundidade: a inativação já apagou as sessões). Devolve `role` e `mustChangePassword` frescos (T16). |
| `GetCurrentUser` | `{ userId }` | `CurrentUserView = { id, name, email, role, mustChangePassword }` | inexistente -> 401 (nunca 404). RF03. |
| `Logout` | `{ token }` | `void` | idempotente. |
| `CheckAuthRequestQuota` | `{ clientIp }` | `void` | `consume(auth-ip)`; negado -> `auditLog.rateLimited` + 429. Invocado pelo `AuthQuotaGuard` (6.6). |
| `ChangeOwnPassword` | `{ userId, sessionId, currentPassword, newPassword, clientIp }` | `CurrentUserView` | 400 de forma (`currentPassword: REQUIRED`; `newPassword` pelas regras P02, acumulado) > 429 (`peek` de `password-change-user-failures`) > `verify(current, hash)` falso -> `recordFailure`, 400 `currentPassword: INCORRECT` (CA10) > `current === new` -> 400 `newPassword: SAME_AS_CURRENT` > `reset`, hash, `user.changePassword`, numa transação `users.update` + `sessions.deleteAllOfUserExcept(userId, sessionId)` (P16) > eventos, `auditLog.passwordChanged`. A confirmação é só do web (RF08). |
| `UpdateOwnProfile` | `{ userId, name }` | `CurrentUserView` | 400 (`name`) > `user.rename` > `update`. E-mail e nível não existem no input (o schema HTTP devolve `UNKNOWN_FIELD`, CA11). |
| `PurgeExpiredSessions` | `{}` | `{ deleted }` | manutenção (7.6). |
| `EnsureDemoUser` | `{}` | `{ created }` | upsert do `DEMO_USER_ID` (seed). |

`CurrentUserView` e `AuthResult` nunca contêm hash. `AuthResult.session.token` só existe na resposta interna API -> BFF.

### 5.4 Use cases de gestão de usuários (`user-admin/`) - RF10-RF19, T14

Todos recebem `actor: { userId, clientIp }`. O `@RequireRole('ADMIN')` na presentation dá o 403 cedo (antes da validação, RF10); **dentro** da transação o use case revalida o ator (ver passo 2), o que fecha a janela entre a autenticação e a escrita (CA24, "ou 401").

Esqueleto comum dos use cases que escrevem (`CreateUser`, `UpdateUser`, `DeactivateUser`, `ReactivateUser`, `ResetUserPassword`):
1. Valida o input (acumulado, 400). Ids de path mal formados -> 400 `VALIDATION_ERROR` (convenção de `docs/api/finance.md`).
2. `uow.run(async (tx) => { await tx.lockAdminSet(); const actor = await tx.users.findById(actorId); ... })`: ator inexistente, não `REGULAR` ou `INACTIVE` -> `UnauthenticatedError` (401); ator não `ADMIN` -> `ForbiddenError` (403).
3. Carrega o alvo: inexistente ou `!isManageable()` -> 404 `USER_NOT_FOUND` (RF18, CA26).
4. Regras de domínio (422): `SelfTargetPolicy` e `LastActiveAdminPolicy` com `tx.users.countActiveAdminsExcept(target.id)` lido **depois** do lock.
5. Escreve (`users.update`/`insert`, e `sessions.deleteAllOfUser` quando aplicável) na mesma transação.
6. Após o commit: publica eventos e registra auditoria.

| Use case | Input | Output | Regras específicas e precedência |
|---|---|---|---|
| `ListUsers` | `{ actor }` | `AdminUserView[]` | Sem transação nem lock. Ator revalidado pela leitura do principal (T16). `listManageable()`; nenhum dado financeiro (CA25). |
| `GetUser` | `{ actor, id }` | `AdminUserView` | 400 > 404. |
| `CreateUser` | `{ actor, name, email, role, password }` | `AdminUserView` (201) | 400 (`parseNewUser`, acumulado, CA18) > 409 (`findByEmail` e, em corrida, `insert`, CA17; o e-mail do demo cai em 400 por ser reservado `.invalid`, ver nota 1). `User.create` com `mustChangePassword = true`, sem dados financeiros (P11). |
| `UpdateUser` | `{ actor, id, name, email, role }` | `AdminUserView` | 400 > 404 > 422 `LAST_ADMIN` (se o alvo é admin ativo, vira `USER` e `otherActiveAdmins = 0`; vale para si mesmo, CA24) > 409 (e-mail de outro usuário). Editar a si mesmo é permitido; rebaixar a si mesmo com outro admin ativo é permitido (RF17). Não encerra sessões (P17); o nível novo vale na próxima requisição pelo T16. |
| `DeactivateUser` | `{ actor, id }` | `AdminUserView` | 400 > 404 > 422 `CANNOT_TARGET_SELF` > 422 `LAST_ADMIN` > `deactivate`; se mudou, `deleteAllOfUser` na mesma transação (RF14, CA20). Já inativo: 200 sem mudança e sem auditoria de sessão (P18). |
| `ReactivateUser` | `{ actor, id }` | `AdminUserView` | 400 > 404 > `reactivate` (idempotente). Não toca senha nem troca obrigatória (CA21). Reativar a si mesmo é impossível na prática (ator inativo não autentica). |
| `ResetUserPassword` | `{ actor, id, password }` | `AdminUserView` | 400 > 404 > 422 `CANNOT_TARGET_SELF` > hash, `resetPassword`, `deleteAllOfUser` (RF16, CA22). Vale para inativo. |

`AdminUserView = { id, name, email, role, status, mustChangePassword, createdAt }`.

Nota 1 (CA17, e-mail do demo): a spec pede 409 `EMAIL_TAKEN` para o e-mail do usuário demo. Como `demo@finance.invalid` usa o TLD reservado, a validação de formato o barraria antes (400). Decisão: `parseNewUser` **não** rejeita `.invalid` como formato; o 409 vem naturalmente do `findByEmail`, e `.invalid` só é bloqueado em `ADMIN_EMAIL` (onde o 409 não existe). Assim o CA17 é atendido literalmente.

**Por que o hash é calculado fora da transação:** argon2 leva dezenas de ms; dentro do lock serializaria as ações de gestão sem necessidade. `CreateUser` e `ResetUserPassword` calculam o hash antes do passo 2.

### 5.5 Use cases do finance - propagação do dono (T6)

Inalterado em relação à rev. 1. Todos recebem `ownerId: string` no input; o primeiro passo é `OwnerId.create(input.ownerId)`; falha é `InvariantViolationError` (500), porque o valor vem do principal e nunca do corpo (RF23).

| Use case | Input novo | Mudança |
|---|---|---|
| `CreateCard` | `{ ownerId, name, closingDay, dueDay }` | `findByNameKey(ownerId, key)`; `Card.create({ ownerId, ... })` |
| `UpdateCard` | `{ ownerId, id, name, closingDay, dueDay }` | `findById(ownerId, id)` null -> 404 `CARD_NOT_FOUND` (CA30) |
| `ListCards` | `{ ownerId }` | `CardReadModel.listAll(ownerId)` |
| `CreateEntry` | `{ ownerId, ...RawEntryInput }` | `cards.findById(ownerId, cardId)` -> 404; `catalog.findByKey(ownerId, key)` (CA33); `Entry.create({ ownerId, ... })` |
| `ListExpenses` / `ListIncomes` | `{ ownerId, ...query }` | critérios ganham `ownerId`; `cardId` de outro dono = lista vazia |
| `MarkEntryAsPaid` | `{ ownerId, id }` | `findByIdsForUpdate(ownerId, [id])` |
| `PayEntriesInBatch` | `{ ownerId, ids }` | ids de outro dono caem em `missingIds` (CA31) |
| `ListInvoices` | `{ ownerId, month }` | `invoices.listByMonth(ownerId, month)` |
| `ListInvoiceEntries` / `PayInvoice` | `{ ownerId, cardId, referenceMonth }` | `findById(ownerId, cardId)` -> 404 |
| `GetMonthlySummary` | `{ ownerId, month }` | `summary(ownerId, month)` |
| `ListCategories` | `{ ownerId }` | `listDistinct(ownerId)` |
| `GetMonthlySeries` / `GetCategoryDistribution` | `{ ownerId, month }` | idem com `ownerId` |

Read models: todos os métodos ganham `ownerId: OwnerId` como primeiro parâmetro (lista completa da rev. 1 mantida).

Precedência no finance: 401 > 403 `PASSWORD_CHANGE_REQUIRED` (guard) > 400 > 404 > 422; 409 depois de 400 e 404 (RF25).

### 5.6 Demo dataset (finance) - T4/T5, B5

Inalterado em relação à rev. 1: modelo puro `buildDemoDataset(anchor, version)` (2 cartões, 6 categorias, 12 meses até a âncora + 1), use case `RefreshDemoDataset { ownerId, anchor? }`, port `DemoDatasetStore.replaceIfStale(ownerId, anchor, version, build)` com advisory lock e tabela `demo_datasets`. Idempotência (CA34).

```ts
export interface DemoDatasetStore {
  replaceIfStale(
    ownerId: OwnerId,
    anchor: YearMonth,
    version: number,
    build: () => { cards: Card[]; entries: Entry[] },
  ): Promise<boolean>;
}
```

A coluna `template_version` permite que a Feature B regenere a demo com categorias-entidade incrementando a versão (14.1).

### 5.7 Inicialização do primeiro administrador e recuperação (`bootstrap/`) - T12, T15

| Use case | Input | Output | Fluxo |
|---|---|---|---|
| `BootstrapFirstAdmin` | `{ ADMIN_NAME?, ADMIN_EMAIL?, ADMIN_PASSWORD? }` (strings cruas do ambiente) | `{ status: 'skipped' \| 'created' \| 'provisioned' }` | Numa transação com `lockFirstAdminBootstrap()`: (1) `users.countRegular() > 0` -> `skipped`, **sem validar** as variáveis (CA12 segunda parte, CA13 "And"). (2) `parseFirstAdminConfig` acumulado -> `FirstAdminConfigError` com nomes das variáveis e códigos, sem valores (CA13). E-mail `.invalid` -> `INVALID_FORMAT`. (3) hash (antes do lock é impossível aqui, pois a decisão depende do passo 1; custo único no boot, aceitável). (4) `findById(FIRST_ADMIN_ID)`: se `PENDING_FIRST_ADMIN`, `provisionFirstAdmin` + `update` -> `provisioned` (recebe os dados legados, RF21); se não existe, `User.firstAdmin` + `insert` -> `created`. (5) `auditLog.firstAdminBootstrapped`. |
| `RecoverAdminAccess` (T15) | `{ email, temporaryPassword }` | `{ userId }` | Só por CLI (nunca HTTP). Usuário `REGULAR` pelo e-mail; 404 se não existir. Sob `lockAdminSet`: `updateDetails({ role: ADMIN })`, `reactivate`, `resetPassword` (troca obrigatória), `deleteAllOfUser`. `auditLog.adminRecovered`. |

---

## 6. Contratos HTTP

### 6.1 Transporte da sessão (T1, D1 aprovado)

- A API **não usa cookie**. O BFF envia `Authorization: Bearer <token>`. O cookie httpOnly existe só no domínio do web (RNF02). Sem cookie na API, sem superfície de CSRF nela.
- Token opaco com estado no banco (`sessions`), validade fixa de 24 h.
- 401 inclui `WWW-Authenticate: Bearer`.
- A API **não é exposta publicamente** (RF45, D11): só o servidor do web a alcança, pela rede interna do deploy.

### 6.2 Endpoints novos - identity

**Autenticação e conta** (`identity/presentation/http/auth.controller.ts`, `account.controller.ts`):

| # | Método e rota | Acesso | Corpo | 2xx | Erros |
|---|---|---|---|---|---|
| A1 | `POST /api/auth/login` | pública + `AuthQuotaGuard` | `{ email: string, password: string }` (strict) | 200 `AuthResponse` | 400 `VALIDATION_ERROR` (só `REQUIRED`/tipo, D13), 401 `INVALID_CREDENTIALS`, 429 |
| A2 | `POST /api/auth/logout` | pública (lê o Bearer se houver) | - | 204 | - (idempotente) |
| A3 | `GET /api/auth/me` | protegida, liberada na troca obrigatória | - | 200 `CurrentUserDto` | 401 |
| A4 | `PUT /api/account/password` | protegida, liberada na troca obrigatória, + `AuthQuotaGuard` | `{ currentPassword: string, newPassword: string }` (strict) | 200 `CurrentUserDto` | 401, 429, 400 (`currentPassword: REQUIRED \| INCORRECT`, `newPassword: REQUIRED \| TOO_SHORT \| TOO_LONG \| SAME_AS_CURRENT`) |
| A5 | `PUT /api/account/profile` | protegida | `{ name: string }` (strict: `email`, `role` -> `UNKNOWN_FIELD`, CA11) | 200 `CurrentUserDto` | 401, 403 `PASSWORD_CHANGE_REQUIRED`, 400 |

Não existe rota de cadastro: `POST /api/auth/register` (ou qualquer outro caminho) responde 404 `ROUTE_NOT_FOUND` pelo filtro atual (RF06, CA07).

**Gestão de usuários** (`identity/presentation/http/admin-users.controller.ts`, `@RequireRole('ADMIN')` na classe):

| # | Método e rota | Corpo | 2xx | Erros (na ordem de precedência) |
|---|---|---|---|---|
| U1 | `GET /api/admin/users` | - | 200 `{ items: AdminUserDto[] }` | 401, 403 `PASSWORD_CHANGE_REQUIRED`, 403 `FORBIDDEN` |
| U2 | `GET /api/admin/users/:id` | - | 200 `AdminUserDto` | 401, 403, 403, 400 (id), 404 `USER_NOT_FOUND` |
| U3 | `POST /api/admin/users` | `{ name, email, role, password }` (strict) | 201 `AdminUserDto` | 401, 403, 403, 400 (acumulado, CA18), 409 `EMAIL_TAKEN` |
| U4 | `PUT /api/admin/users/:id` | `{ name, email, role }` (strict; `password` -> `UNKNOWN_FIELD`) | 200 `AdminUserDto` | 401, 403, 403, 400, 404, 422 `LAST_ADMIN`, 409 `EMAIL_TAKEN` |
| U5 | `POST /api/admin/users/:id/deactivate` | - | 200 `AdminUserDto` | 401, 403, 403, 400, 404, 422 `CANNOT_TARGET_SELF`, 422 `LAST_ADMIN` |
| U6 | `POST /api/admin/users/:id/reactivate` | - | 200 `AdminUserDto` | 401, 403, 403, 400, 404 |
| U7 | `POST /api/admin/users/:id/password-reset` | `{ password }` (strict) | 200 `AdminUserDto` | 401, 403, 403, 400, 404, 422 `CANNOT_TARGET_SELF` |

```ts
type Role = 'ADMIN' | 'USER';
type CurrentUserDto = { id: string; name: string; email: string; role: Role; mustChangePassword: boolean };
type AuthResponse = { user: CurrentUserDto; session: { token: string; expiresAt: string /* ISO UTC */ } };
type AdminUserDto = {
  id: string; name: string; email: string; role: Role;
  status: 'ACTIVE' | 'INACTIVE'; mustChangePassword: boolean; createdAt: string /* ISO UTC */;
};
```

Nenhum DTO de identity contém hash, contagens, totais, cartões ou categorias (RF11, CA25).

IP do cliente: `req.ip` com `app.set('trust proxy', TRUST_PROXY)` (padrão `loopback, uniquelocal`). O BFF repassa `X-Forwarded-For`. Como a API não é exposta (D11), o XFF só pode vir do web.

### 6.3 Rotas existentes do finance

Mesmos contratos de `docs/api/finance.md` (P10), agora protegidas: `/api/entries*`, `/api/categories`, `/api/cards*`, `/api/invoices`, `/api/summary`, `/api/dashboard/*`. Sem sessão: 401 (CA27). Troca obrigatória pendente: 403 `PASSWORD_CHANGE_REQUIRED` (CA08). Recurso de outro dono: os mesmos 404 de id inexistente (RF25), inclusive para administrador (CA25). `userId` no corpo: 400 `UNKNOWN_FIELD` (CA28). O nível não importa no finance.

### 6.4 Precedência e desvio consciente (D12 aprovado)

Ordem do Nest: middleware (body parser) -> guards -> pipes -> handler. Portanto, em toda rota protegida:

**401 `UNAUTHENTICATED` > 403 `PASSWORD_CHANGE_REQUIRED` > 403 `FORBIDDEN` > 400 > 404 > 422; 409 depois de 400 e 404** (RF07, RF10, RF25).

- **Desvio aprovado (D12):** `MALFORMED_JSON` e 413 continuam saindo antes do 401 (body parser roda antes dos guards). Os testes usam corpos JSON válidos porém inválidos no schema.
- Rotas com `AuthQuotaGuard` (A1, A4): 429 do IP vem logo depois da autenticação (A4) ou primeiro (A1, pública), antes do 400.

### 6.5 Rotas públicas de demo (RF29, T4)

Inalterado: 9 rotas `GET /api/demo/*` com `@Public()`, mesmo DTO das protegidas, dono fixo `DEMO_USER_ID`, montadas pelos `finance-read-handlers` compartilhados. Qualquer outro método -> 404 `ROUTE_NOT_FOUND` (CA36).

| Demo | Equivalente protegida |
|---|---|
| `GET /api/demo/entries/expenses` | `GET /api/entries/expenses` |
| `GET /api/demo/entries/incomes` | `GET /api/entries/incomes` |
| `GET /api/demo/categories` | `GET /api/categories` |
| `GET /api/demo/cards` | `GET /api/cards` |
| `GET /api/demo/invoices` | `GET /api/invoices` |
| `GET /api/demo/cards/:cardId/invoices/:referenceMonth/entries` | idem sem `/demo` |
| `GET /api/demo/summary` | `GET /api/summary` |
| `GET /api/demo/dashboard/monthly-series` | idem |
| `GET /api/demo/dashboard/category-distribution` | idem |

### 6.6 Guards e decorators (presentation) - T13, T16

Um único guard global, **`AccessControlGuard`** (`identity/presentation/guards/access-control.guard.ts`, `APP_GUARD` no `IdentityModule`), executa as políticas numa ordem fixa, em vez de três `APP_GUARD` cuja ordem dependeria da ordem de registro dos providers (frágil):

1. **Autenticação:** rota `@Public()` -> passa (tenta anexar principal se houver Bearer, para o logout). Senão, Bearer -> `AuthenticateSession` -> grava `request.principal`. Falha -> 401.
2. **Troca obrigatória (T13):** `principal.mustChangePassword && !@AllowDuringPasswordChange()` -> 403 `PASSWORD_CHANGE_REQUIRED`. Marcadas: A3, A4 (A2 é pública).
3. **Nível:** `@RequireRole('ADMIN')` e `principal.role !== 'ADMIN'` -> 403 `FORBIDDEN`.

Cada passo é uma classe `AccessPolicy` (`check(context, principal)`), injetada como lista ordenada (OCP: nova política sem editar o guard). **Seguro por padrão:** rota nova sem decorator é protegida e bloqueada na troca obrigatória.

- `@CurrentOwnerId()`: lê `request.principal.userId`; ausente -> `InvariantViolationError` (500).
- `@CurrentPrincipal()`: principal completo (usado por identity: `sessionId` para A4, `userId` como ator).
- `AuthQuotaGuard` (A1, A4): `CheckAuthRequestQuota` com `req.ip`.
- `HttpErrorFilter`: `STATUS_BY_KIND` += `unauthenticated: 401`, `forbidden: 403`, `rate_limited: 429`; `Retry-After` para `rate_limited`; `WWW-Authenticate: Bearer` para `unauthenticated`.

**T16 - nível e situação a cada requisição:** `AuthenticateSession` faz **uma** consulta `sessions JOIN users` por índice único (`token_digest`), sem cache em memória, devolvendo `role`, `status`, `kind` e `mustChangePassword` atuais. Promoção, rebaixamento, troca obrigatória e inativação valem na próxima requisição (RNF14, CA19). Inativação e redefinição ainda apagam as sessões, então a checagem de `status` é redundante por desenho (defesa em profundidade contra uma sessão criada em corrida com a inativação).

### 6.7 Configuração no boot (RNF03)

`api/src/bootstrap/env.ts` valida com zod e aborta com mensagem clara:

| Variável | Obrigatória | Regra |
|---|---|---|
| `DATABASE_URL` | sim | existente |
| `SESSION_TOKEN_SECRET` | sim | >= 32 bytes; chave do HMAC |
| `TRUST_PROXY` | não | padrão `loopback, uniquelocal` |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | condicional | o zod só as lê como strings opcionais; a obrigatoriedade e as regras são do `BootstrapFirstAdmin` (só exigidas se não houver usuário `REGULAR`, CA13). Nunca logadas. |
| `MAINTENANCE_INTERVAL_MS` | não | padrão 3600000; `0` desliga |

`OWNER_NAME/OWNER_EMAIL/OWNER_PASSWORD` da rev. 1 deixam de existir. `api/.env.example` documenta os nomes sem valores.

---

## 7. Persistência: schema Prisma e migrations (T7, T12)

### 7.1 Schema (trechos novos e alterados)

```prisma
enum UserKind {
  REGULAR
  DEMO
  PENDING_FIRST_ADMIN
  @@map("user_kind")
}

enum UserRole {
  ADMIN
  USER
  @@map("user_role")
}

enum UserStatus {
  ACTIVE
  INACTIVE
  @@map("user_status")
}

model User {
  id                 String     @id @db.Uuid
  name               String     @db.VarChar(60)
  email              String     @unique(map: "users_email_uq") @db.VarChar(254)
  passwordHash       String?    @map("password_hash") @db.VarChar(255)
  kind               UserKind   @default(REGULAR)
  role               UserRole   @default(USER)
  status             UserStatus @default(ACTIVE)
  mustChangePassword Boolean    @default(false) @map("must_change_password")
  createdAt          DateTime   @map("created_at") @db.Timestamptz(3)
  updatedAt          DateTime   @map("updated_at") @db.Timestamptz(3)
  sessions           Session[]
  cards              Card[]
  entries            Entry[]
  @@index([role, status], map: "users_role_status_idx")
  @@map("users")
}

model Session {
  id          String   @id @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: Restrict)
  tokenDigest String   @unique(map: "sessions_token_digest_uq") @map("token_digest") @db.Char(64)
  createdAt   DateTime @map("created_at") @db.Timestamptz(3)
  expiresAt   DateTime @map("expires_at") @db.Timestamptz(3)
  @@index([userId], map: "sessions_user_idx")
  @@index([expiresAt], map: "sessions_expires_at_idx")
  @@map("sessions")
}

model DemoDataset {
  ownerId         String   @id @map("owner_id") @db.Uuid
  anchorMonth     DateTime @map("anchor_month") @db.Date
  templateVersion Int      @map("template_version")
  refreshedAt     DateTime @map("refreshed_at") @db.Timestamptz(3)
  @@map("demo_datasets")
}

model Card {
  // ... campos atuais, sem o @unique em nameKey
  userId  String  @map("user_id") @db.Uuid
  user    User    @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  @@unique([userId, nameKey], map: "cards_owner_name_key_uq")
  @@map("cards")
}

model Entry {
  // ... campos atuais
  userId String @map("user_id") @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  @@index([userId, referenceMonth, type, date, createdAt, id], map: "entries_owner_month_type_date_idx")
  @@index([userId, referenceMonth, type, status], map: "entries_owner_month_type_status_idx")
  @@index([cardId, referenceMonth, status], map: "entries_card_month_status_idx")
  @@index([userId, categoryKey, createdAt, id], map: "entries_owner_category_key_created_idx")
  @@map("entries")
}
```

Notas:
- **E-mail:** uma coluna já normalizada com índice único + `CHECK (email = lower(email))` (P01).
- **`users_role_status_idx`:** a tabela é pequena; o índice existe para a contagem de administradores ativos sob lock não depender de seq scan se o volume crescer. Pode ser omitido sem mudar comportamento.
- **Senha temporária:** não há coluna separada; é o próprio `password_hash` com `must_change_password = true` (P13: não expira).
- **Mesmo dono entre lançamento e cartão:** mantidos os triggers `entries_card_same_owner_trg` e `cards_owner_immutable_trg` em SQL manual (D6), porque a FK composta com relação opcional não é expressável no Prisma. Confirmar na implementação; se o Prisma 7 aceitar, preferir a FK.
- **Usuário inativo não apaga nada:** `onDelete: Restrict` em `cards`/`entries` e ausência de exclusão de usuário (fora de escopo) garantem RF14/CA20.

### 7.2 Índices e RNF07

Inalterado: consultas do finance começam por `user_id`; índices de `entries` com prefixo `(user_id, reference_month, ...)`; sessão por `token_digest` (único) com join por PK em `users` a cada requisição. Medição repete o perf com 2 usuários e 100 mil lançamentos no usuário medido.

### 7.3 Migrations (ordem e backfill) - R2, T12

1. **`20261029000001_create_identity`**: enums `user_kind`, `user_role`, `user_status`; tabelas `users`, `sessions`, `demo_datasets` com os `CHECK`:
   - `email = lower(email)`, `updated_at >= created_at`;
   - `kind <> 'REGULAR' OR password_hash IS NOT NULL`;
   - `kind <> 'DEMO' OR (password_hash IS NULL AND role = 'USER')`;
   - `kind <> 'PENDING_FIRST_ADMIN' OR (password_hash IS NULL AND id = '<FIRST_ADMIN_ID>')`;
   - `sessions.expires_at > created_at`.
2. **`20261029000002_finance_ownership`** (um arquivo, numa transação):
   1. `ALTER TABLE cards ADD COLUMN user_id UUID NULL;` idem `entries`.
   2. **Marcador do primeiro administrador**, só se houver dados: `INSERT INTO users (id, name, email, password_hash, kind, role, status, must_change_password, created_at, updated_at) SELECT '<FIRST_ADMIN_ID>', 'Administrador', 'first-admin@finance.invalid', NULL, 'PENDING_FIRST_ADMIN', 'ADMIN', 'ACTIVE', true, now(), now() WHERE EXISTS (SELECT 1 FROM cards) OR EXISTS (SELECT 1 FROM entries) ON CONFLICT (id) DO NOTHING;`
   3. Backfill: `UPDATE cards SET user_id = '<FIRST_ADMIN_ID>' WHERE user_id IS NULL;` idem `entries`.
   4. `SET NOT NULL`; FKs `RESTRICT`.
   5. `DROP INDEX cards_name_key_uq; CREATE UNIQUE INDEX cards_owner_name_key_uq ON cards (user_id, name_key);`
   6. Recria os índices de `entries` com `user_id`.
   7. Funções e triggers de mesmo dono e de dono imutável.
   - Rollback (forward-fix): comentário no topo com os `DROP` e o retorno ao índice global.
3. Volume pequeno; locks aceitáveis. Ensaio num dump real antes do deploy (11.3).

**Por que a migração não lê `ADMIN_*` (T12):** migrations do Prisma são SQL estático; interpolar segredos exigiria gerar SQL em runtime e faria o hash de senha (argon2) acontecer fora da aplicação, ou gravaria a senha em texto. O marcador resolve a dependência "backfill precisa de dono" sem segredo: os dados legados ganham dono já na migração (nenhuma linha fica sem dono, RF21) e o dono se torna o primeiro administrador real na inicialização, **mantendo o id**. Nenhum `UPDATE` em dados financeiros acontece depois da migração.

### 7.4 Mappers

`UserMapper`, `SessionMapper` (identity/infrastructure/mappers). `CardMapper`/`EntryMapper` mapeiam `userId <-> ownerId`. `toView` do finance continua sem `userId` (P10).

### 7.5 Ordem no deploy, seed e inicialização (T12, RF20, CA12-CA14)

Ordem garantida pelo `CMD` do `api/Dockerfile` (já é `migrate deploy && db seed && node main`; muda só o que cada passo faz):

| Passo | O que faz | Por que nessa ordem |
|---|---|---|
| 1. `npx prisma migrate deploy` | M1 + M2 (marcador + backfill) | Tudo que vem depois assume `user_id NOT NULL` e as tabelas de identidade. |
| 2. `npx prisma db seed` -> `node dist/bootstrap/seed/run-seed.js` | `EnsureDemoUser` + `RefreshDemoDataset(DEMO_USER_ID)` | Independe do administrador. Não lê `ADMIN_*`. |
| 3. `node dist/main.js` | **antes do `app.listen`**, `main.ts` chama `BootstrapFirstAdmin` com `ADMIN_*`; `FirstAdminConfigError` -> loga os nomes das variáveis e códigos e `process.exit(1)` | "A API não sobe" (CA13) fica verdadeiro em qualquer forma de execução (Docker, `npm run start`), e não só no Docker. |

Detalhes:
- `prisma.config.ts`: `migrations.seed = "node dist/bootstrap/seed/run-seed.js"` (ajustar `dist/` ou `dist/src/` como o `CMD`). O seed é JS compilado (a imagem não tem dev deps).
- `run-seed.ts` e a chamada no `main.ts` são **composition roots**: instanciam adapters e use cases; o use case não sabe de onde vêm as variáveis.
- Idempotência (CA12): se existe qualquer usuário `REGULAR`, `BootstrapFirstAdmin` devolve `skipped` sem validar nem logar as variáveis; mudar `ADMIN_EMAIL`/`ADMIN_PASSWORD` depois não altera nada.
- Várias instâncias subindo juntas: `lockFirstAdminBootstrap` (`pg_advisory_xact_lock`) faz a segunda ver `countRegular() > 0` e devolver `skipped`.
- Banco novo sem dados: a migração não cria marcador; a inicialização cria o administrador com `FIRST_ADMIN_ID` (`created`).
- Testes e2e não passam pelo `main.ts`: criam usuários por fixture, sem `ADMIN_*`.
- README: depois da primeira subida, `ADMIN_PASSWORD` pode ser removida dos secrets (R10).

### 7.6 Manutenção periódica (B5)

Inalterado: `MaintenanceScheduler` chama `RefreshDemoDataset` e `PurgeExpiredSessions` a cada `MAINTENANCE_INTERVAL_MS`. Com sessão de 24 h, a purga mantém a tabela pequena.

### 7.7 Recuperação operacional (T15, R5)

Script `npm run admin:recover -- --email <email>` -> `node dist/bootstrap/scripts/recover-admin.js` (composition root, roda dentro do container com `docker exec`). A senha temporária vem de `RECOVERY_PASSWORD` no ambiente do comando ou de stdin, **nunca de argumento** (argv aparece em `ps` e no histórico). Chama `RecoverAdminAccess` (5.7). Documentar no README. Não há rota HTTP equivalente.

---

## 8. Infraestrutura - adapters

| Port | Adapter | Notas |
|---|---|---|
| `UserRepository` | `PrismaUserRepository` | P2002 em `users_email_uq` -> `EmailTakenError`. `listManageable` com `ORDER BY status, name COLLATE "pt-BR-x-icu", id` (fallback `Intl.Collator` na aplicação se a collation ICU não existir na imagem). |
| `SessionRepository` | `PrismaSessionRepository` | `deleteAllOfUser`/`deleteAllOfUserExcept` com `deleteMany`. |
| `SessionPrincipalLookup` | `PrismaSessionPrincipalLookup` | `SELECT ... FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_digest = $1 AND s.expires_at > $2` |
| `IdentityUnitOfWork` | `PrismaIdentityUnitOfWork` | `$transaction` interativa; `lockAdminSet` = `SELECT pg_advisory_xact_lock(hashtext('identity:admin-set'))`; `lockFirstAdminBootstrap` = idem com `'identity:first-admin'`. Repositórios recebem o `tx`. |
| `PasswordHasher` | `Argon2PasswordHasher` (`@node-rs/argon2`) | argon2id, m = 19456 KiB, t = 2, p = 1. Hash fictício gerado no boot. |
| `SessionTokenIssuer` | `HmacSessionTokenIssuer` (`node:crypto`) | inalterado |
| `AttemptLimiter` | `InMemoryAttemptLimiter` | inalterado (D7) |
| `IdentityAuditLog` | `LoggerIdentityAuditLog` | `Logger` do Nest, JSON, `event` + campos; e-mail como `sha256` truncado; nunca senha nem valores de campos editados. |
| `DemoDatasetStore` | `PrismaDemoDatasetStore` | inalterado |
| `BusinessCalendar` | `SaoPauloBusinessCalendar` | inalterado |

Composição: `IdentityModule` com providers por token; exporta nada para o finance. `AppModule` importa `IdentityModule` antes de `FinanceModule`.

---

## 9. Impacto no Next.js (`web/`)

### 9.1 Estrutura de rotas (T9)

```
web/
  proxy.ts                         # Next 16: redirecionamentos otimistas por cookie
  app/
    page.tsx                       # fallback; a decisão ocorre no proxy (RF34, CA41)
    (protected)/                   # renomeia o atual (app)/
      layout.tsx                   # getCurrentUser: null -> login; mustChangePassword -> /account/password
      entries/ dashboard/ cards/   # page.tsx finos: <XScreen mode={PROTECTED_MODE} reader=... />
      entries/actions.ts cards/actions.ts
      account/
        page.tsx                   # Meu perfil (RF09, RF43)
        actions.ts                 # updateProfileAction
        password/page.tsx          # Trocar senha (RF08, RF42); única página liberada na troca obrigatória
        password/actions.ts        # changePasswordAction
      admin/
        layout.tsx                 # role !== 'ADMIN' -> notFound() (RF10)
        users/page.tsx             # lista (RF11, RF44)
        users/actions.ts           # create/update/deactivate/reactivate/resetPassword
    (public)/demo/
      layout.tsx                   # usuário opcional, AppShell mode=demo, DemoBanner
      entries/ dashboard/ cards/
      actions.ts                   # só leitura: loadDemoInvoiceEntries
    (auth)/
      layout.tsx
      login/page.tsx login/login-form.tsx
      actions.ts                   # loginAction, logoutAction
  features/                        # telas reutilizadas (T10)
    entries/ dashboard/ cards/ account/ admin-users/
  lib/auth/
    session-cookie.ts current-user.ts next-param.ts route-policy.ts initial.ts
  lib/api/
    http.ts                        # Bearer, X-Forwarded-For, erros tipados (9.2)
    action-result.ts               # toResult/toActionError (13.2)
    finance-reader.ts              # FinanceReader + createFinanceReader('protected' | 'demo')
    identity-client.ts             # chamadas A1-A5 e U1-U7 (server-only)
  components/
    app-shell.tsx app-header.tsx main-nav.tsx account-menu.tsx sign-in-button.tsx
    demo-banner.tsx app-mode.tsx read-only.tsx
```

Sai: `(auth)/register/*`, `registerAction`, `demo-invite.tsx`, `WriteAction` com convite. `/register` não tem rota e cai no `not-found` global (RF06, CA07).

### 9.2 Sessão no BFF (T1, RNF02)

- Cookie `fa_session` (produção `__Host-fa_session`): `httpOnly`, `SameSite=Lax`, `Secure` fora do ambiente local, `Path=/`, `Expires = session.expiresAt` (24 h).
- `http.ts`: `request(method, path, { query, body, auth = 'session' })`. Sem cookie, nem chama a API (`UnauthenticatedApiError`). Envia `X-Forwarded-For`. `cache: "no-store"` (R8). Erros tipados: 401 -> `UnauthenticatedApiError`; 403 `PASSWORD_CHANGE_REQUIRED` -> `PasswordChangeRequiredApiError`; 403 `FORBIDDEN` -> `ForbiddenApiError`.
- `getCurrentUser()` (`cache` do React, **por requisição**, nunca entre requisições): `GET /api/auth/me`; 401 -> `null`. Devolve `CurrentUserDto` com `role` e `mustChangePassword`.
- `API_URL` é a única variável de endereço da API, lida só no servidor. `NEXT_PUBLIC_API_URL` é removida (9.9).

### 9.3 `proxy.ts` (redirecionamentos)

`decideRoute(pathname, search, hasCookie)` (pura, testada):
- `/` -> cookie ? `/entries` : `/demo/entries` (CA41).
- `/entries`, `/dashboard`, `/cards`, `/account*`, `/admin*` sem cookie -> `/login?next=<path+query>` (CA40).
- `/login` com cookie -> valida com `GET /auth/me` (timeout 2 s): válida e `mustChangePassword` -> `/account/password`; válida -> `/entries` (RF05, CA07); inválida -> apaga o cookie e segue.
- Injeta `x-fa-url` (path + query).

O proxy só olha a presença do cookie; nível e troca obrigatória são decididos no layout e na API.

### 9.4 Leituras protegidas: 401, troca obrigatória e nível

- `FinanceReader` protegido e `identity-client`: `UnauthenticatedApiError` -> `redirect(loginUrl(x-fa-url))` com `reason=expired` (PA1); `PasswordChangeRequiredApiError` -> `redirect('/account/password?next=...')`; `ForbiddenApiError` -> `notFound()`.
- `(protected)/layout.tsx`: `getCurrentUser()` null -> login; `mustChangePassword` e caminho diferente de `/account/password` -> `/account/password?next=<x-fa-url>` (RF07, CA08). Layouts não re-renderizam em navegação no cliente, por isso o redirect nos readers (alimentado pelo 403 da API) é o que garante o comportamento.
- `(protected)/admin/layout.tsx`: `role !== 'ADMIN'` -> `notFound()` (CA15). A API devolve 403 de qualquer forma.
- Correção mantida: `settle()` e `try/catch` em RSC chamam `unstable_rethrow(error)` para não engolir `NEXT_REDIRECT`/`NEXT_NOT_FOUND`.

### 9.5 Server Actions (RNF08)

| Action | Arquivo | Comportamento |
|---|---|---|
| `loginAction` | `(auth)/actions.ts` | A1 com `auth: 'none'`. Sucesso: grava o cookie; `mustChangePassword` -> `redirect('/account/password?next=' + safeNext(next))`; senão `redirect(safeNext(next))` (CA01, CA02, CA08). Erros viram estado: `fields`, banner `INVALID_CREDENTIALS`, `retryAfterSeconds`. |
| `logoutAction` | idem | POST; A2; apaga o cookie; `redirect('/demo/entries')` (CA05). Nunca por GET. |
| `changePasswordAction` | `account/password/actions.ts` | Confirmação diferente barrada antes da chamada ("As senhas não conferem.", CA10). A4. Sucesso com troca obrigatória -> `redirect(safeNext(next))` (CA09); sem -> estado "Senha alterada.". O cookie continua (a sessão atual é mantida). |
| `updateProfileAction` | `account/actions.ts` | A5; sucesso -> estado de confirmação + `router.refresh()` no cliente (inicial atualizada, CA11). |
| `createUserAction`, `updateUserAction`, `deactivateUserAction`, `reactivateUserAction`, `resetUserPasswordAction` | `admin/users/actions.ts` | U3-U7. `EMAIL_TAKEN` inline no e-mail (CA17); `LAST_ADMIN`/`CANNOT_TARGET_SELF` como mensagem do diálogo; `FORBIDDEN` -> `router.refresh()` (a página vira not-found). |
| Escritas existentes | `(protected)/*/actions.ts` | `toResult` trata `UnauthenticatedApiError` (apaga cookie, `SESSION_EXPIRED`, `loginUrl`, CA06) e `PasswordChangeRequiredApiError` (`redirectUrl` para a troca). |
| `loadDemoInvoiceEntries` | `(public)/demo/actions.ts` | leitura via reader demo; sem cookie |

CSRF: as Server Actions comparam `Origin` com `Host`; `experimental.serverActions.allowedOrigins` por variável atrás de proxy.

`safeNext(raw)`: aceita só caminhos que começam com `/` (não `//` nem `/\`), sem esquema nem caracteres de controle após decodificar, cujo caminho é `/entries`, `/dashboard`, `/cards`, `/account`, `/account/password` ou `/admin/users` (exato, ou seguido de `/` ou `?`). Qualquer outra coisa vira `/entries` (RF35, CA02). `next` para `/admin/users` com usuário `USER` resulta em not-found pelo layout (RF35).

### 9.6 Reuso das telas e modo só de visualização (T10, RF30-RF33, B4)

- `AppMode = { kind: 'protected' | 'demo'; basePath: '' | '/demo'; readOnly: boolean }`.
- Server components recebem `mode` e `reader: FinanceReader` por prop.
- Client components leem `useAppMode()`. Elementos de escrita ("Novo lançamento", "+ Novo cartão", "Editar", "Pagar", "Pagar selecionadas", "Pagar fatura") e checkboxes de seleção ficam dentro de `<WriteOnly>`, que **não renderiza nada** em `readOnly` (RF31, CA38). Não existe convite, diálogo nem drawer de escrita na demo; os imports das Server Actions de escrita ficam só nos componentes envolvidos por `<WriteOnly>`, e um teste garante que nenhum é renderizado em `DEMO_MODE`.
- Hrefs: `entriesHref(state)` e `MainNav` recebem `basePath` (RF33, CA39).
- `DemoBanner` (RF32, RF36): "Você está vendo dados de exemplo." com "Entrar" (com `next` equivalente) ou, logado, "Ir para meus dados". Chip "Demonstração" na navbar (PA4).

### 9.7 Navbar (RF37-RF40)

- `AppHeader` recebe `user: CurrentUserDto | null` e `mode`. Sem usuário: `SignInButton` (`/demo/x` -> `next=/x`, CA43). Com usuário: `AccountMenu` (ARIA menu button, top layer, PA5) com cabeçalho, "Meu perfil", "Trocar senha", "Usuários" (só `role === 'ADMIN'`) e "Sair"; com `mustChangePassword`, só cabeçalho e "Sair" (RF38, CA44).
- `userInitial(name)`: `Intl.Segmenter('pt-BR', { granularity: 'grapheme' })` sobre o nome normalizado, `toLocaleUpperCase('pt-BR')` (CA45).

### 9.8 Stub de e2e (T11, R7)

`web/e2e/stub-api/server.mjs`: A1-A5 e U1-U7 em memória (usuários `vagner` ADMIN, `ana` USER, `carla` com troca obrigatória, `bruno` inativo; token `stub-<id>`), Bearer em todas as rotas atuais, 403 `PASSWORD_CHANGE_REQUIRED`/`FORBIDDEN`, encerramento de sessões ao inativar/redefinir, `/api/demo/*` e cenários `expired-session` e `rate-limited`. **Sem cadastro.** Fixture `authenticatedPage(role)`.

### 9.9 Variáveis do web e deploy (RF45, D11)

- Mantidas: `API_URL` (server-only), `SESSION_COOKIE_SECURE` (opcional), `SERVER_ACTIONS_ALLOWED_ORIGINS` (opcional).
- **Removida** `NEXT_PUBLIC_API_URL`: `web/Dockerfile` (linhas 12-13, `ARG`/`ENV`), `.github/workflows/deploy.yml` (linha 56, build-arg) e qualquer uso no código. O secret `NEXT_PUBLIC_API_URL` do repositório pode ser apagado.
- Deploy: a API não publica porta para fora da rede interna (sem mapeamento de porta pública nem rota no proxy de borda); o web alcança a API por `API_URL` interna. Verificação no CA47.

---

## 10. Estrutura da api (acréscimos)

```
api/src/
  main.ts                           # + BootstrapFirstAdmin antes do listen (7.5)
  bootstrap/
    env.ts configure-app.ts
    first-admin.ts                  # composition root da inicialização (chamado por main.ts)
    seed/run-seed.ts                # demo (7.5)
    scripts/recover-admin.ts        # T15 (7.7)
  shared/
    domain/text.ts well-known-ids.ts app-error.ts(+kinds)
    application/ports/business-calendar.ts
    presentation/auth/{principal.ts, public.decorator.ts, allow-during-password-change.decorator.ts,
                       require-role.decorator.ts, current-owner-id.decorator.ts, current-principal.decorator.ts}
  modules/identity/
    domain/
      user/        user.ts, value-objects/{user-id,user-name,email-address,plain-password,password-hash,
                   user-role,user-status}.ts, last-active-admin.policy.ts, self-target.policy.ts,
                   parse-new-user.ts, parse-user-details.ts, parse-first-admin-config.ts,
                   events/, errors/, user.repository.ts
      session/     session.ts, session-policy.ts, value-objects/, events/, session.repository.ts
    application/
      ports/       password-hasher.ts, session-token-issuer.ts, session-principal-lookup.ts,
                   identity-unit-of-work.ts, attempt-limiter.ts, identity-audit-log.ts
      policies/    attempt-policies.ts
      use-cases/
        auth/       login-with-password.ts, authenticate-session.ts, get-current-user.ts, logout.ts,
                    check-auth-request-quota.ts, purge-expired-sessions.ts
        account/    change-own-password.ts, update-own-profile.ts
        user-admin/ list-users.ts, get-user.ts, create-user.ts, update-user.ts, deactivate-user.ts,
                    reactivate-user.ts, reset-user-password.ts, admin-transaction.ts (passos 2-3 comuns)
        bootstrap/  bootstrap-first-admin.ts, recover-admin-access.ts, ensure-demo-user.ts
      views.ts      CurrentUserView, AdminUserView, AuthResult
    infrastructure/ prisma-user.repository.ts, prisma-session.repository.ts,
                    prisma-session-principal-lookup.ts, prisma-identity-unit-of-work.ts, mappers/,
                    argon2-password-hasher.ts, hmac-session-token-issuer.ts, in-memory-attempt-limiter.ts,
                    logger-identity-audit-log.ts, maintenance-scheduler.ts, identity-infrastructure.providers.ts
    presentation/http/ auth.controller.ts, account.controller.ts, admin-users.controller.ts,
                       schemas/, presenters/
    presentation/guards/ access-control.guard.ts, policies/{authentication,password-change,role}.policy.ts,
                         auth-quota.guard.ts
    identity.module.ts
  modules/finance/
    domain/owner/owner-id.ts
    application/demo/ ...
    infrastructure/demo/prisma-demo-dataset-store.ts
    presentation/http/read-handlers/finance-read-handlers.ts
    presentation/http/demo/*.controller.ts
```

Regras em `api/test/architecture.spec.ts` (estender): `modules/finance/**` não importa `modules/identity/**` e vice-versa; `identity/domain` não importa `argon2`, `node:crypto`, Nest nem Prisma; `identity/application` não importa `infrastructure`; só `bootstrap/`, `main.ts` e `app.module.ts` conhecem os dois módulos.

---

## 11. Plano de testes por camada

Convenções do ADR 0001 mantidas (`*.spec.ts`, `*.int-spec.ts` com testcontainers, `*.e2e-spec.ts`, `TZ=America/Sao_Paulo`, cobertura >= 80% em domain/application). `TRUNCATE` inclui `sessions, users, demo_datasets` (`CASCADE`). Builders `aUser({ role, status, mustChangePassword })`, `anAdmin()`, `anOwner()`; todo teste de finance usa **dois donos** (Ana e Bruno).

### 11.1 Domain (unitário)
- `UserName`, `EmailAddress`, `PlainPassword` (7/8/72/73, sem trim, mascarado), `UserRole` (`ROOT` -> `INVALID_VALUE`).
- `parseNewUser` acumula os quatro campos (CA18); `parseFirstAdminConfig` usa nomes de variáveis e nunca contém o valor da senha (CA13); `.invalid` só é recusado em `ADMIN_EMAIL`.
- `User`: invariantes de `kind`/hash/role; `create` nasce `ACTIVE` + troca obrigatória; `canAuthenticate` falso para inativo, demo e marcador; `deactivate`/`reactivate` idempotentes sem evento repetido; `resetPassword` liga a troca e funciona em inativo; `changePassword` desliga; `updateDetails` devolve `changedFields`; `provisionFirstAdmin` só a partir do marcador e mantém o id; eventos sem PII.
- `LastActiveAdminPolicy`: tabela (alvo admin ativo/inativo/user x mudança inativar/rebaixar/nenhuma x outros 0/1).
- `SelfTargetPolicy`.
- `Session`: `expiresAt = createdAt + 24h`, `isActiveAt` em 23:59:59.999 e 24:00 (CA06).
- `Card`/`Entry` com `ownerId`; `buildDemoDataset` com fast-check.

### 11.2 Application (unitário com fakes)
Fakes: `InMemoryUserRepository`, `InMemorySessionRepository`, `InMemorySessionPrincipalLookup`, `InMemoryIdentityUnitOfWork` (registra se `lockAdminSet` foi chamado **antes** de `countActiveAdminsExcept`), `FakePasswordHasher` (conta `verify`), `FixedTokenIssuer`, `InMemoryAttemptLimiter` + `FixedClock`, `SpyIdentityAuditLog`, `FakeDemoDatasetStore`, `FixedBusinessCalendar`.
- `LoginWithPassword`: inexistente, senha errada, inativo, demo e marcador -> mesmo erro e **uma** chamada a `verify` em cada (CA03, RNF05); 5 falhas -> 429 com senha certa (CA04); `mustChangePassword` na resposta (CA08); auditoria.
- `AuthenticateSession`: malformado, desconhecido, expirado, usuário inativo, `role`/`mustChangePassword` refletem o estado atual (T16).
- `ChangeOwnPassword`: `INCORRECT` conta falha, 6ª -> 429 (CA10); `SAME_AS_CURRENT`; `TOO_SHORT` sem chamar `verify`; sucesso apaga outras sessões e mantém a atual (CA09).
- `UpdateOwnProfile`: normalização (CA11).
- Gestão: para cada use case, ator `USER` -> 403, ator inativo -> 401, alvo inexistente/demo/marcador -> 404 (CA26), precedência 400 > 404 > 422 > 409; `CreateUser` 409 por `findByEmail` e por corrida, e-mail do demo -> 409 (CA17); `UpdateUser` rebaixando último admin (inclusive a si mesmo) -> `LAST_ADMIN`, com dois admins -> ok (CA24); `DeactivateUser` self -> `CANNOT_TARGET_SELF` (CA23), último admin -> `LAST_ADMIN`, apaga sessões (CA20), idempotente; `ReactivateUser` não liga troca (CA21); `ResetUserPassword` liga troca e apaga sessões, self -> 422 (CA22); auditoria com `actorId` e só nomes de campos.
- `BootstrapFirstAdmin`: `skipped` com usuário `REGULAR` mesmo sem variáveis (CA13 And); `created` em banco vazio; `provisioned` com marcador (CA14); variáveis ausentes/inválidas -> `FirstAdminConfigError` sem valor da senha; e-mail normalizado (CA12).
- `RecoverAdminAccess`.
- Finance: para cada use case, "recurso de outro dono" e "dono atribuído na criação" (CA28-CA33).
- `RefreshDemoDataset`.

### 11.3 Infrastructure (integração, Postgres real)
- **Migração M2 sobre banco com dados pré-existentes:** marcador criado com `FIRST_ADMIN_ID`, todas as linhas com `user_id` dele, `NOT NULL`, índice por dono, triggers; banco vazio não cria marcador. Seguido de `BootstrapFirstAdmin` real: totais do resumo antes e depois iguais (CA14).
- `CHECK`s de `users` (REGULAR sem hash falha; DEMO com ADMIN falha; marcador com outro id falha).
- `PrismaUserRepository`: `EmailTakenError` em corrida; `listManageable` exclui demo/marcador e ordena; `countActiveAdminsExcept`.
- `PrismaSessionRepository`: `deleteAllOfUser`, `deleteAllOfUserExcept`, `deleteExpired`.
- `PrismaSessionPrincipalLookup`: devolve nível/situação atuais após `UPDATE` direto no banco (T16).
- **T14 concorrência:** dois admins ativos A e B; `Promise.all([DeactivateUser(actor A, target B), UpdateUser(actor B, target A, role USER)])` repetido N vezes (ex.: 50) com use cases e `PrismaIdentityUnitOfWork` reais; asserção: sempre exatamente um sucesso, o outro `LAST_ADMIN` ou 401, e ao final `countActiveAdmins >= 1` (CA24). Variante: dois `DeactivateUser` cruzados (A inativa B, B inativa A).
- **Bootstrap concorrente:** duas chamadas paralelas -> um `created`/`provisioned` e um `skipped`.
- `Argon2PasswordHasher` (tempo de `verify(_, null)` equivalente; login p95 < 500 ms), `HmacSessionTokenIssuer`.
- **RNF06:** dois donos para cada repositório, catálogo e read model (CA29, CA37). Verificação estática: nenhuma query de `identity/infrastructure` referencia `cards`/`entries`.
- `PrismaDemoDatasetStore`: idempotência e concorrência (CA34).
- Perf `rnf06.perf-spec` com 2 usuários.

### 11.4 Presentation (e2e, supertest)
- 401 em **todas** as rotas protegidas (geradas pelo DiscoveryService), sem token, adulterado, expirado (`FixedClock`) e após logout; corpo inválido no schema ainda dá 401 (CA27).
- "Seguro por padrão": as rotas públicas são exatamente A1, A2 e `GET /api/demo/*`; as liberadas na troca obrigatória são exatamente A3 e A4; as com `RequireRole('ADMIN')` são exatamente U1-U7.
- Troca obrigatória: `GET /api/summary?month=invalido` com Carla -> 403 `PASSWORD_CHANGE_REQUIRED`; A3/A4/A2 funcionam (CA08).
- Gestão com usuário `USER` e corpo inválido -> 403 `FORBIDDEN`, não 400 (CA15).
- A1-A5 e U1-U7: códigos de sucesso, 400 acumulado, 409 com `details.fields[0]`, 422, 404, 429 com `Retry-After`; nenhuma resposta contém `passwordHash` nem campos financeiros (CA25).
- Efeito imediato: Ana com duas sessões; admin inativa -> as duas 401 (CA20); admin redefine -> as duas 401 (CA22); admin promove -> próxima requisição de Ana em U1 é 200, rebaixa -> 403 (CA19).
- `POST /api/auth/register` -> 404 `ROUTE_NOT_FOUND` (CA07).
- CA28-CA33 com dois usuários reais; admin contra recurso de USER -> 404 (CA25).
- Demo: GET 200 com mesmo schema; POST/PUT/PATCH/DELETE -> 404 com e sem token; sem dados de usuários (CA35-CA37).

### 11.5 Web
- Vitest: `safeNext` (CA02 + `/account`, `/admin/users`), `decideRoute` (CA40, CA41, CA07 com `mustChangePassword`), `userInitial` (CA45), `http.ts` (Bearer, 401/403 tipados, XFF), `toResult` (401 e 403 PCR), `settle` repassa redirect/not-found, `AccountMenu` (itens por nível e versão reduzida, teclado, CA44), `<WriteOnly>` não renderiza em `DEMO_MODE` e nenhuma Server Action de escrita é chamada (CA38), `MainNav` com `basePath` (CA39), `SignInButton` (CA43), `changePasswordAction` barra confirmação diferente sem chamar a API (CA10).
- Playwright + axe (stub atualizado): CA01-CA11, CA15-CA24 (fluxos de tela), CA38-CA46, logout + voltar com recarga, sessão expirada com o drawer aberto, 360/1280 px nos dois temas.
- CA47: busca por `NEXT_PUBLIC_API_URL` no código, `web/Dockerfile`, workflow e `.next/static` (teste de build no CI); Playwright registra requisições do navegador e falha se alguma for para a origem da API.

### 11.6 Matriz CA -> camada (resumo)

| CA | Domain | Application | Infra | e2e API | Web |
|---|---|---|---|---|---|
| 01-02 | - | Login | - | A1 | safeNext, PW |
| 03-04 | User.canAuthenticate | Login | hasher, limiter | A1 | banner, 429 |
| 05-06 | Session (24 h) | Logout | sessions | A2, 401 | proxy, PW |
| 07 | - | - | - | 404 register | decideRoute, PW |
| 08 | User | AuthenticateSession | lookup | 403 PCR | layout, PW |
| 09-10 | User.changePassword | ChangeOwnPassword | sessions | A4 | action, PW |
| 11 | UserName | UpdateOwnProfile | - | A5 | PW |
| 12-14 | parseFirstAdminConfig, User | BootstrapFirstAdmin | migração M2, bootstrap | - | - |
| 15 | - | - | - | 403 FORBIDDEN | admin layout, menu |
| 16-18 | parseNewUser | CreateUser | users | U3 | PW |
| 19 | User.updateDetails | UpdateUser | lookup (T16) | U4 + efeito imediato | PW |
| 20-22 | User | Deactivate/Reactivate/Reset | sessions | U5-U7 + 401 | PW |
| 23-24 | políticas | UpdateUser, DeactivateUser | **concorrência T14** | 422 | PW |
| 25-26 | - | gestão | sem tabelas financeiras | U1/U2 + 404 | - |
| 27 | - | AuthenticateSession | - | todas | - |
| 28-33 | Card/Entry owner | finance UCs | RNF06 | sim | - |
| 34-37 | template | RefreshDemoDataset | store | demo | - |
| 38-46 | - | - | - | - | Vitest + PW + axe |
| 47 | - | - | - | - | build + PW |

---

## 12. Decisões, alternativas descartadas e trade-offs

| # | Decisão | Alternativas descartadas | Trade-off |
|---|---|---|---|
| D1 (T1, T2) **aprovada** | Token opaco com sessão no banco (digest HMAC), Bearer do BFF para a API, cookie httpOnly só no web; validade fixa de 24 h | JWT sem estado (não revoga; inativação e redefinição exigiriam denylist); cookie direto na API | Uma consulta por requisição. É também o que viabiliza o T16 e o encerramento imediato de sessões (RNF14). |
| D2 (T3) | argon2id via `@node-rs/argon2`; limite de 72 | bcrypt; `crypto.scrypt`; `crypto.argon2` (Node >= 24.7) | Dependência nativa com binários prontos. |
| D3 (T4) | Usuário demo real + `GET /api/demo/*` | fixtures no web; flag `?demo=1` | 9 rotas a mais, mesmo código. |
| D4 (T5, B5) | Regenerar a demo quando o mês muda | deslocar datas na leitura; cron externo | `demo_datasets` + timer in-process. |
| D5 (T6) | Contexto `identity` (com a gestão de usuários dentro); `ownerId` explícito em todo use case do finance | gestão em contexto próprio (consistência eventual onde a spec exige efeito imediato); repositórios com escopo por requisição; RLS | Assinaturas mais longas; esquecer o dono vira erro de compilação. RLS como evolução. |
| D6 (T7) | `user_id` como prefixo dos índices; `(user_id, name_key)`; triggers de mesmo dono; `users` com `kind`, `role`, `status`, `must_change_password` | FK composta (limitação do Prisma); tabela de papéis N:N (dois níveis fixos, P14 da spec descarta permissões finas) | Triggers fora do schema Prisma, com teste dedicado. |
| D7 (T8) | Limitador em memória, reutilizado para a senha atual | Postgres/Redis já agora | R9 aceito (instância única). |
| D8 (T9) | Grupos `(protected)` (com `account/` e `admin/`), `(public)/demo`, `(auth)` só com login; proxy otimista por cookie; layout checa troca obrigatória e nível; decisão final sempre na API (401/403) | só layout; só proxy | Três camadas de checagem; a API é a autoridade. |
| D9 (T10) | Telas em `web/features/*` com `AppMode` e `FinanceReader`; `<WriteOnly>` remove elementos | duplicar páginas; desabilitar botões (contraria B4) | Refatoração de imports; zero drift. |
| D10 (T11) | Stub com auth, níveis, troca obrigatória, gestão e demo; fixture `authenticatedPage(role)` | desligar auth no e2e | E2e passam pelo login. |
| D11 **fechada** | API **não exposta**; IP via `X-Forwarded-For` + `trust proxy` restrito; `NEXT_PUBLIC_API_URL` removida | API pública com limite por IP do socket | O XFF só pode ser forjado por quem já está na rede interna. |
| D12 **aprovada** | `MALFORMED_JSON`/413 antes de 401 | reordenar o body parser | Desvio pequeno (6.4). |
| D13 **aprovada** | Login não devolve 400 de formato de e-mail | validar formato no login | Sem terceira resposta distinguível. |
| D14 (T12) | Migração cria um **marcador** do primeiro administrador (`PENDING_FIRST_ADMIN`, sem senha, id fixo) só se houver dados; o boot da API (`main.ts`, antes do `listen`) o provisiona com `ADMIN_*` sob advisory lock; idempotência por "existe usuário `REGULAR`" | migração lendo `ADMIN_*` (SQL estático, hash fora da aplicação, segredo em SQL); passo de bootstrap **antes** da migração (a tabela `users` ainda não existe); bootstrap no seed (o "API não sobe" valeria só no Docker); `UPDATE` de ownership depois da inicialização (janela com dados sem dono e `NOT NULL` impossível) | Um valor de enum (`PENDING_FIRST_ADMIN`) que existe só por instantes no deploy, com `CHECK` próprio. Ganho: nenhuma linha sem dono, nenhum segredo fora da aplicação, ordem garantida pela própria sequência migrate -> seed -> main. |
| D15 (T13) | Um `AccessControlGuard` global com políticas ordenadas (autenticação -> troca obrigatória -> nível) e decorators de liberação | três `APP_GUARD` (ordem depende do registro de providers); checagem nos use cases (o 403 viria depois do 400, contra RF07/RF10) | Um ponto central; novas políticas por composição (OCP). |
| D16 (T14) | Toda escrita da gestão roda numa transação com `pg_advisory_xact_lock('identity:admin-set')`, revalida o ator e conta os outros admins ativos **depois** do lock | `SELECT ... FOR UPDATE` sobre os admins ativos (em READ COMMITTED não enxerga linhas que passam a qualificar e depende do conjunto travado); `SERIALIZABLE` com retry (complexidade de retry nos use cases); só checagem na aplicação (corrida real, CA24) | Serializa as escritas de gestão (volume baixíssimo). Hash de senha fora do lock. Teste concorrente com Postgres real. |
| D17 (T15) | Script CLI `admin:recover` (promove, reativa, redefine, encerra sessões), senha por env/stdin | rota HTTP de "super admin"; SQL manual documentado (sem hash, sem auditoria) | Exige acesso ao container; é o objetivo (fora da superfície HTTP). |
| D18 (T16) | Principal com nível, situação e troca obrigatória vindos de `sessions JOIN users` em toda requisição, sem cache | cache em memória com TTL (viola RNF14); copiar nível na sessão (rebaixamento não valeria até o próximo login) | Um join por PK a mais por requisição (desprezível). |
| D19 | Gestão: `PUT /api/admin/users/:id` para dados e `POST .../deactivate`, `.../reactivate`, `.../password-reset` para transições | `PATCH` genérico com `status`/`password` no corpo (mistura regras de 422 e efeitos colaterais de sessão numa mesma rota) | Mais rotas, cada uma com uma regra e um efeito claros. |
| D20 | E-mail do demo responde 409 na criação (só `ADMIN_EMAIL` recusa `.invalid` por formato) | recusar `.invalid` em todo lugar (daria 400 no CA17) | O admin pode cadastrar outros e-mails `.invalid` (inócuo: e-mail não é enviado). |

---

## 13. Violações de SOLID e problemas no código atual que afetam a feature

1. **DIP - telas do web dependem de funções concretas de endpoint.** `expenses-panel.tsx`, `income-panel.tsx`, `invoices-panel.tsx`, `entries-header.tsx`, `dashboard-blocks.tsx`, `cards/page.tsx` e `entry-drawer-host.tsx` importam `@/lib/api/endpoints` e `@/lib/api/queries` com caminhos fixos. Impede reaproveitar as telas na demo. Ação: `FinanceReader` por prop (9.6).
2. **SRP - `web/lib/api/http.ts`** mistura transporte e tradução de erro de Server Action (`toResult`, `toActionError`, que conhece `missingIds`/`incomeIds` do finance) e vai ganhar autenticação e três erros tipados. Ação: transporte em `http.ts`, tradução em `lib/api/action-result.ts`, token em `lib/auth/session-cookie.ts`.
3. **OCP - `MainNav`** (`LINKS` fixos), `AppHeader` (marca fixa, sem espaço para conta) e `entriesHref` (`lib/filters/entries-search-params.ts:91`) precisam de `basePath` e slots.
4. **`settle()` em `lib/api/queries.ts`** captura `NEXT_REDIRECT`/`NEXT_NOT_FOUND`: quebraria os redirects de sessão expirada, troca obrigatória e o not-found de nível (9.4).
5. **Escopo global implícito no finance:** `CardRepository.findByNameKey`, `CategoryCatalog.findByKey`, `InvoiceKey` e todos os read models sem parâmetro de escopo; os `$queryRaw` sem `WHERE user_id` são onde R1 aconteceria. Ação: 4.2/5.5.
6. **`finance/domain/text.ts`** contém utilitários genéricos. Ação: mover para `shared/domain/text.ts`.
7. **Deploy:** `api/Dockerfile` roda `npx prisma db seed` sem seed configurado; `web/Dockerfile` (linhas 12-13) e `deploy.yml` (linha 56) injetam `NEXT_PUBLIC_API_URL`, contradizendo o BFF. Ação: 7.5 e 9.9.
8. **`HttpErrorFilter`**: sem como um `AppError` declarar headers; `ErrorKind` sem `forbidden`. Ação: o filtro deriva headers do `kind` (6.6).
9. **`main.ts`** não tem passo de inicialização antes do `listen` e lê `process.env.PORT` direto, sem validação. Ação: `env.ts` validado e `first-admin.ts` chamado antes do `listen` (7.5), mantendo o `main.ts` como composition root fino.

---

## 14. Consequências

- **Positivas:** isolamento por dono em três níveis (assinatura, SQL, teste com dois usuários) mais triggers; rotas seguras por padrão, inclusive para a troca obrigatória; nível, situação e sessões com efeito imediato; regra do último administrador garantida sob concorrência com teste real; nenhuma linha sem dono em momento algum da migração; nenhum segredo fora da aplicação; demo com o mesmo código e contrato das rotas reais, sem nenhum caminho de escrita; API fora da internet.
- **Negativas:** refatoração ampla de assinaturas no finance e das telas do web; uma consulta (join) de sessão por requisição; limitador em memória; triggers fora do schema Prisma; dependência nativa de argon2; um estado transitório `PENDING_FIRST_ADMIN`; escritas de gestão serializadas por lock; e2e do web dependentes do login no stub.

### 14.1 Compatibilidade com a Feature B (`docs/specs/categorias-inativacao.md`)

Nada aqui precisa ser desfeito pela Feature B:
- Categoria-entidade nasce com `user_id` e unicidade `(user_id, type, key)`; o padrão de `ownerId` na assinatura (4.2) e o trigger de mesmo dono (D6) se estendem a `entries.category_id -> categories`. O `CategoryCatalog` por dono vira o repositório da entidade.
- Inativação de cartão e cancelamento de lançamento são novos estados nos aggregates do finance, sem relação com `identity`. Os índices `(user_id, reference_month, type, status)` já incluem `status`.
- A demo regenera com categorias-entidade incrementando `template_version` (5.6); `DemoDatasetStore.replaceIfStale` passará a apagar e inserir categorias do dono.
- `@CurrentOwnerId()`, o guard e a precedência (401 > 403 > 400 > 404 > 422) valem automaticamente para as rotas novas.

### 14.2 Próximo passo

Aprovação final do usuário (inclusive D14-D20), depois ui-designer (login, trocar senha, meu perfil, gestão de usuários, menu da conta, aviso da demo) e tester (red) com a matriz 11.6.
