# ADR 0013 - Remoção da demonstração pública, entrada sempre pelo login (dica e alias `demo`) e rotina de restauração da conta demo

- **Status:** Aceito (2026-11-14), implementado em `review/demo` e aprovado na revisão de código. As decisões de negócio B1-B5 (seção 0) foram **aprovadas pelo usuário** (recomendações do planner, repassadas pelo coordenador em 2026-11-14). As técnicas T1-T9 foram resolvidas aqui e aceitas com o ADR. Divergências entre o texto e o código final: seção 17.
- **Data:** 2026-11-14
- **Spec:** `docs/specs/remover-demo-publica-login.md` (rev. 1; a rev. 2 deve registrar B1-B5 como decididas)
- **Branch:** `review/demo`
- **Relacionados:** ADR 0005 (§2.3, §3.2, §5.3, §5.6, **§6.5 substituído**, §7.6, §9.3, §9.5, §9.6, §9.7, §9.8), ADR 0011 (§2.2, §3.3, §3.5, §5.3, **§5.4 substituído na parte da limpeza**, §6.1 N4, §6.4, §7.3, §9), `docs/api/finance.md`, `docs/api/identity.md`, `docs/specs/autenticacao-autorizacao.md` (CA41, CA43), `docs/specs/mobile-app.md` (RF25, RF34, RF39, P22, P24)
- **Autor:** architect
- **Escopo:** `api/` (NestJS, Prisma 7, PostgreSQL), `web/` (Next.js 16 App Router), `mobile/` (só textos e notas de revisão)
- **Impacto em UI:** sim (web: saem `/demo/*` e os elementos do modo demo; `/login` perde "Ver demonstração", ganha a dica e o rótulo do primeiro campo muda. Mobile: só textos)

---

## 0. Decisões de negócio (B1-B5) - Aprovadas

| Id | Decisão | Onde impacta |
|---|---|---|
| **B1** | A API aceita o identificador **`demo`** no login como alias da conta demo (sem diferenciar maiúsculas de minúsculas e ignorando espaços nas pontas). O alias vale só no `POST /api/auth/login`, portanto também no app mobile, e corresponde a `demo@showcase.invalid`, que continua funcionando. Reverte a remoção do alias da rev. 3 da spec mobile (ADR 0011 B5). | 3.1, 5.3, 6.2, 9.3, 12 |
| **B2** | A conta demo tem como **estado inicial o dataset de exemplo** (o mesmo gerador da demonstração pública, ancorado no mês corrente de America/Sao_Paulo). O seed grava o dataset quando a conta está habilitada, e a rotina apaga tudo e o restaura a cada execução. | 3.2, 4, 5.4, 5.5, 7 |
| **B3** | A conta demo **continua com escrita** (`MANAGE_EXPENSES`, como no ADR 0011 B6). Nenhuma capacidade muda. | 3.3 (sem mudança) |
| **B4** | A dica aparece **só quando a conta demo está habilitada**. | 9.3 (T2) |
| **B5** | Rotina **diária às 03:00 America/Sao_Paulo**, **sem revogar sessões**, mais um **script manual** sem HTTP. | 5.5, 8 |

Premissas P01-P14 da spec adotadas integralmente.

---

## 1. Contexto

Estado atual (verificado no código, complementa a seção 1 da spec):

- **Demonstração pública:** `finance/presentation/http/demo.controller.ts` (`@Public()`, 10 GETs com dono `DEMO_USER_ID`, via `FinanceReadHandlers`). O dono é criado por `EnsureDemoUser` (`identity/application/use-cases/bootstrap/ensure-demo-user.ts`) e `User.demo()`. Os dados vêm de `RefreshDemoDataset` + `buildDemoDataset` + port `DemoDatasetStore` (`finance/application/demo/`) e do adapter `PrismaDemoDatasetStore`, que, sob `pg_advisory_xact_lock(hashtext('demo-dataset:<owner>'))`, apaga lançamentos e cartões do dono e grava o dataset **só se** (âncora, versão) mudou, registrando em `demo_datasets` (sem FK).
- **Seed** (`bootstrap/seed/run-seed.ts`): `EnsureDemoUser` -> `RefreshDemoDataset(DEMO_USER_ID)` -> `EnsureShowcaseAccount(SHOWCASE_ACCOUNT_PASSWORD)`.
- **Agendador** (`app.module.ts` + `bootstrap/maintenance.scheduler.ts`): tarefas `interval` `ensure-demo-user`, `refresh-demo-dataset` e `purge-expired-sessions`, e a tarefa `daily` `purge-showcase-data` às 03:00. O agendador roda as tarefas diárias **também no `start()`** (recuperação), o que é seguro hoje só porque `PurgeShowcaseData` apaga apenas o que foi criado antes do último 03:00. `PurgeShowcaseData` é instanciado com `new` dentro da factory de `MAINTENANCE_TASKS`, e `FinanceModule` exporta o **token de infraestrutura** `SHOWCASE_DATA_PURGER`, não o use case.
- **Login** (`login-with-password.ts`): `EmailAddress.create(rawEmail)` e chave do limitador `rawEmail.trim().toLowerCase()` (normalização duplicada). A isenção do limite por identificador vale para `user.kind === 'SHOWCASE'`. Formato inválido cai em `INVALID_CREDENTIALS` (D13). O corpo HTTP é `{ email, password }` (strict).
- **`DEMO` no identity:** `UserKind` inclui `'DEMO'`, `User.restore` valida a invariante do DEMO, `SessionPrincipalRecord.kind` inclui `'DEMO'`, CHECK `users_demo_chk`. `AccountCapabilities` e `AuthenticationEligibility` já tratam DEMO como "não autentica".
- **`EntryRepository.deleteAllOf(ownerId)`** (domínio) não tem uso em produção: só os fakes e um teste de integração o chamam (o store usa `tx.entry.deleteMany` direto).
- **Triggers** `entries_card_same_owner_trg`, `cards_owner_immutable_trg` e `entries_owner_immutable_trg` são só `BEFORE INSERT/UPDATE`: não interferem em `DELETE`.
- **Web:** `decideRoute` manda `/` sem cookie para `/demo/entries`; `app/page.tsx` repete a regra; `logoutAction` redireciona para `/demo/entries`; `AppMode { kind, basePath, readOnly }` com `PROTECTED_MODE`/`DEMO_MODE`, `createFinanceReader('protected' | 'demo')`, `WriteOnly`, `DemoBanner`, `DemoChip`, `SignInButton`/`signInHref`, `basePath: "" | "/demo"` em `entriesHref`, `initialMonthHref`, `fallbackMonthHref`. O login usa `TextField type="email"`, rótulo "E-mail", mensagem `REQUIRED` "Informe o e-mail.". `SUPPORT_EMAIL` já é lida por requisição no servidor (precedente para T2).
- **Mobile:** o login só valida presença (`mobile/app/(auth)/login.tsx`) e envia `{ email, password }`, então o alias funciona no app publicado sem nova versão. `DEMO_CLEANUP_TEXT` diz "Os dados desta conta de demonstração são apagados todos os dias às 03:00 (horário de Brasília).".

---

## 2. Bounded contexts e linguagem ubíqua

### 2.1 Contextos

- **Identidade e acesso** (`identity`): dono do conceito **conta demo** (`ShowcaseAccount`, `kind = SHOWCASE`) e do **alias de login**. Ganha o VO `LoginIdentifier` e a consulta `GetShowcaseAccountState`. Perde o tipo `DEMO` (usuário da demonstração pública).
- **Finanças pessoais** (`finance`): continua **sem conhecer** a conta demo. Ganha a operação neutra **redefinir os dados de um dono** (`ResetOwnerData`), opcionalmente para o **dataset de exemplo**. Perde a demonstração pública (controller, nomes "demo").
- **Raiz de composição** (`api/src/bootstrap`, `app.module.ts`): único lugar que conhece os dois contextos. Hospeda a **rotina da conta demo** (`DemoAccountResetRoutine`), um process manager fino que consulta o identity e chama o finance, o agendamento e o script manual. Mesmo papel que já exerce hoje para `purge-showcase-data`.
- Relação identity/finance: inalterada (Published Language mínima, só o id do dono atravessa).

### 2.2 Linguagem ubíqua

| Negócio (spec) | Código | Observação |
|---|---|---|
| Demonstração pública | (removido) | `DemoController`, `/api/demo/*`, `/demo/*` |
| Usuário da demonstração pública | (removido) | `DEMO_USER_ID` só sobrevive como literal na migration de exclusão |
| Conta demo | `ShowcaseAccount`, `UserKind = 'SHOWCASE'`, `SHOWCASE_USER_ID` | inalterado |
| Conta demo habilitada | `ShowcaseAccountState = 'active'` | `GetShowcaseAccountState` |
| Identificador de login | `LoginIdentifier` (VO, identity/domain) | e-mail ou alias |
| Alias `demo` | `ShowcaseAccount.loginAlias = 'demo'` | resolvido para `ShowcaseAccount.email` |
| Dataset de exemplo (conjunto base) | `SampleDataset`, `buildSampleDataset`, `SAMPLE_DATASET_VERSION` | renomeia `buildDemoDataset`/`DEMO_TEMPLATE_VERSION` |
| Estado inicial da conta demo | dataset de exemplo ancorado no mês corrente | B2 |
| Redefinir os dados de um dono | `ResetOwnerData` (finance, use case) | substitui `PurgeShowcaseData` e `RefreshDemoDataset` |
| Condição de redefinição | `ResetCondition` (`always`, `not-reset-since`, `sample-stale`) | avaliada sob lock |
| Última redefinição | `owner_data_resets.last_reset_at` | base da recuperação (T9) |
| Rotina de exclusão da conta demo | `DemoAccountResetRoutine` (bootstrap) | agendada, recuperação e manual |
| Origem da execução | `ResetOrigin = 'scheduled' \| 'catch-up' \| 'manual'` | log RF19 |
| Execução manual | `npm run demo:reset` -> `bootstrap/scripts/reset-demo-account.ts` | sem HTTP |
| Dica da conta demo | `DemoAccountHint` (web, componente), `isDemoHintEnabled()` (web, server-only) | B4, T2 |

Some do vocabulário: `DemoDataset`, `DemoDatasetStore`, `RefreshDemoDataset`, `ShowcaseDataPurger`, `PurgeShowcaseData`, `EnsureDemoUser`, `User.demo`, `AppMode`, `DEMO_MODE`, `basePath`, `WriteOnly`.

---

## 3. Modelo de domínio

### 3.1 identity: `LoginIdentifier` (VO novo) e `ShowcaseAccount` (alterado) - B1, T3

```ts
// identity/domain/user/showcase-account.ts
export const ShowcaseAccount = {
  id: SHOWCASE_USER_ID,
  email: 'demo@showcase.invalid',
  name: 'Conta de demonstração',
  loginAlias: 'demo',                       // NOVO (B1). Nunca persistido.
} as const;

// identity/domain/user/value-objects/login-identifier.ts  (puro: sem Nest, Prisma, crypto)
export class LoginIdentifier {
  /**
   * trim + toLowerCase (mesma normalização de EmailAddress).
   * - igual a ShowcaseAccount.loginAlias -> email = ShowcaseAccount.email, viaAlias = true;
   * - senão -> EmailAddress.create(raw); erro de formato -> 'INVALID_FORMAT'.
   * Qualquer outro texto sem '@' ('admin', 'demo2') continua inválido.
   */
  static parse(raw: string): Result<LoginIdentifier, 'REQUIRED' | 'INVALID_FORMAT' | 'TOO_LONG'>;
  readonly email: EmailAddress;            // sempre o e-mail canônico
  readonly viaAlias: boolean;              // só para auditoria (nunca muda a resposta)
}
```

Invariantes:
1. O alias resolve **só** para o e-mail canônico da conta demo; o VO não consulta repositório nem estado da conta (a conta inativa ou inexistente cai em `INVALID_CREDENTIALS` no fluxo normal, RF11).
2. `LoginIdentifier` é usado **só** pelo `LoginWithPassword`. Criação e edição de usuário continuam com `EmailAddress` e `parseNewUser` (o alias nunca vira e-mail de outra conta; `.invalid` já é recusado ali).
3. Teste de arquitetura: `loginAlias` só é lido em `login-identifier.ts`.

### 3.2 identity: remoção do tipo `DEMO` (T4)

- `UserKind = 'REGULAR' | 'PENDING_FIRST_ADMIN' | 'SHOWCASE'` (sai `'DEMO'`). Idem `SessionPrincipalRecord.kind`.
- Saem `User.demo()`, a invariante 2 do ADR 0005 §3.2 em `User.restore` e `DEMO_USER_ID` de `shared/domain/well-known-ids.ts`.
- `UserMapper.toDomain`: a coluna continua podendo valer `DEMO` no tipo gerado pelo Prisma (o valor do enum fica no banco). O mapper converte por uma função `toUserKind(row.kind)` que lança `InvariantViolationError('kind DEMO não é mais suportado')`; na prática é inalcançável por causa do novo CHECK (7.2).
- `AccountCapabilities` e `AuthenticationEligibility`: sem mudança de comportamento; só os testes que citam `DEMO` saem.

### 3.3 identity: capacidades (B3)

Sem mudança. `SHOWCASE` mantém só `MANAGE_EXPENSES`.

### 3.4 finance: dataset de exemplo (B2, T5)

Não há aggregate novo. O dataset é um **modelo de aplicação** que cria aggregates existentes (`Card.create`, `Entry.create`, `entry.markAsPaid`) e herda as invariantes deles. Fica em application porque depende do port `IdGenerator`.

```ts
// finance/application/sample-dataset/sample-dataset.ts   (renomeia demo/demo-dataset.ts; conteúdo idêntico)
export const SAMPLE_DATASET_VERSION = 1;
export interface SampleDataset { cards: Card[]; entries: Entry[] }
export function buildSampleDataset(ctx: { ownerId: OwnerId; anchor: YearMonth; ids: IdGenerator; now: Date }): SampleDataset;
```

`SAMPLE_DATASET_VERSION` continua `1`: o conteúdo não muda, e o controle é por dono (a conta demo ainda não tem registro, 7.1).

### 3.5 Domain events

Nenhum evento novo. A redefinição é operação de manutenção em massa, sem consumidor; a observabilidade é log (RF19). `UserSessionsRevoked` não ganha motivo novo (B5: sem revogação).

---

## 4. Interfaces de repositório (domain)

- **identity:** `UserRepository` e `SessionRepository` inalterados. `findByEmail` recebe o e-mail canônico vindo do `LoginIdentifier`.
- **finance:** `EntryRepository.deleteAllOf(ownerId)` **sai** (sem uso em produção; operação de manutenção em massa não pertence ao repositório do aggregate, ISP). Saem também as implementações nos fakes e o caso em `owner-isolation.int-spec.ts`. `CardRepository` inalterado.

A operação de redefinição é um **port de application** (como o `DemoDatasetStore` atual), não um repositório de domínio: não carrega aggregates, apaga e insere em massa.

---

## 5. Application: ports e use cases

### 5.1 Port novo do finance (substitui `DemoDatasetStore` e `ShowcaseDataPurger`)

```ts
// finance/application/ports/owner-data-reset-store.ts
export type ResetCondition =
  | { kind: 'always' }                         // execução manual
  | { kind: 'not-reset-since'; since: Date }   // agendada e recuperação: só se last_reset_at < since (ou nunca)
  | { kind: 'sample-stale' };                  // seed: sem registro, ou âncora/versão diferentes das pedidas

export interface SampleRequest {
  anchor: YearMonth;
  version: number;
  build: () => SampleDataset;                  // chamado dentro da transação, ANTES dos DELETE
}

export interface OwnerDataResetRequest {
  sample: SampleRequest | null;               // null = só apagar (conta inativa, P13)
  condition: ResetCondition;
  at: Date;                                    // vira last_reset_at (vem do Clock, nunca new Date() no adapter)
}

export type OwnerDataResetOutcome =
  | { status: 'skipped' }
  | {
      status: 'reset';
      deleted: { entries: number; cards: number };
      restored: { entries: number; cards: number };
    };

export interface OwnerDataResetStore {
  /**
   * Numa transação, sob pg_advisory_xact_lock(hashtext('owner-data-reset:' || ownerId)):
   * 1. lê owner_data_resets do dono e avalia `condition`; falsa -> 'skipped' sem tocar em nada;
   * 2. dataset = sample?.build();
   * 3. DELETE entries WHERE user_id = owner; DELETE cards WHERE user_id = owner (nessa ordem, FKs RESTRICT);
   * 4. INSERT do dataset (cartões antes dos lançamentos);
   * 5. UPSERT owner_data_resets (anchor_month, template_version = sample ? ... : NULL, last_reset_at = at).
   * Qualquer erro -> rollback completo (nada apagado, nada parcial, last_reset_at intacto).
   * 'sample-stale' exige sample != null (senão InvariantViolationError).
   */
  reset(ownerId: OwnerId, request: OwnerDataResetRequest): Promise<OwnerDataResetOutcome>;
}
export const OWNER_DATA_RESET_STORE = Symbol('OWNER_DATA_RESET_STORE');
```

Por que um único método com condição: a decisão "rodar ou não" precisa ser avaliada **sob o mesmo lock** que a escrita, senão duas execuções (agendada + manual, duas réplicas, seed + recuperação) leem o mesmo `last_reset_at` e as duas rodam. Com a condição dentro da transação, RF18 vale por construção.

### 5.2 Ports compartilhados usados

`Clock`, `IdGenerator`, `BusinessCalendar` (mês corrente em São Paulo, RNF06), `DailyTimeCalculator` (último/próximo 03:00 de São Paulo). Nenhum port compartilhado novo.

### 5.3 Use cases do identity

| Use case | Input | Output | Mudança |
|---|---|---|---|
| `LoginWithPassword` (alterado) | `{ email: unknown; password: unknown; clientIp; client? }` (nome do campo inalterado) | `AuthResult` (inalterado) | 400 só de presença/tipo (D13, inalterado) > `LoginIdentifier.parse(rawEmail)`; erro -> usuário nulo (cai em 401 após a verificação fictícia) > chave do limite por identificador = `identifier.email.value` (canônica: `demo` e `demo@showcase.invalid` são a mesma chave; com formato inválido, o texto normalizado) > `findByEmail(identifier.email)` > isenção do limite por identificador para `kind = SHOWCASE` (inalterada, ADR 0011 §3.4) > `hasher.verify` sempre (RNF05) > 401 `INVALID_CREDENTIALS` genérico para conta inativa, inexistente ou senha errada. Auditoria: `loginFailed.email` passa a ser o e-mail canônico; `viaAlias` não é registrado (não muda nada para a segurança e evita mais um campo). Limite por IP inalterado. |
| `GetShowcaseAccountState` (novo, `bootstrap/`) | `{}` | `{ state: 'active' \| 'inactive' \| 'absent' }` | `users.findById(ShowcaseAccount.id)`; `kind !== 'SHOWCASE'` -> `absent`. Sem I/O além disso. Usado pelo seed e pela rotina. |
| `EnsureDemoUser` | - | - | **Removido.** |
| `EnsureShowcaseAccount` | inalterado | inalterado | Sem mudança (continua o dono da senha e do interruptor). |

### 5.4 Use cases do finance

| Use case | Input | Output | Fluxo |
|---|---|---|---|
| `ResetOwnerData` (novo, `finance/application/use-cases/maintenance/reset-owner-data.ts`; substitui `PurgeShowcaseData` e `RefreshDemoDataset`) | `{ ownerId: string; withSample: boolean; condition: ResetCondition }` | `ResetOwnerDataResult = { status: 'skipped' } \| { status: 'reset'; deleted: { entries; cards }; restored: { entries; cards }; anchor: string \| null }` | `OwnerId.create` (falha -> `InvariantViolationError`, o valor vem da raiz de composição). `now = clock.now()`; `anchor = calendar.currentMonth()`. `sample = withSample ? { anchor, version: SAMPLE_DATASET_VERSION, build: () => buildSampleDataset({ ownerId, anchor, ids, now }) } : null`. `store.reset(ownerId, { sample, condition, at: now })`. `anchor` no resultado só se `withSample`. Não conhece "conta demo". |
| `PurgeShowcaseData`, `RefreshDemoDataset` | - | - | **Removidos** (com `ShowcaseDataPurger`, `DemoDatasetStore` e os adapters). |

`FinanceModule` passa a exportar **o use case** `ResetOwnerData` (provider por factory, como os demais), e não mais tokens de infraestrutura.

### 5.5 Rotina da conta demo (raiz de composição) - RF15-RF19, B5, T9

```ts
// api/src/bootstrap/demo-account/demo-account-reset.routine.ts
export type ResetOrigin = 'scheduled' | 'catch-up' | 'manual';

/** Interfaces estreitas (DIP): implementadas pelos use cases reais; fakes nos testes. */
export interface ShowcaseAccountStateQuery { execute(input: {}): Promise<{ state: 'active' | 'inactive' | 'absent' }> }
export interface OwnerDataResetter { execute(input: ResetOwnerDataInput): Promise<ResetOwnerDataResult> }

export interface DemoAccountResetReport {
  origin: ResetOrigin;
  startedAt: Date; finishedAt: Date;
  accountState: 'active' | 'inactive' | 'absent';
  outcome: 'reset' | 'skipped' | 'failed';
  deleted: { entries: number; cards: number };
  restored: { entries: number; cards: number };
  revokedSessions: 0;                       // B5 (i): sempre 0, mantido no relatório por RF17/RF19
}

export class DemoAccountResetRoutine {
  constructor(
    accountState: ShowcaseAccountStateQuery,
    resetter: OwnerDataResetter,
    clock: Clock,
    dailyTime: DailyTimeCalculator,
    resetAt: LocalTimeOfDay,                 // 03:00, constante de código (B5)
    ownerId: string,                         // SHOWCASE_USER_ID
    log: (report: DemoAccountResetReport) => void,  // sem dados sensíveis
  );
  /** Nunca devolve conteúdo de lançamentos. Lança de novo após registrar 'failed' (o agendador e o script tratam). */
  run(origin: ResetOrigin): Promise<DemoAccountResetReport>;
}
```

Regras:

1. `state = absent` -> `outcome = skipped`, nada é chamado (não há dono para apagar; FK impediria dados órfãos).
2. `withSample = (state === 'active')`. Conta inativa só apaga (P13, CA28).
3. Condição por origem:
   - `manual` -> `{ kind: 'always' }` (RF17, CA25);
   - `scheduled` e `catch-up` -> `{ kind: 'not-reset-since', since: dailyTime.lastOccurrence(now, resetAt) }`. Às 03:00 o `since` é o próprio instante e a última redefinição é de ontem: roda. Na subida às 15:00 com redefinição às 03:00 de hoje: `skipped` (R7). Na subida às 04:00 depois de perder as 03:00: roda (CA27). Duas réplicas às 03:00: a segunda vê `last_reset_at = 03:00` e pula.
4. Sessões: não são tocadas (B5 i, P22).
5. Log de cada execução (RF19): `origin`, início, fim, `accountState`, `outcome`, contagens. Falha: `outcome = failed` com `error.name`/`code`, sem mensagem de banco crua se ela puder conter valores (registrar só o código Prisma/SQLSTATE).

Por que na raiz de composição e não num use case de um dos contextos: a regra "restaura só se a conta estiver ativa" cruza identity (estado da conta) e finance (dados). Um port do finance para perguntar o estado da conta faria o finance conhecer o conceito de conta demo (RNF01). A classe é pequena, sem framework (só recebe funções e interfaces) e testável com fakes.

### 5.6 Agendamento (T9)

- Mantém o `MaintenanceScheduler` próprio. `@nestjs/schedule` e cron externo descartados (13).
- `MaintenanceTask.run` ganha o gatilho, só para a origem do log:

```ts
// bootstrap/maintenance-task.ts
export type MaintenanceTrigger = 'interval' | 'daily-timer' | 'startup';
export interface MaintenanceTask {
  readonly name: string;
  readonly schedule: MaintenanceSchedule;
  /**
   * Contrato das tarefas `daily`: precisam ser seguras para rodar no `start()` (recuperação) e repetidas;
   * a decisão de pular é da tarefa, não do agendador.
   */
  run(trigger: MaintenanceTrigger): Promise<void | string>;
}
```

- `app.module.ts`: saem `ensure-demo-user` e `refresh-demo-dataset` (RF04). A tarefa `purge-showcase-data` vira **`reset-demo-account`** (`daily`, 03:00), que chama `routine.run(trigger === 'startup' ? 'catch-up' : 'scheduled')`. Fica `purge-expired-sessions`.
- O agendador continua rodando as tarefas diárias no `start()`; a segurança agora vem da condição `not-reset-since` (e não mais do corte por `created_at`).
- Timer que dispare um pouco antes das 03:00 (deriva): `lastOccurrence` devolve o 03:00 de ontem, a condição dá `skipped`, e o reagendamento a partir do novo `now` dispara de novo em milissegundos. Autocorretivo; coberto por teste com relógio falso.
- Falha às 03:00: `last_reset_at` não é gravado (rollback), então a próxima subida ou o próximo 03:00 tenta de novo (CA21). O operador pode rodar o script manual.
- `MAINTENANCE_INTERVAL_MS = 0` continua desligando tudo (e2e).
- A rotina é montada como provider `DemoAccountResetRoutine` (factory no `AppModule`) e reaproveitada pela tarefa e pelo script.

### 5.7 Execução manual (RF17, T9)

- `api/src/bootstrap/scripts/reset-demo-account.ts`, no padrão do `recover-admin.ts`: `NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })`, **sem** `start()` do agendador, `context.get(DemoAccountResetRoutine).run('manual')`.
- Saída: uma linha legível e um JSON com `origin`, `accountState`, `outcome`, `deleted`, `restored`, `revokedSessions`. Código de saída `0` em `reset`/`skipped` (conta ausente), `1` em falha (mensagem reduzida a `code: message` de `AppError` ou texto fixo, como no `recover-admin`).
- `package.json`: `"demo:reset": "node dist/bootstrap/scripts/reset-demo-account.js"`. Uso: `docker exec <api> npm run demo:reset`. Sem argumentos e sem segredos.
- Nenhuma rota HTTP (CA25).

### 5.8 Seed (B2, RF04, RF14)

`run-seed.ts` passa a ser:
1. `EnsureShowcaseAccount({ password: env.showcaseAccountPassword })` (inalterado).
2. `GetShowcaseAccountState()`; se `active`: `ResetOwnerData({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: { kind: 'sample-stale' } })`. Inativa ou ausente: nada (desligar a conta não apaga dados, RF14).
3. Log: `seed: conta de demonstração: <status>; dataset de exemplo: <restaurado|em dia|não aplicado>`.

Saem `EnsureDemoUser` e `RefreshDemoDataset(DEMO_USER_ID)`. Como o seed grava `last_reset_at`, a recuperação no `start()` logo em seguida dá `skipped`.

---

## 6. Contratos HTTP

### 6.1 Removidos (RF01)

Todos passam a responder **404 `{ code: "ROUTE_NOT_FOUND", message, details }`** pelo filtro existente, com ou sem Bearer:

| Método e rota removida |
|---|
| `GET /api/demo/entries/initial-month` |
| `GET /api/demo/entries/expenses` |
| `GET /api/demo/entries/incomes` |
| `GET /api/demo/categories` |
| `GET /api/demo/cards` |
| `GET /api/demo/invoices` |
| `GET /api/demo/cards/:cardId/invoices/:referenceMonth/entries` |
| `GET /api/demo/summary` |
| `GET /api/demo/dashboard/monthly-series` |
| `GET /api/demo/dashboard/category-distribution` |

`FinanceReadHandlers` fica (usado pelos controllers protegidos); sai só o comentário sobre `DEMO_USER_ID`. O comentário de `@Public()` deixa de citar a demo.

### 6.2 Alterado

| # | Rota | Mudança | Corpo | Respostas |
|---|---|---|---|---|
| A1 | `POST /api/auth/login` | O campo `email` passa a aceitar **o e-mail ou o alias `demo`** (case-insensitive, trim). O nome do campo **não muda** (compatibilidade com o app publicado, RNF04). | `{ email: string, password: string }` (strict, inalterado) | Inalteradas: 200 `AuthResponse`; 400 `VALIDATION_ERROR` só `REQUIRED`/tipo; 401 `INVALID_CREDENTIALS` (inclusive `admin`, `ana`, `demo2`, conta demo inativa); 429 `TOO_MANY_ATTEMPTS`; 426/400 de `X-Client` como no ADR 0011. Com o alias, `user.email` na resposta é `demo@showcase.invalid`. |

### 6.3 Novos

Nenhum. Nenhuma rota pública nova (RNF05); a rotina não tem rota (CA25).

### 6.4 Documentação

`docs/api/finance.md`: sai a seção da demonstração pública. `docs/api/identity.md`: A1 documenta o alias e a chave do limite por identificador. `api/.env.example`: `SHOWCASE_ACCOUNT_PASSWORD` comenta que precisa valer `demo` onde a dica do web estiver ligada (P03, R4). README/runbook: `npm run demo:reset`.

---

## 7. Persistência: schema Prisma e migrations

### 7.1 Schema

```prisma
enum UserKind {
  REGULAR
  /// Legado da demonstração pública (ADR 0013). O valor não é removível do tipo do PostgreSQL; proibido por users_kind_not_demo_chk.
  DEMO
  PENDING_FIRST_ADMIN
  SHOWCASE
  @@map("user_kind")
}

model User {
  // ... campos atuais
  dataReset OwnerDataReset?          // back-relation exigida pelo Prisma
}

/// Controle da redefinição de dados por dono (ADR 0013). Substitui demo_datasets.
model OwnerDataReset {
  ownerId         String    @id @map("owner_id") @db.Uuid
  owner           User      @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Restrict)
  anchorMonth     DateTime? @map("anchor_month") @db.Date      // null = sem dataset de exemplo
  templateVersion Int?      @map("template_version")
  lastResetAt     DateTime  @map("last_reset_at") @db.Timestamptz(3)
  @@map("owner_data_resets")
}
```

Sai o model `DemoDataset`. `Card` e `Entry` inalterados.

### 7.2 Migrations (T1)

**M1 - `20261114000001_remove_public_demo_user`** (SQL manual, só dados e um CHECK; resolve RF05/CA03/CA04):

```sql
-- ADR 0013 / RF05: exclusão única e definitiva do usuário da demonstração pública e dos dados dele.
-- Idempotente: todos os comandos filtram pelo id literal; num banco sem esse usuário não alteram nada.
-- Rollback: forward-fix (dados regeráveis, sem valor de negócio). Backup antes do deploy (P05).
DO $$
DECLARE s int; e int; c int; d int; u int;
BEGIN
  DELETE FROM "sessions"      WHERE "user_id"  = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS s = ROW_COUNT;
  DELETE FROM "entries"       WHERE "user_id"  = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS e = ROW_COUNT;
  DELETE FROM "cards"         WHERE "user_id"  = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS c = ROW_COUNT;
  DELETE FROM "demo_datasets" WHERE "owner_id" = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS d = ROW_COUNT;
  DELETE FROM "users"         WHERE "id"       = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS u = ROW_COUNT;
  RAISE NOTICE 'demo publica removida: sessoes=%, lancamentos=%, cartoes=%, demo_datasets=%, usuarios=%', s, e, c, d, u;
END $$;

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_demo_chk";
ALTER TABLE "users" ADD CONSTRAINT "users_kind_not_demo_chk" CHECK ("kind" <> 'DEMO');
```

- Ordem respeita as FKs `RESTRICT` (lançamentos, depois cartões, depois usuário; sessões são `CASCADE`, apagadas explicitamente para a contagem).
- Se existisse outro usuário `DEMO` (não deveria: só `User.demo()` criava, sempre com o id fixo), o `ADD CONSTRAINT` falha e o deploy para com erro visível, sem apagar nada (a migration é transacional, mesma premissa do ADR 0011 §7.2).
- Roda em todo ambiente, uma vez, pelo `prisma migrate deploy` que o `CMD` da imagem já executa; não depende de env.

**M2 - `20261114000002_owner_data_resets`** (SQL manual, porque o Prisma geraria DROP/CREATE para o rename):

```sql
-- ADR 0013 / T5, T9. Rollback (forward-fix): reverter renomes e NOT NULL; dados são regeráveis pelo seed.
ALTER TABLE "demo_datasets" RENAME TO "owner_data_resets";
ALTER TABLE "owner_data_resets" RENAME CONSTRAINT "demo_datasets_pkey" TO "owner_data_resets_pkey";
ALTER TABLE "owner_data_resets" RENAME COLUMN "refreshed_at" TO "last_reset_at";
ALTER TABLE "owner_data_resets" ALTER COLUMN "anchor_month" DROP NOT NULL;
ALTER TABLE "owner_data_resets" ALTER COLUMN "template_version" DROP NOT NULL;
ALTER TABLE "owner_data_resets" ADD CONSTRAINT "owner_data_resets_sample_chk"
  CHECK (("anchor_month" IS NULL) = ("template_version" IS NULL));
DELETE FROM "owner_data_resets" r WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."owner_id");
ALTER TABLE "owner_data_resets" ADD CONSTRAINT "owner_data_resets_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
```

- Depois de M1 a tabela fica vazia na prática (só o `DEMO_USER_ID` tinha linha); o `DELETE` de órfãos protege ambientes de teste.
- Verificação na implementação: `prisma migrate diff --from-migrations --to-schema-datamodel` vazio (o schema e o SQL manual batem).
- Mapper: o adapter Prisma traduz a linha para o tipo interno de condição; não há entidade de domínio para ela (é estado de infraestrutura de um port de application).

### 7.3 Ordem no deploy

1. `prisma migrate deploy` (M1, M2).
2. `prisma db seed`: `EnsureShowcaseAccount` -> estado -> `ResetOwnerData(sample-stale)`. **No primeiro deploy, a conta demo é redefinida uma vez** (perde os dados de visitantes daquele dia e ganha o dataset de exemplo).
3. `node dist/main.js`: `start()` do agendador; a recuperação dá `skipped` (o seed acabou de gravar `last_reset_at`).

Deploy da API **antes** do web. Na janela entre os dois, o web antigo chama `/api/demo/*` e recebe 404 (página de erro em `/demo/*` por alguns minutos). Na ordem inversa, o web novo mostraria a dica com o alias ainda recusado pela API antiga. Durante a troca do container, o processo antigo pode registrar erro ao tentar recriar o usuário DEMO (barrado pelo novo CHECK) ou ao ler `demo_datasets` (renomeada); só log, sem efeito em dados.

---

## 8. Infraestrutura (adapters) e deploy

| Port | Adapter | Notas |
|---|---|---|
| `OwnerDataResetStore` | `PrismaOwnerDataResetStore` (`finance/infrastructure/maintenance/`), substitui `PrismaDemoDatasetStore` e `PrismaShowcaseDataPurger` | `$transaction` interativa (`timeout: 30_000`, `maxWait: 5_000`); lock `pg_advisory_xact_lock(hashtext('owner-data-reset:' || owner))`; `DELETE` por `user_id` literal com `$executeRaw` (contagens); `createMany` via `CardMapper`/`EntryMapper`; `upsert` em `owner_data_resets` com `at` recebido (sem `new Date()`). |
| `UserRepository` | `PrismaUserRepository` + `UserMapper` | `toUserKind` rejeita `DEMO`. |
| `SessionPrincipalLookup` | `PrismaSessionPrincipalLookup` | tipo do `kind` sem `DEMO`. |

Registro: `FINANCE_INFRASTRUCTURE_PROVIDERS` troca `DEMO_DATASET_STORE` e `SHOWCASE_DATA_PURGER` por `OWNER_DATA_RESET_STORE`. Prisma continua só em `infrastructure`.

**nginx (T7):** o N4 do ADR 0011 passa a exigir **só** `location ^~ /api/admin/ { return 404; }` no host público. A regra de `/api/demo/` deixa de ser requisito: a rota não existe e a API já responde 404 `ROUTE_NOT_FOUND`. Pode ficar na configuração sem prejuízo, mas sai do checklist e do `.env.example`. `web/test/deploy-api-not-exposed.spec.ts` deixa de exigir a menção a `/api/demo/` e passa a verificar que nenhum código do web referencia `/demo` (rotas ou `/api/demo`).

**Variáveis:** API inalterada (`SHOWCASE_ACCOUNT_PASSWORD=demo` onde a dica estiver ligada). Web ganha `DEMO_ACCOUNT_HINT` (9.3).

---

## 9. Impacto no Next.js (`web/`)

### 9.1 Rotas e páginas

| Item | Mudança |
|---|---|
| `lib/auth/route-policy.ts` | `/` sem cookie -> `/login` (sem `next`); com cookie -> `/entries` (RF06). Nada mais muda: protegidas sem cookie -> `/login?next=...` (RF07); `/demo/*` segue para o 404 global (P04). |
| `app/page.tsx` | fallback igual: `/entries` ou `/login`. |
| `app/(public)/demo/*` | **Removido** (`layout`, `actions.ts` com `loadDemoInvoiceEntries`, `entries`, `dashboard`, `cards`). |
| `app/(auth)/login/page.tsx` | sai o link "Ver demonstração"; fica "Não tem acesso ou esqueceu a senha? Fale com um administrador."; entra `<DemoAccountHint />` (9.3). |
| `app/(auth)/login/login-form.tsx` | primeiro campo: rótulo definido pelo ui-designer (ex.: "E-mail ou usuário"), `type="text"`, `autoComplete="username"`, `autoCapitalize="none"`, `spellCheck={false}`, sem `inputMode="email"`. O `name` continua `email` (contrato da Server Action e da API). Mensagem `REQUIRED` do campo ajustada pelo ui-designer em `lib/auth/field-messages.ts`. "E-mail ou senha inválidos." mantido (CA14). |
| `app/(public)/privacy/page.tsx` | texto da conta demo: "volta aos dados de exemplo todos os dias às 03:00" (P08, texto final do ui-designer). |

### 9.2 Server Actions

| Action | Mudança |
|---|---|
| `loginAction` | sem mudança de código (repassa o campo como está; a API resolve o alias). |
| `logoutAction` | `redirect('/login')` no lugar de `/demo/entries`. |
| `loadDemoInvoiceEntries` | **removida**. |
| Demais | sem mudança. |

### 9.3 Como o web decide mostrar a dica (T2, B4)

- Variável **server-only** `DEMO_ACCOUNT_HINT` (`"on"` liga; ausente ou outro valor desliga), lida **por requisição** como `SUPPORT_EMAIL`. Função pura e testável em `web/lib/auth/demo-hint.ts`:

```ts
// import "server-only"
export interface DemoHint { username: 'demo'; password: 'demo' }
export function demoHintFrom(env: { DEMO_ACCOUNT_HINT?: string }): DemoHint | null;
export function isDemoHintEnabled(): DemoHint | null;   // lê process.env
```

- `DemoAccountHint` (server component) renderiza o texto de RF10 ("Para testar, use o usuário **demo** e a senha **demo**.", mais a linha sobre conta compartilhada e restauração diária, com texto final do ui-designer) só se a função devolver valor. É texto comum, na ordem natural do documento, depois do formulário, sem foco programático (RF10, CA16). Aparece também com banner de erro ou sessão expirada.
- O texto da credencial é constante de código (P03), não vem da env: a senha nunca precisa estar no ambiente do web.
- Contrato operacional (R4): `DEMO_ACCOUNT_HINT=on` só onde a API tiver `SHOWCASE_ACCOUNT_PASSWORD=demo`. Desligar a conta exige mudar as duas variáveis e reiniciar os dois containers. Documentado em `web/.env.example`, `web/README.md` e no checklist de deploy.

### 9.4 Remoção do modo `demo` (T6)

Com a demonstração removida, `AppMode` passa a ter um único valor. A abstração sai inteira, em vez de ficar com um valor só:

- Saem `lib/app-mode.ts`, `components/app-mode.tsx` (`useAppMode`), `components/read-only.tsx` (`WriteOnly`, os filhos passam a renderizar direto), `demo-banner.tsx`, `demo-banner-action.tsx`, `demo-chip.tsx`, `sign-in-button.tsx`, `lib/auth/sign-in-href.ts`, e `buildDemo()` em `lib/api/finance-reader.ts`. `createFinanceReader(kind)` vira `getFinanceReader()`.
- `basePath` sai de `entriesHref`, `initialMonthHref`, `fallbackMonthHref`, `stripAdvanceSignal`, `MainNav`, `AppSidebar`, `NavDrawer`, `AppFooter` e das telas de `features/entries`, `features/dashboard` e `features/cards` (props `mode`). `AppHeader` passa a receber `user: CurrentUserDto` (não nulo).
- `readOnly={pending}` em inputs não tem relação com o modo e fica.
- Controle de escrita futuro: por `me.capabilities` (já usado para editar/excluir), nunca por um "modo de tela".
- Execução em passos pequenos para conter o R9: (1) rotas, reader e redirects; (2) `WriteOnly`, faixa, selo e "Entrar"; (3) `basePath` e `AppMode`. Cada passo com os testes de componente e e2e das telas protegidas verdes.

### 9.5 Stub e e2e

`web/e2e/stub-api/server.mjs`: saem as rotas `/api/demo/*`; o login aceita `demo` (e `Demo`, ` demo `) como alias da conta demo do stub e recusa `admin`/`demo2`. Sai `e2e/demo-shell.pw.ts` e os testes dos componentes removidos.

---

## 10. App mobile

- **Sem mudança de código obrigatória:** o login só valida presença e manda `{ email, password }`, então `demo`/`demo` funciona no app publicado (RNF04, CA30).
- Na próxima versão: `DEMO_CLEANUP_TEXT` -> "Esta conta de demonstração volta aos dados de exemplo todos os dias às 03:00 (horário de Brasília)." (texto final do ui-designer). O texto atual continua verdadeiro o bastante até lá ("apagados" vale para o que o visitante criou).
- `e2e/maestro/demo-account-actions.yaml` passa a esperar a conta com o dataset de exemplo (não vazia). `__tests__/screens/auth.test.tsx` ganha o caso `demo`/`demo` (o caso com o e-mail canônico fica).
- `mobile/README.md` e notas de revisão da App Store: credencial `demo`/`demo` (ou o e-mail canônico), estado inicial com dados de exemplo, restauração às 03:00, e orientação para rodar `npm run demo:reset` antes de enviar (R6).

---

## 11. Plano de testes por camada

### 11.1 Domain (unitário, sem I/O)

- `LoginIdentifier`: `demo`, `Demo`, ` demo ` -> e-mail canônico com `viaAlias`; `demo@showcase.invalid` -> mesmo e-mail, `viaAlias = false`; `ana@exemplo.com` normalizado; `admin`, `ana`, `demo2`, `de mo`, `''` -> erro; e-mail longo -> `TOO_LONG`.
- `User`: sem `User.demo`; `restore` com `kind` fora do union é rejeitado pelo mapper (teste no mapper, 11.3). Saem os testes de DEMO em `user.spec.ts` e `account-capabilities.spec.ts`.
- `buildSampleDataset`: os testes atuais do gerador migram com o rename (2 cartões; meses âncora-11..âncora; fatura do mês seguinte; faturas anteriores pagas; virada de ano com âncora 2026-12 e 2027-01, CA29).

### 11.2 Application (unitário com fakes, relógio falso em São Paulo)

- `LoginWithPassword`: CA12 (alias entra; resposta com o e-mail canônico); CA13; CA14 (identificadores sem `@` -> 401, `recordFailure` com a chave normalizada, verificação fictícia executada); conta demo inativa com `demo`/`demo` -> 401; limite: alias e e-mail canônico contam como a mesma chave e a isenção SHOWCASE vale para os dois; limite por IP inalterado; auditoria com o e-mail canônico.
- `GetShowcaseAccountState`: ativa, inativa, ausente, id ocupado por outro `kind` -> ausente.
- `ResetOwnerData`: `withSample = true` passa âncora = mês corrente de SP (incluindo 2026-12-01 03:00 SP = 06:00 UTC -> 2026-12, CA29) e `SAMPLE_DATASET_VERSION`; `withSample = false` -> `sample = null`; `at = clock.now()`; ownerId inválido -> `InvariantViolationError`; repassa `skipped`.
- `DemoAccountResetRoutine`: ativa -> com dataset; inativa -> sem dataset (CA28); ausente -> nada chamado; `manual` -> `always`; `scheduled`/`catch-up` -> `not-reset-since` com o último 03:00 de SP (casos 03:00, 15:00 do mesmo dia, 04:00 depois de uma janela perdida, CA27); falha -> relatório `failed` registrado e erro relançado (CA21); log sem conteúdo de lançamentos; `revokedSessions = 0` (CA24, B5 i).
- `MaintenanceScheduler`: gatilho `startup` no `start()`, `daily-timer` no disparo; timer adiantado reagenda e roda; `intervalMs = 0` desliga tudo; falha de uma tarefa não bloqueia as outras.
- Seed (composição testada com fakes): conta ativa -> `sample-stale`; inativa ou ausente -> não chama `ResetOwnerData`; nenhuma referência a `EnsureDemoUser`.
- Cobertura mínima de 80% em domain/application mantida.

### 11.3 Infrastructure (integração, Postgres real com testcontainers)

- **M1** (CA03, CA04): banco com `DEMO_USER_ID` (2 cartões, N lançamentos, linha em `demo_datasets`, uma sessão), conta demo com 3 lançamentos e Ana com 10 -> depois da migration não há nada do `d1`, os 3 e os 10 ficam intactos, `users_kind_not_demo_chk` impede inserir `DEMO`. Banco sem `d1` -> roda sem erro e sem alteração. Reexecutar o SQL de M1 -> sem erro.
- **M2:** `owner_data_resets` com FK, CHECK de amostra e `migrate diff` vazio.
- `PrismaOwnerDataResetStore`:
  - `always` com dataset: apaga lançamentos e cartões de visitantes (inclusive um cartão novo com lançamentos), grava exatamente o dataset, contagens corretas (CA18, CA19);
  - `sample = null`: conta vazia (P13, CA28);
  - `not-reset-since`: `skipped` quando `last_reset_at >= since`, roda quando menor ou ausente;
  - `sample-stale`: `skipped` com a mesma âncora e versão, roda com âncora ou versão diferente;
  - tudo ou nada (CA21): `build` que devolve um lançamento inválido para o banco (ex.: `card_id` de outro dono, barrado pelo trigger) -> rollback, dados e `last_reset_at` iguais aos de antes;
  - isolamento (CA23): Ana e o administrador intactos;
  - concorrência (CA26): duas chamadas `always` simultâneas -> exatamente um dataset, sem erro de chave; duas `not-reset-since` simultâneas com o mesmo `since` -> uma `reset` e uma `skipped`;
  - desempenho (RNF03): 10.000 lançamentos de visitantes + restauração em menos de 10 s (teste marcado como lento).
- `UserMapper`: linha com `kind = DEMO` (inserida com o CHECK desligado no teste) -> `InvariantViolationError`.
- Saem `prisma-demo-dataset-store.int-spec.ts` e `prisma-showcase-data-purger.int-spec.ts` (substituídos acima) e o caso `deleteAllOf` de `owner-isolation.int-spec.ts`.

### 11.4 Presentation (e2e, supertest)

- CA01: as 10 rotas `/api/demo/*` (e um caminho qualquer sob `/api/demo/`) -> 404 `ROUTE_NOT_FOUND`, com e sem Bearer. `access-control.e2e-spec.ts`: inventário de rotas públicas atualizado (só `POST /api/auth/login` e `POST /api/auth/logout`, além das que já existirem fora da demo).
- CA02: regressão das rotas protegidas.
- CA12-CA15: login por alias (`demo`, `Demo`, ` demo `), e-mail canônico, `admin`/`ana`/`demo2` -> 401, criação de usuário com senha `demo` -> 400 `TOO_SHORT`.
- CA17: depois do seed com a conta ativa, `GET /api/summary?month=<âncora>` da conta demo com totais iguais aos do gerador.
- CA25: `GET`/`POST` em `/api/maintenance/*`, `/api/admin/demo-reset` e afins -> 404.
- Sai `test/e2e/demo.e2e-spec.ts` e o que for só dele em `test/fakes/demo-fakes.ts`; `test/fakes/maintenance-fakes.ts` adaptado ao novo port.
- Arquitetura (`test/architecture-*.spec.ts`): nenhum arquivo de `src` contém `DEMO_USER_ID`, `DemoController` ou `@Controller('demo')`; `loginAlias` só em `login-identifier.ts`; `finance` não importa `identity`; domain sem Nest/Prisma (regras atuais mantidas).
- Script manual: teste de integração que executa `reset-demo-account` contra o banco do testcontainers e verifica a saída JSON e o código de saída (CA25).

### 11.5 Web

- Unitários: `decideRoute` (`/` sem cookie -> `/login`, com cookie -> `/entries`, `/demo/entries` segue, CA06-CA08); `demoHintFrom` (on, ausente, outro valor); `entriesHref`/`initialMonthHref` sem `basePath`; `logoutAction` -> `/login`; `getFinanceReader` sem leitura de `/api/demo`.
- Componente: `/login` sem "Ver demonstração" e sem nenhum link para `/demo` (CA10); com `DEMO_ACCOUNT_HINT=on` mostra a dica, sem ela não mostra (CA11); a dica aparece junto com o banner de sessão expirada e o de credencial inválida; ordem no DOM depois do formulário e sem `tabIndex` (CA16); novo rótulo e `autoComplete="username"`.
- Regressão das telas protegidas sem `AppMode` (escrita visível, links sem `/demo`).
- `deploy-api-not-exposed.spec.ts`: sem exigência de `/api/demo/` no `.env.example`; nenhum arquivo de `app`, `components`, `features` ou `lib` referencia `/demo`.
- Playwright: `/` sem sessão -> `/login`; `/demo/entries` -> 404 (CA09); login `demo`/`demo` -> `/entries` (CA12, stub); `next` preservado (CA08); checagem de contraste com axe nos dois temas (CA16).

### 11.6 Mobile

Teste de tela do login com `demo`/`demo`; fluxo Maestro ajustado ao dataset; texto de limpeza (quando a nova versão sair).

### 11.7 Matriz CA -> camada

| CA | Camada principal |
|---|---|
| CA01, CA02 | e2e API |
| CA03, CA04 | integração (M1) |
| CA05 | unitário do seed e do agendador + e2e após o seed |
| CA06-CA09 | unitário web + Playwright |
| CA10, CA11, CA16 | componente web + Playwright/axe |
| CA12-CA15 | unitário application + e2e API + Playwright (stub) |
| CA17 | e2e API após o seed |
| CA18, CA19, CA22, CA23 | integração do store + unitário da rotina |
| CA20 | não se aplica (B2 aprovada) |
| CA21, CA26 | integração do store |
| CA24 | unitário da rotina (sem revogação) |
| CA25 | integração do script + e2e (sem rota) |
| CA27 | unitário da rotina e do agendador (relógio falso) |
| CA28 | unitário da rotina + integração (`sample = null`) |
| CA29 | unitário de `ResetOwnerData` e do gerador |
| CA30 | regressão manual do app contra a API nova |

---

## 12. Violações de SOLID e problemas no código atual que afetam a feature

| # | Onde | Problema | Tratamento |
|---|---|---|---|
| S1 | `finance/application/demo/demo-dataset-store.ts` e `ports/showcase-data-purger.ts` | Dois ports com a mesma responsabilidade (apagar os dados de um dono) e regras divergentes (um recria se desatualizado, o outro apaga por corte). SRP e duplicação: a rotina nova precisaria dos dois numa só transação, o que não dá para garantir com dois adapters independentes. | Unificados em `OwnerDataResetStore` (5.1). |
| S2 | `PurgeShowcaseData`, `ShowcaseDataPurger`, `PrismaShowcaseDataPurger` | O nome leva o conceito "conta demo" para dentro do `finance`, contrariando a regra declarada no próprio arquivo ("finance não conhece o conceito de conta de demonstração"). | Nomes neutros (`ResetOwnerData`, `OwnerDataResetStore`). |
| S3 | `PrismaDemoDatasetStore` (`refreshedAt: new Date()`) | O adapter lê o relógio do sistema em vez do port `Clock`. Quebra a DIP e deixa a data impossível de controlar em teste, justamente a que a recuperação passa a usar. | `at` vem do use case (5.1). |
| S4 | `EntryRepository.deleteAllOf` (domínio) | Método de manutenção em massa no repositório do aggregate, sem uso em produção, obrigando todos os fakes a implementá-lo (ISP). | Removido (4). |
| S5 | `app.module.ts` (`MAINTENANCE_TASKS`) e `FinanceModule.exports` | A factory instancia `PurgeShowcaseData` com `new`, e o `FinanceModule` exporta um token de infraestrutura para a raiz montar o use case: a raiz conhece detalhes internos do finance. | `FinanceModule` exporta o use case `ResetOwnerData`; a rotina vira provider próprio (5.5, 5.6). |
| S6 | `MaintenanceScheduler.start()` | Executa as tarefas diárias na subida pressupondo que todas são seguras por causa de um corte que pertence a uma tarefa específica: acoplamento implícito entre o agendador e a semântica da tarefa. Com "apagar tudo e restaurar", a suposição viraria o bug do R7. | Contrato explícito em `MaintenanceTask` (a tarefa decide se pula) e gatilho passado à tarefa (5.6). |
| S7 | `LoginWithPassword` | Normalização do identificador duplicada (`EmailAddress.create` e `rawEmail.trim().toLowerCase()` para a chave do limitador). Com o alias, as duas divergiriam (`demo` e `demo@showcase.invalid` seriam chaves diferentes). | `LoginIdentifier` concentra a normalização; a chave vem dele (3.1, 5.3). |
| S8 | `User`, `UserKind`, `SessionPrincipalRecord`, `UserMapper` | Código morto do tipo `DEMO` depois da remoção, e invariante que nenhum fluxo exerce mais. | Removido do domínio e da aplicação; valor só no enum do banco, barrado por CHECK (3.2, 7.2). |
| S9 | Web: `AppMode`/`basePath`/`readOnly`/`createFinanceReader(kind)` | Variação por modo espalhada por cabeçalho, navegação, telas e helpers de URL (OCP/SRP). Com um único modo, vira abstração sem variação. | Removida (9.4). |
| S10 | `web/app/(auth)/actions.ts` `logoutAction` | Destino fixo `/demo/entries`, que deixaria o logout num 404. | `/login` (9.2). |

Registrado, fora do escopo: a isenção do limitador em `LoginWithPassword` compara `user?.kind !== 'SHOWCASE'` direto no use case. Uma política de domínio (`LoginThrottlePolicy.isExemptFromIdentifierLimit(kind)`) seria mais aberta a extensão. Não muda nesta feature para não ampliar o diff.

---

## 13. Decisões, alternativas descartadas e trade-offs

| Tema | Decisão | Descartadas e motivo |
|---|---|---|
| T1 exclusão única | Migration SQL de dados (M1), idempotente por id literal, com `RAISE NOTICE` das quantidades. | Passo no seed: rodaria a cada subida para sempre e dependeria de código que queremos apagar. Script manual: não roda sozinho em todos os ambientes (RF05). |
| T1 `demo_datasets` | Reaproveitada e renomeada para `owner_data_resets`, com âncora/versão anuláveis, `last_reset_at` e FK. | Tabela nova + drop: mais uma migration sem ganho. Remover e guardar `last_reset_at` em `users`: mistura estado de manutenção do finance no aggregate do identity. |
| T2 dica | Env server-only `DEMO_ACCOUNT_HINT` lida por requisição; texto da credencial no código. | Campo público na API (ex.: `GET /api/auth/login-options`): reflete o estado real da conta, mas cria rota pública nova (contra RNF05). Texto fixo sem interruptor: contra B4. Env com o texto da senha: põe a senha no ambiente do web sem necessidade. Trade-off aceito: duas variáveis que precisam andar juntas (R4). |
| T3 alias | VO `LoginIdentifier` no domínio do identity; constante `loginAlias` em `ShowcaseAccount`; campo HTTP continua `email`. | Resolver o alias no controller ou no schema zod: regra de negócio na apresentação. Renomear o campo para `identifier` (ou aceitar os dois): quebra ou complica o app publicado (RNF04). Gravar o alias como coluna `username`: persiste algo que só existe para uma conta. |
| T3 limite | Chave canônica (e-mail resolvido); isenção da conta SHOWCASE e limite por IP mantidos. | Chave pelo texto digitado: `demo` e o e-mail contariam separados. |
| T4 `DEMO` | Sai do domínio, da aplicação e das constantes; fica no enum do banco com `users_kind_not_demo_chk`. | Recriar o tipo `user_kind` sem `DEMO`: migration arriscada (troca de tipo de coluna com CHECKs dependentes) sem benefício funcional. |
| T5 gerador e store | Renomear para "dataset de exemplo" e unificar os dois stores num port com condição avaliada sob lock; o seed usa `sample-stale` e a rotina usa `always`/`not-reset-since`. | Manter `replaceIfStale` e um `restoreAlways` separados + purger: três caminhos de escrita sobre os mesmos dados, e a condição da recuperação fora do lock. |
| T6 web | Remover `AppMode` inteiro. | Manter com um valor "para o futuro": controle de escrita futuro é por capacidade. Trade-off: diff grande no web, mitigado pelos passos de 9.4. |
| T7 nginx | N4 passa a exigir só `/api/admin/`. A regra de `/api/demo/` é opcional. | Manter como requisito: exige testes e documentação de uma rota que não existe. |
| T8 ADRs | Este ADR substitui o §6.5 do ADR 0005 (e, por consequência, o §5.6 e a parte demo do §7.6, §9.3, §9.5-§9.8) e o §5.4 do ADR 0011 na parte da limpeza; ajusta o ADR 0011 §2.2, §3.3, §3.5 (o `LoginIdentifier` volta, com escopo só no login) e §6.1 N4. O doc-writer acrescenta "Nota de atualização (ADR 0013)" nesses pontos. | Reescrever os ADRs antigos: perde o histórico. |
| T9 agendamento | `MaintenanceScheduler` próprio, tarefa `daily` 03:00, recuperação no `start()` decidida pela condição `not-reset-since` sob advisory lock, script manual no padrão `recover-admin`. | `@nestjs/schedule`: dependência nova sem ganho (não resolve a recuperação nem a concorrência). Cron externo: sai do repositório e do teste. Retentativa por intervalo depois de falha às 03:00: apagaria dados no meio do dia de forma inesperada; fica o script manual. |
| T9 orquestração | Process manager `DemoAccountResetRoutine` na raiz de composição. | Port do finance para consultar a conta: o finance passaria a conhecer o conceito. Use case no identity chamando o finance: inverte a dependência entre contextos. |
| Atomicidade entre contextos | O estado da conta é lido fora da transação do finance. | Transação distribuída: desnecessária, porque o estado só muda pelo seed na subida. Pior caso: um dataset gravado numa conta que acabou de ser inativada, apagado na próxima execução. |

---

## 14. Decisões aprovadas (antes "dependências de decisões em aberto")

As cinco decisões abaixo foram aprovadas pelo usuário e estão incorporadas no desenho. Ficam aqui como referência rápida do que cada uma fixa no código:

| Id | Decisão aprovada | O que fixa neste ADR |
|---|---|---|
| B1 | Alias `demo` aceito pela API no login (web e mobile), resolvido para `demo@showcase.invalid`. | `LoginIdentifier`, `ShowcaseAccount.loginAlias`, A1 documentado, rótulo do campo no web, dica "usuário demo e senha demo", stub com alias, notas do ADR 0011 §3.3/§3.5. |
| B2 | Dataset de exemplo como estado inicial, gravado pelo seed e restaurado a cada execução. | `buildSampleDataset`, `ResetOwnerData` com `withSample`, `owner_data_resets` com âncora/versão, seed com `sample-stale`, textos de `/privacy`, do app e das notas de revisão. |
| B3 | Conta demo com escrita. | `AccountCapabilities` sem mudança. |
| B4 | Dica só com a conta habilitada. | `DEMO_ACCOUNT_HINT` e `DemoAccountHint` (9.3). |
| B5 | Diária às 03:00 SP, sem revogar sessões, script manual. | Tarefa `daily` `reset-demo-account`, `not-reset-since`, `npm run demo:reset`, `revokedSessions = 0`, nenhum use case de revogação novo. |

---

## 15. Riscos que permanecem e consequências

| # | Risco | Mitigação |
|---|---|---|
| R1 | Credencial `demo`/`demo` pública na tela de login: abuso, conteúdo ofensivo visível a outros até as 03:00. | Escopo `USER` sem senha/perfil/administração, restauração diária, script manual, interruptor duplo (env da API + env do web), N8 do nginx recomendado. |
| R2 | Exclusão definitiva errada. | Ids literais, transação, testes de isolamento (CA03, CA23), backup (P05). |
| R4 | `DEMO_ACCOUNT_HINT=on` com `SHOWCASE_ACCOUNT_PASSWORD` diferente de `demo`. | Checklist de deploy e comentários nos dois `.env.example`; teste manual pós-deploy com `demo`/`demo`. |
| R6 | Notas da App Store desatualizadas; primeiro deploy redefine a conta demo uma vez. | Atualizar as notas antes do próximo envio; `npm run demo:reset` antes de enviar. |
| R7 | Recuperação na subida zerando a conta no meio do uso. | Condição `not-reset-since` sob lock (5.5). |
| R8 | Várias réplicas. | Lock por dono + condição: só uma réplica redefine por janela. O limitador em memória continua válido só para uma réplica (dívida já registrada no ADR 0011). |
| R9 | Remoção ampla no web. | Passos de 9.4 com regressão a cada passo. |

Consequências: a superfície pública da API cai de 12 para 2 rotas de autenticação. O `finance` perde o vocabulário "demo"/"showcase". Os dados da conta demo passam a depender de `owner_data_resets.last_reset_at` para a recuperação; apagar essa linha à mão força uma redefinição na próxima subida (comportamento documentado).

---

## 16. Ordem de implementação sugerida

1. **API, remoção:** `DemoController` e o registro dele; e2e CA01/CA02; testes de demo removidos.
2. **DB:** M1 e M2 + testes de integração das migrations.
3. **API, identity:** remoção de `DEMO`/`EnsureDemoUser`/`User.demo`/`DEMO_USER_ID`; `LoginIdentifier` + `LoginWithPassword`; `GetShowcaseAccountState`; unitários e e2e CA12-CA15.
4. **API, finance:** rename para `sample-dataset`; `OwnerDataResetStore` + `PrismaOwnerDataResetStore`; `ResetOwnerData`; remoção de `deleteAllOf`, `PurgeShowcaseData`, `RefreshDemoDataset`, `ShowcaseDataPurger`, `DemoDatasetStore`; unitários e integração.
5. **API, bootstrap:** `DemoAccountResetRoutine`, tarefa `reset-demo-account`, gatilho no agendador, seed, script `demo:reset`; unitários e integração do script.
6. **Web:** passo 1 de 9.4 (rotas, reader, `/` e logout -> `/login`), depois o login (dica, rótulo, `DEMO_ACCOUNT_HINT`), depois os passos 2 e 3 de 9.4; stub, Playwright e `deploy-api-not-exposed.spec.ts`.
7. **Mobile e docs:** textos, Maestro, README e notas de revisão; `docs/api/*`, `.env.example`, runbook; notas de atualização nos ADRs 0005 e 0011; specs afetadas (doc-writer).
8. **Deploy:** API (migrations + seed) e depois o web; teste manual de `demo`/`demo` e de `/api/demo/*` -> 404.

---

## 17. Divergências entre o texto acima e o código final

Registradas pelo doc-writer a partir do código de `review/demo` (nada bloqueante; o código vale):

| # | ADR | Código |
|---|---|---|
| D1 | 5.5: `DemoAccountResetReport.accountState` é `'active' \| 'inactive' \| 'absent'`. | Também admite `'unknown'`, quando a própria consulta do estado falha (o relatório `failed` ainda é registrado e o erro é relançado). `GetShowcaseAccountState` é tipado por `ShowcaseAccountState`, e as interfaces estreitas usam `Record<string, never>` no lugar de `{}`. |
| D2 | 5.5: relatório `failed` com `error.name`/`code`. | Campo `error?: string` com o código (Prisma/SQLSTATE) quando existe; senão o nome do erro (`describeError`). Nunca a mensagem. |
| D3 | 5.7: saída com "uma linha legível". | `Conta demo (<estado>): <resultado>. Apagados: N lançamentos e N cartões; restaurados: ...` seguida de uma linha JSON (`origin`, `accountState`, `outcome`, `deleted`, `restored`, `revokedSessions`). Falha: `code: message` de `AppError` ou "Falha inesperada ao redefinir a conta demo.", com código de saída 1. |
| D4 | 5.8: log do seed `<restaurado\|em dia\|não aplicado>`. | `seed: conta de demonstração: <status>; dataset de exemplo: <restaurado\|em dia\|não aplicado>.` |

Sem outras divergências encontradas em migrations (`20261114000001_remove_public_demo_user`, `20261114000002_owner_data_resets`), alias de login (`LoginIdentifier`), script `demo:reset`, `DEMO_ACCOUNT_HINT` e textos de `/privacy` e do mobile.
