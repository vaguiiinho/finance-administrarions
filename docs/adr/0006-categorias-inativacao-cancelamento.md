# ADR 0006 - Categoria como entidade, inativação de cartão e cancelamento de lançamento

- **Status:** Aprovado (2026-10-29), incluindo T1 e as interpretações de "fatura já paga" por lançamento e 422 `NOT_CANCELED`.
- **Data:** 2026-10-29
- **Spec:** `docs/specs/categorias-inativacao.md` (rev. 2, com B1 decidida)
- **Relacionados:** ADR 0001 (contratos, schema, BFF), ADR 0005 (dono, demo, `FinanceReader`, `AppMode`), `docs/api/finance.md`
- **Autor:** architect
- **Pré-requisito:** Feature A pronta (ADR 0005): `OwnerId` em todo use case, repositório e read model do `finance`; `user_id` em `cards` e `entries`; rotas `/api/demo/*`; `DemoDatasetStore`; telas em `web/features/*` parametrizadas por `AppMode` e `FinanceReader`. Nomes do ADR 0005 citados aqui seguem a versão vigente dele; se a revisão em andamento renomear algo, vale o nome novo, sem mudar as decisões deste ADR.

---

## 0. Decisões de negócio incorporadas

| Id | Decisão | Origem |
|---|---|---|
| **B1** | Cancelar vale para `PENDING`, `PAID` e `RECEIVED`. **Exceção:** despesa de cartão `PAID` (fatura paga, total ou parcialmente) não é cancelável. O lançamento vira `CANCELED` e sai de todos os totais. | Usuário, 2026-10-29 |
| **T1** | Reativação mantida, como **desfazer exato** do cancelamento: volta ao status anterior (`PENDING`, `PAID` com o mesmo `paidAt`, ou `RECEIVED`). Receita e PIX: sempre. Cartão (só cancelável a partir de `PENDING`): só se a fatura não tiver nenhuma despesa `PAID`. | Este ADR (seção 3.5) |
| **Interpretação de "fatura já paga"** | Avaliada por lançamento: a despesa de cartão é `PAID` se e somente se foi quitada por um pagamento da fatura dela (pagar fatura, individual ou lote). Logo "cartão `PAID`" = "fatura paga, total ou parcialmente, com este lançamento dentro". Uma despesa de cartão `PENDING` de uma fatura parcialmente paga continua cancelável (só reduz o pendente). | Este ADR (pergunta Q1 na seção 15) |

---

## 1. Contexto

Hoje a categoria é texto livre em `entries.category` (+ `category_key`) com grafia canônica por `CategoryCatalog`; cartão não tem estado de ciclo de vida; `Entry` só tem `create` e `markAsPaid`, com `PAID` terminal. A Feature B transforma a categoria num aggregate do dono por tipo, adiciona inativação a cartão e categoria e adiciona o status `CANCELED` (com reativação) ao lançamento, sem nunca apagar dados.

Pontos do código atual que esta feature precisa mexer (detalhe na seção 14):
- `PrismaEntryRepository.saveAll` só atualiza linhas `type = 'EXPENSE' AND status = 'PENDING'` (o repositório codifica a transição de pagamento).
- `PrismaMonthlySummaryReadModel` e `PrismaDashboardReadModel.monthlySeries` somam receitas por `type = 'INCOME'`, sem filtrar status: com receita cancelável, isso inflaria totais.
- `PrismaInvoiceReadModel.listByMonth` conta `COUNT(*)` e `MAX(closing_date/due_date)` sem filtro de status.
- `MarkEntryAsPaid` chama `entry.markAsPaid` direto, sem o `EntryPaymentService` usado pelo lote e pela fatura.

---

## 2. Bounded context e linguagem ubíqua

### 2.1 Contexto

Tudo fica no contexto **Finanças pessoais** (`api/src/modules/finance/`). Categoria só existe para classificar lançamentos do mesmo dono: não tem regra própria fora do `finance`, não é compartilhada entre donos e participa da invariante "categoria do mesmo tipo do lançamento". Separá-la num contexto próprio criaria uma fronteira sem linguagem distinta (T2).

Nada muda no contexto `identity` nem no shared kernel, exceto: `labelKey`/`normalizeLabel` (já movidos para `shared/domain/text.ts` pelo ADR 0005) e o `ErrorKind` existente (`business_rule` = 422, `conflict` = 409), suficientes para os erros novos.

### 2.2 Linguagem ubíqua (negócio em pt-BR, código em inglês)

| Negócio (spec) | Código |
|---|---|
| Categoria | `Category` (aggregate), `CategoryId`, `CategoryName` (VO, antigo VO `Category`), `CategoryType` |
| Tipo da categoria | `CategoryType` = `'INCOME' \| 'EXPENSE'` (mesmo domínio de valores de `EntryType`) |
| Chave do nome | `CategoryName.key` (`labelKey`) / coluna `name_key` |
| Categoria ativa/inativa | `Category.isActive` / coluna `inactivated_at IS NULL` |
| Referência de categoria (o que o lançamento precisa saber) | `CategoryReference { categoryId, ownerId, type, active }` |
| Cartão ativo/inativo | `Card.isActive` / `cards.inactivated_at` |
| Inativar / reativar | `inactivate(now)` / `reactivate(now)` em `Card` e `Category` |
| Cancelar lançamento | `Entry.cancel(at)` |
| Reativar lançamento | `Entry.reactivate(at, invoice)` |
| Status anterior ao cancelamento | `EntrySnapshot.statusBeforeCancel` / coluna `status_before_cancel` / DTO `statusBeforeCancel` |
| Lançamento efetivo | `status <> 'CANCELED'`; fragmento SQL `EFFECTIVE_ENTRY` |
| Situação de pagamento da fatura | `InvoicePaymentState` (VO calculado sobre as despesas travadas da fatura) |
| Mostrar cancelados / inativos | `includeCanceled` / `includeInactive` (query) |
| Categoria em uso | `CategoryView.inUse` (tem ao menos um lançamento) |

---

## 3. Respostas às perguntas técnicas T1-T8

| T | Decisão | Seção |
|---|---|---|
| T1 | Reativação **mantida**, voltando ao status anterior. Receita e PIX sempre; cartão só se a fatura não tiver `PAID`, com lock de **todas** as despesas da fatura em ordem de id. | 3.5, 5.3 |
| T2 | Aggregate `Category` em `finance/domain/category/`. VO `Category` vira `CategoryName`. `CategoryCatalog`, `PrismaCategoryCatalog` e `NewEntryInput.withCanonicalCategory` são removidos. Novos `CategoryRepository` (domain) e `CategoryReadModel` (application). | 4.1, 5.1 |
| T3 | Tabela `categories` com `inactivated_at` (não `active`), unicidade `(user_id, type, name_key)`, FK composta `entries(category_id, user_id, type) -> categories(id, user_id, type)`. `cards.inactivated_at`. `entry_status += CANCELED`; `entries.canceled_at` e `entries.status_before_cancel`, com CHECKs. | 7 |
| T4 | Contratos da sugestão, com acréscimos: `type` **obrigatório** em `GET /api/categories`; `inUse` na categoria; `details.existing` nos 409 de nome; `statusBeforeCancel` no `Entry`; `includeCanceled` também em receitas; `categoryId` na distribuição. | 6 |
| T5 | **Duas chamadas**, com a categoria criada (ou reativada) **no momento da escolha** no combobox, por Server Action própria. `POST /api/entries` recebe só `categoryId`. R5/P03 aceitos. | 6.4, 9.4 |
| T6 | Quatro migrations: (1) valor de enum; (2) `categories` + passo de dados idempotente + FK; (3) cancelamento e inativação; (4) remoção das colunas de texto. Equivalência testada. | 7.2 |
| T7 | Códigos de P09 confirmados, com `details.reason` fechado (seção 6.6). | 6.6 |
| T8 | Stub ganha categorias, inativação, cancelamento/reativação, filtros novos e os 422 novos. | 9.8 |

### 3.5 Por que a reativação volta ao status anterior (T1)

Alternativas avaliadas:

| Opção | Problema |
|---|---|
| Sempre voltar a `PENDING` (regra da rev. 1) | Com B1, um PIX `PAID` cancelado por engano voltaria como pendente: o usuário teria de pagar de novo, `paidAt` mudaria e o resumo mostraria uma pendência que nunca existiu. Receita cancelada não pode ser `PENDING` (invariante de receita). |
| Tirar reativação do escopo | Cancelar pago passa a ser irreversível; um clique errado vira dado permanente fora dos totais, sem "desfazer". |
| **Voltar ao status anterior (escolhida)** | É o desfazer exato: o estado final é idêntico ao de antes do cancelamento (status, `paidAt`; só `updatedAt` muda). Impacto baixo por construção. Custa uma coluna (`status_before_cancel`). |

Restrição remanescente, só para cartão: a despesa de cartão cancelada veio necessariamente de `PENDING` (cartão `PAID` não cancela). Reativá-la numa fatura que já tem `PAID` "reabriria" uma fatura quitada (total ou parcialmente) com uma pendência nova; isso é o conflito citado pelo usuário e fica **proibido** (`INVOICE_HAS_PAYMENTS`). Cartão ou categoria inativos não bloqueiam.

---

## 4. Modelo de domínio (`finance/domain`)

Nenhum arquivo do domain importa NestJS, Prisma ou bibliotecas externas.

### 4.1 Aggregate `Category` (`domain/category/`)

VOs:

| VO | Regras | Erros (campo) |
|---|---|---|
| `CategoryId` | UUID (gerado v7) | invariante |
| `CategoryName` | renomeia o VO `Category` atual: `normalizeLabel`, 1 a 50 code points; `key = labelKey(value)` | `REQUIRED`, `TOO_LONG` |
| `CategoryType` | `'INCOME' \| 'EXPENSE'`; `parseCategoryType(raw)` | `REQUIRED`, `INVALID_VALUE` |

```ts
export interface CategorySnapshot {
  id: CategoryId;
  ownerId: OwnerId;
  type: CategoryType;
  name: CategoryName;
  inactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryReference {
  categoryId: CategoryId;
  ownerId: OwnerId;
  type: CategoryType;
  active: boolean;
}

export class Category extends AggregateRoot<CategoryDomainEvent> {
  /** Lança CategoryValidationError (acumulado: name, type). Emite CategoryCreated. */
  static create(p: { id: CategoryId; ownerId: OwnerId; type: string; name: string; now: Date }): Category;
  static restore(s: CategorySnapshot): Category;
  /** Sem mudança de texto (comparação exata, não por chave): no-op, false. Troca só de caixa: muda. Emite CategoryRenamed. */
  rename(name: string, now: Date): boolean;
  /** Idempotentes: já no estado-alvo -> false, sem evento e sem updatedAt. */
  inactivate(now: Date): boolean;
  reactivate(now: Date): boolean;
  get isActive(): boolean;
  get name(): CategoryName;
  get type(): CategoryType;
  get ownerId(): OwnerId;
  reference(): CategoryReference;
  toSnapshot(): CategorySnapshot;
}
```

Invariantes: `updatedAt >= createdAt`; `inactivatedAt == null || inactivatedAt >= createdAt`; `type` e `ownerId` imutáveis (sem setter; no banco, a FK composta com `ON UPDATE RESTRICT` impede alterar `type`/`user_id` de categoria referenciada). Unicidade `(ownerId, type, key)` é do use case + índice único, não do aggregate.

Eventos: `CategoryCreated { categoryId, ownerId, type, name }`, `CategoryRenamed { categoryId, before, after }`, `CategoryInactivated { categoryId }`, `CategoryReactivated { categoryId }` (todos com `occurredAt`).

Erros (`domain/category/errors`):
- `CategoryValidationError` (`VALIDATION_ERROR`, 400, `{ fields }`).
- `CategoryNameTakenError` (`CATEGORY_NAME_TAKEN`, 409): `{ fields: [{ field: "name", code: "NAME_TAKEN", message }], existing: { id, name, active } | null }`. Mensagem: "Já existe uma categoria com este nome." ou, se `existing.active === false`, "Já existe uma categoria inativa com este nome."
- `CategoryInactiveError` (`CATEGORY_INACTIVE`, 422, `{ categoryId }`): "A categoria está inativa."
- `CategoryTypeMismatchError` (`CATEGORY_TYPE_MISMATCH`, 422, `{ categoryId, categoryType, entryType }`): "A categoria não é do tipo do lançamento."

### 4.2 Aggregate `Card` (alterações)

```ts
// CardSnapshot += inactivatedAt: Date | null
inactivate(now: Date): boolean;   // idempotente; emite CardInactivated
reactivate(now: Date): boolean;   // idempotente; emite CardReactivated
get isActive(): boolean;
// CardBillingInfo += active: boolean
```

`update(props, now)` (PUT) continua permitido com o cartão inativo (P05) e não mexe em `inactivatedAt`. `CardNameTakenError` ganha `existing: { id, name, active } | null` em `details` (mensagem "Já existe um cartão inativo com este nome." quando inativo).

Novo erro `CardInactiveError` (`CARD_INACTIVE`, 422, `{ cardId }`): "O cartão está inativo."

### 4.3 Aggregate `Entry` (alterações)

Estado:

```ts
export type EntryStatus = 'PENDING' | 'PAID' | 'RECEIVED' | 'CANCELED';
export type EffectiveStatus = Exclude<EntryStatus, 'CANCELED'>;

export interface EntrySnapshot {
  // ... campos atuais, com ownerId (ADR 0005), exceto `category: Category`, que sai
  categoryId: CategoryId;
  canceledAt: Date | null;
  statusBeforeCancel: EffectiveStatus | null;
}
```

Máquina de estados:

```
INCOME : RECEIVED --cancel--> CANCELED(before=RECEIVED) --reactivate--> RECEIVED
PIX    : PENDING --markAsPaid--> PAID
         PENDING --cancel--> CANCELED(before=PENDING) --reactivate--> PENDING
         PAID    --cancel--> CANCELED(before=PAID, paidAt mantido) --reactivate--> PAID (mesmo paidAt)
CARD   : PENDING --markAsPaid--> PAID   (PAID: cancel proibido, CARD_INVOICE_PAID)
         PENDING --cancel--> CANCELED(before=PENDING) --reactivate [fatura sem PAID]--> PENDING
```

Invariantes novas (em `assertConsistent`, preferencialmente como tabela de combinações permitidas `type x paymentMethod x status x statusBeforeCancel`, ver 14.6):
1. `status = CANCELED` <=> `canceledAt != null` <=> `statusBeforeCancel != null`.
2. `statusBeforeCancel` compatível com o tipo e a forma: INCOME -> `RECEIVED`; EXPENSE PIX -> `PENDING | PAID`; EXPENSE CARD -> só `PENDING`.
3. `paidAt != null` <=> `status = PAID` ou (`status = CANCELED` e `statusBeforeCancel = PAID`).
4. `canceledAt >= createdAt` e, se havia pagamento, `canceledAt >= paidAt`.
5. `categoryId` obrigatório; na criação, a categoria tem o mesmo dono e o mesmo tipo do lançamento e está ativa.

Comportamentos:

```ts
static create(p: {
  id: EntryId; ownerId: OwnerId; input: NewEntryInput;
  card: CardBillingInfo | null; category: CategoryReference; now: Date;
}): Entry;
// Ordem dos 422 na criação: CATEGORY_TYPE_MISMATCH > CATEGORY_INACTIVE > CARD_INACTIVE.
// Dono diferente (categoria ou cartão) -> InvariantViolationError (o use case já devolveu 404 antes).

/** true se transicionou; false se já CANCELED (idempotente). CARD + PAID -> EntryNotCancelableError. Emite EntryCanceled. */
cancel(at: Date): boolean;

/**
 * Volta a statusBeforeCancel; limpa canceledAt e statusBeforeCancel; mantém paidAt.
 * Não CANCELED -> EntryNotReactivatableError('NOT_CANCELED').
 * CARD: `invoice` obrigatório e da mesma fatura (senão InvariantViolationError);
 *       invoice.hasPaidEntries -> EntryNotReactivatableError('INVOICE_HAS_PAYMENTS').
 * PIX/INCOME: `invoice` deve ser null. Emite EntryReactivated.
 */
reactivate(at: Date, invoice: InvoicePaymentState | null): void;

/** Como hoje, mais: CANCELED -> EntryNotPayableError({ incomeIds: [], canceledIds: [id] }). */
markAsPaid(at: Date): boolean;

/** Status lido do banco (restore) ou null (create). Guarda otimista do saveAll (7.4). */
get statusAtLoad(): EntryStatus | null;
get categoryId(): CategoryId;
```

`NewEntryInput` troca `category: Category` por `categoryId: CategoryId` (`REQUIRED`, `INVALID_FORMAT` acumulados com as demais violações, 400); `withCanonicalCategory` sai.

### 4.4 Value object `InvoicePaymentState` (`domain/billing/`)

```ts
export class InvoicePaymentState {
  /** Todas as despesas devem pertencer a `key` (cardId + referenceMonth), senão InvariantViolationError. */
  static of(key: InvoiceKey, entries: readonly Entry[]): InvoicePaymentState;
  readonly key: InvoiceKey;
  get hasPaidEntries(): boolean;   // alguma despesa PAID
}
```

Mantém a regra "fatura com pagamento" no domínio, sem o aggregate `Entry` conhecer outros aggregates (recebe só o VO).

### 4.5 Domain service `EntryPaymentService` (alterado)

```ts
export class EntryPaymentService {
  /** Coleta TODOS os incomeIds e canceledIds antes de mutar; se houver algum, EntriesNotPayableError. */
  payAll(entries: readonly Entry[], at: Date): PaymentOutcome;
  /** Pagamento individual: EntryNotPayableError({ incomeIds, canceledIds }) ou markAsPaid. */
  payOne(entry: Entry, at: Date): boolean;
}
```

### 4.6 Eventos e erros de `Entry`

Eventos novos: `EntryCanceled { entryId, ownerId, type, amount, cardId, referenceMonth, statusBeforeCancel, occurredAt }`, `EntryReactivated { entryId, ownerId, restoredStatus, cardId, referenceMonth, occurredAt }`. `EntryCreated` troca `categoryKey` por `categoryId`.

| Classe | code | HTTP | details | Mensagem |
|---|---|---|---|---|
| `EntryNotCancelableError` | `ENTRY_NOT_CANCELABLE` | 422 | `{ id, reason: "CARD_INVOICE_PAID" }` | "Despesa de cartão já paga não pode ser cancelada." |
| `EntryNotReactivatableError` | `ENTRY_NOT_REACTIVATABLE` | 422 | `{ id, reason: "NOT_CANCELED" \| "INVOICE_HAS_PAYMENTS" }` | "Só lançamentos cancelados podem ser reativados." / "A fatura deste lançamento já tem pagamento." |
| `EntryNotPayableError` (antes `IncomeNotPayableError`) | `ENTRY_NOT_PAYABLE` | 422 | `{ incomeIds, canceledIds }` | "Receitas não podem ser pagas." / "Lançamento cancelado não pode ser pago." |
| `EntriesNotPayableError` (antes `IncomesNotPayableError`) | `ENTRIES_NOT_PAYABLE` | 422 | `{ incomeIds, canceledIds }` | "Há receitas ou lançamentos cancelados na seleção." |

Os `details` de pagamento mantêm `incomeIds` (compatível) e ganham `canceledIds` (sempre presentes, possivelmente vazios).

---

## 5. Interfaces de repositório (domain) e ports (application)

### 5.1 Repositórios (domain)

```ts
// domain/category/category.repository.ts
export interface CategoryRepository {
  /** Violação de (user_id, type, name_key) -> CategoryNameTakenError com existing = null. */
  insert(category: Category): Promise<void>;
  /** name, name_key, inactivated_at, updated_at WHERE id AND user_id = category.ownerId. Idem 409. */
  update(category: Category): Promise<void>;
  findById(ownerId: OwnerId, id: CategoryId): Promise<Category | null>;
  findByNameKey(ownerId: OwnerId, type: CategoryType, key: string): Promise<Category | null>;
}
export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

// domain/card/card.repository.ts (alterado): update() também persiste inactivated_at.

// domain/entry/entry.repository.ts (alterado)
export interface EntryRepository {
  insert(entry: Entry): Promise<void>;
  findByIdsForUpdate(ownerId: OwnerId, ids: readonly EntryId[]): Promise<Entry[]>;            // ORDER BY id FOR UPDATE
  findPendingByInvoiceForUpdate(ownerId: OwnerId, key: InvoiceKey): Promise<Entry[]>;         // só PENDING (cancelados nunca)
  /** NOVO: todas as despesas da fatura, qualquer status, ORDER BY id FOR UPDATE (reativação de cartão). */
  findByInvoiceForUpdate(ownerId: OwnerId, key: InvoiceKey): Promise<Entry[]>;
  /**
   * ALTERADO: persiste status, paid_at, canceled_at, status_before_cancel, updated_at
   * WHERE id AND user_id AND status = entry.statusAtLoad. Linhas afetadas != entries.length -> erro (contrato de lock).
   */
  saveAll(entries: readonly Entry[]): Promise<void>;
}
```

`CategoryCatalog` é removido do domain.

### 5.2 Ports de leitura (application)

```ts
// application/ports/category-read-model.ts (substitui listDistinct)
export interface CategoryView {
  id: string; type: CategoryType; name: string; active: boolean; inUse: boolean; createdAt: Date; updatedAt: Date;
}
export interface CategoryReadModel {
  /** Ativas primeiro, depois inativas; dentro de cada grupo por name_key (ICU), id. */
  list(ownerId: OwnerId, c: { type: CategoryType; includeInactive: boolean }): Promise<CategoryView[]>;
  findById(ownerId: OwnerId, id: CategoryId): Promise<CategoryView | null>;
}

// card-read-model.ts: CardView += active; listAll(ownerId, { includeInactive }) com a mesma ordenação.

// entry-read-model.ts
export interface ExpenseListCriteria {
  month: ReferenceMonth; status?: 'PENDING' | 'PAID'; categoryId?: CategoryId;
  card: ExpenseCardFilter; includeCanceled: boolean; paging: Paging;
}
export interface IncomeListCriteria {
  month: ReferenceMonth; categoryId?: CategoryId; includeCanceled: boolean; paging: Paging;
}
// EntryView: category: { id: string; name: string }; canceledAt: Date | null; statusBeforeCancel: EffectiveStatus | null

// invoice-read-model.ts
listEntries(ownerId: OwnerId, key: InvoiceKey, o: { includeCanceled: boolean }): Promise<EntryView[]>;

// dashboard-read-model.ts: CategoryShare = { categoryId: string; category: string; total: Money; percentage: string }
```

Ports compartilhados existentes (`Clock`, `IdGenerator`, `DomainEventPublisher`, `FinanceUnitOfWork`) sem mudança de assinatura. O `FinanceTransactionScope` não precisa de `categories` (nenhum use case de categoria exige transação conjunta com lançamentos).

### 5.3 Use cases

Todos recebem `ownerId` (string do principal, convertido em `OwnerId`, ADR 0005 5.4). Precedência: 401 > 400 > 404 > 409/422.

| Use case | Input | Output | Fluxo |
|---|---|---|---|
| `CreateCategory` | `{ ownerId, name, type }` | `CategoryView` | `Category.create` (400 acumulado) -> `findByNameKey(owner, type, key)`: existe -> 409 com `existing` -> `insert` (corrida: 409 do repositório; o use case relê `findByNameKey` para preencher `existing`) -> publica -> `readModel.findById`. |
| `RenameCategory` | `{ ownerId, id, name }` | `CategoryView` | 400 (`id`, `name`) > `findById` (404 `CATEGORY_NOT_FOUND`) > `findByNameKey` com outro id -> 409 > `rename`; mudou -> `update`. |
| `InactivateCategory` / `ReactivateCategory` | `{ ownerId, id }` | `CategoryView` | 400 > 404 > transição; mudou -> `update`. Idempotente. |
| `ListCategories` | `{ ownerId, type, includeInactive }` | `CategoryView[]` | `type` obrigatório (400 `REQUIRED`/`INVALID_VALUE`). |
| `CreateCard` / `UpdateCard` | como hoje | `CardView` | 409 com `existing` (mesma técnica do `CreateCategory`). |
| `InactivateCard` / `ReactivateCard` | `{ ownerId, id }` | `CardView` | 400 > 404 `CARD_NOT_FOUND` > transição; mudou -> `update`. |
| `ListCards` | `{ ownerId, includeInactive }` | `CardView[]` | |
| `CreateEntry` | `{ ownerId, ...RawEntryInput com categoryId }` | `EntryView` | 400 (`NewEntryInput`) > 404 `CARD_NOT_FOUND` (se CARD) > 404 `CATEGORY_NOT_FOUND` > 422 (domínio: tipo > inativa > cartão inativo) > `insert` > publica > `entryReadModel.findById`. Sem transação nem lock de cartão/categoria (D6). |
| `CancelEntry` | `{ ownerId, id }` | `EntryView` | 400 > UoW: `findByIdsForUpdate(owner, [id])` (404) -> `cancel(now)`; mudou -> `saveAll` -> eventos > `entryReadModel.findById`. |
| `ReactivateEntry` | `{ ownerId, id }` | `EntryView` | 400 > `entryReadModel.findById` sem lock (404; obtém forma, cartão e mês, que são imutáveis) > UoW: CARD -> `findByInvoiceForUpdate(owner, key)` (trava a fatura inteira em ordem de id, inclusive o próprio lançamento), pega o lançamento do conjunto, `InvoicePaymentState.of(key, conjunto)`, `reactivate(now, state)`; PIX/INCOME -> `findByIdsForUpdate`, `reactivate(now, null)` > `saveAll([entry])` > view. |
| `MarkEntryAsPaid` | como hoje | `EntryView` | Passa a usar `paymentService.payOne` (422 com `canceledIds`). |
| `PayEntriesInBatch` | como hoje | `{ paidIds, alreadyPaidIds }` | 422 `ENTRIES_NOT_PAYABLE` com **todos** os `incomeIds` e `canceledIds`; nada muda. |
| `PayInvoice` | como hoje | igual | Sem mudança de código: `findPendingByInvoiceForUpdate` já exclui cancelados. Cartão inativo continua pagável. |
| `ListExpenses` / `ListIncomes` | `+ categoryId?, includeCanceled?` | igual + `Entry` novo | `category` (texto) sai do query. `includeCanceled` com `status` presente é ignorado (o filtro `status` é exato). |
| `ListInvoiceEntries` | `+ includeCanceled?` | `EntryView[]` | |
| `ListInvoices`, `GetMonthlySummary`, `GetMonthlySeries`, `GetCategoryDistribution` | iguais | iguais (+ `categoryId` na distribuição) | Mudança só nos read models (8). |

Por que `ReactivateEntry` lê antes sem lock: travar primeiro o próprio lançamento e depois a fatura inverteria a ordem de id usada por `PayEntriesInBatch` e `PayInvoice` e poderia gerar deadlock. Travando só o conjunto da fatura, em ordem de id, todas as operações adquirem locks na mesma ordem.

Concorrência (RNF02, CA22, R6):
- pagar x cancelar o mesmo lançamento: os dois usam `FOR UPDATE` na linha; o segundo lê o estado final do primeiro. PIX: cancelar depois de pagar é permitido (fica `CANCELED`, `before = PAID`); pagar depois de cancelar dá 422. Cartão: cancelar depois de pagar dá 422 `CARD_INVOICE_PAID`.
- `PayInvoice` x `CancelEntry`: `PayInvoice` trava as `PENDING`; se o cancelamento chegou antes, a reavaliação do `WHERE status = 'PENDING'` no `FOR UPDATE` (READ COMMITTED) descarta a linha; se depois, o cancelamento vê `PAID` e responde 422.
- `ReactivateEntry` (cartão) x qualquer pagamento da fatura: a reativação trava todas as despesas da fatura; um pagamento que chegue depois espera e, ao prosseguir, encontra o estado já reativado (ordem serial válida). Um pagamento que chegue antes faz a reativação ver `PAID` e responder `INVOICE_HAS_PAYMENTS`. Despesa de cartão nunca nasce `PAID`, então um `INSERT` concorrente não fura a regra.
- Guarda extra: `saveAll` com `status = statusAtLoad` falha alto se o contrato de lock for violado.

---

## 6. Contratos HTTP

Formato de erro `{ code, message, details }`; todas as rotas abaixo são protegidas (ADR 0005) e todo id de outro dono responde como inexistente (404). Corpos e queries `strictObject` (campo extra -> 400 `UNKNOWN_FIELD`).

### 6.1 DTOs

```ts
type CategoryDto = {
  id: string; type: 'INCOME' | 'EXPENSE'; name: string; active: boolean; inUse: boolean;
  createdAt: string; updatedAt: string;           // ISO UTC
};
type CardDto = { /* atual */ active: boolean };
type EntryDto = {
  /* atual, exceto category */
  category: { id: string; name: string };          // antes: string
  status: 'PENDING' | 'PAID' | 'RECEIVED' | 'CANCELED';
  paidAt: string | null;                           // mantido em CANCELED vindo de PAID
  canceledAt: string | null;
  statusBeforeCancel: 'PENDING' | 'PAID' | 'RECEIVED' | null;
};
type CategoryShareDto = { categoryId: string; category: string; total: string; percentage: string };
type NameTakenDetails = {
  fields: [{ field: 'name'; code: 'NAME_TAKEN'; message: string }];
  existing: { id: string; name: string; active: boolean } | null;  // null só em corrida rara sem releitura
};
```

### 6.2 Categorias (`presentation/http/categories.controller.ts`)

| Método e rota | Corpo / query | 2xx | Erros |
|---|---|---|---|
| `GET /api/categories` | `?type=INCOME\|EXPENSE` (obrigatório) `&includeInactive=true\|false` (padrão `false`) | 200 `{ items: CategoryDto[] }` | 400 (`type` `REQUIRED`/`INVALID_VALUE`; `includeInactive` `INVALID_VALUE`) |
| `POST /api/categories` | `{ name: string, type: string }` | 201 `CategoryDto` | 400 `VALIDATION_ERROR` (`name` `REQUIRED`/`TOO_LONG`, `type`), 409 `CATEGORY_NAME_TAKEN` (`NameTakenDetails`) |
| `PATCH /api/categories/:id` | `{ name: string }` | 200 `CategoryDto` (no-op se igual) | 400 (`id` `INVALID_FORMAT`, `name`), 404 `CATEGORY_NOT_FOUND` (`{ id }`), 409 `CATEGORY_NAME_TAKEN`. `type` no corpo -> `UNKNOWN_FIELD`. |
| `POST /api/categories/:id/inactivate` | - | 200 `CategoryDto` | 400, 404 |
| `POST /api/categories/:id/reactivate` | - | 200 `CategoryDto` | 400, 404 |

### 6.3 Cartões

| Método e rota | Mudança |
|---|---|
| `GET /api/cards?includeInactive=` | novo parâmetro (padrão `false`); `CardDto.active` |
| `POST /api/cards`, `PUT /api/cards/:id` | 409 `CARD_NAME_TAKEN` ganha `details.existing` |
| `POST /api/cards/:id/inactivate`, `POST /api/cards/:id/reactivate` | novos; 200 `CardDto`; 400, 404 `CARD_NOT_FOUND` |
| `POST /api/cards/:cardId/invoices/:referenceMonth/pay` | sem mudança (cartão inativo continua pagável) |
| `GET /api/cards/:cardId/invoices/:referenceMonth/entries?includeCanceled=` | novo parâmetro (padrão `false`) |

### 6.4 Lançamentos

| Método e rota | Mudança / erros |
|---|---|
| `POST /api/entries` | `category` (texto) sai (`UNKNOWN_FIELD`); entra `categoryId` (`REQUIRED`, `INVALID_FORMAT`). Erros novos: 404 `CATEGORY_NOT_FOUND`; 422 `CATEGORY_TYPE_MISMATCH`, `CATEGORY_INACTIVE`, `CARD_INACTIVE`. Ordem: 400 > 404 cartão > 404 categoria > 422 (tipo > categoria inativa > cartão inativo). |
| `POST /api/entries/:id/cancel` | novo. 200 `EntryDto` (idempotente). 400, 404 `ENTRY_NOT_FOUND`, 422 `ENTRY_NOT_CANCELABLE` `{ id, reason: "CARD_INVOICE_PAID" }`. |
| `POST /api/entries/:id/reactivate` | novo. 200 `EntryDto`. 400, 404, 422 `ENTRY_NOT_REACTIVATABLE` `{ id, reason: "NOT_CANCELED" \| "INVOICE_HAS_PAYMENTS" }`. |
| `POST /api/entries/:id/pay` | 422 `ENTRY_NOT_PAYABLE` `{ incomeIds, canceledIds }`. |
| `POST /api/entries/pay` | 422 `ENTRIES_NOT_PAYABLE` `{ incomeIds, canceledIds }` (todos). |
| `GET /api/entries/expenses` | `category` sai; entram `categoryId` (UUID; inexistente ou de outro dono = lista vazia, como `cardId`) e `includeCanceled`. `status` aceita só `PENDING`/`PAID`. `subtotal` nunca inclui cancelados; `pagination.totalItems` conta os itens exibidos. |
| `GET /api/entries/incomes` | idem (`categoryId`, `includeCanceled`); `subtotal.total` só `RECEIVED`. |

Sem rota de lote para cancelar/reativar (fora de escopo).

### 6.5 Demais leituras e demo

- `GET /api/invoices`, `/api/summary`, `/api/dashboard/*`: contratos iguais, valores sem cancelados; distribuição ganha `categoryId`.
- `/api/demo/*` (ADR 0005 6.5): mesmos parâmetros novos, montados pelos mesmos read handlers (`finance-read-handlers.ts`), mais `GET /api/demo/categories?type=&includeInactive=`. Nenhuma rota nova de escrita (CA25).

### 6.6 Códigos de erro (T7)

Confirmados os nomes de P09. `reason` é um enum fechado e documentado (`CARD_INVOICE_PAID`, `NOT_CANCELED`, `INVOICE_HAS_PAYMENTS`) para o web escolher a mensagem sem depender do texto. Nenhum `kind` novo: `HttpErrorFilter` não muda (os erros novos usam `not_found`, `conflict`, `business_rule`).

---

## 7. Persistência

### 7.1 Schema Prisma (trechos novos e alterados)

```prisma
enum EntryStatus {
  PENDING
  PAID
  RECEIVED
  CANCELED
  @@map("entry_status")
}

model Category {
  id            String    @id @db.Uuid
  userId        String    @map("user_id") @db.Uuid
  user          User      @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  type          EntryType
  name          String    @db.VarChar(50)
  nameKey       String    @map("name_key") @db.VarChar(100)
  inactivatedAt DateTime? @map("inactivated_at") @db.Timestamptz(3)
  createdAt     DateTime  @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime  @map("updated_at") @db.Timestamptz(3)
  entries       Entry[]

  @@unique([userId, type, nameKey], map: "categories_owner_type_name_key_uq")
  @@unique([id, userId, type], map: "categories_id_owner_type_uq") // alvo da FK composta
  @@map("categories")
}

model Card {
  // ... (ADR 0005)
  inactivatedAt DateTime? @map("inactivated_at") @db.Timestamptz(3)
}

model Entry {
  // ... (ADR 0005), sem `category` e `categoryKey`
  categoryId         String       @map("category_id") @db.Uuid
  category           Category     @relation(fields: [categoryId, userId, type], references: [id, userId, type], onDelete: Restrict, onUpdate: Restrict)
  canceledAt         DateTime?    @map("canceled_at") @db.Timestamptz(3)
  statusBeforeCancel EntryStatus? @map("status_before_cancel")

  @@index([categoryId], map: "entries_category_idx")
  // índices do ADR 0005 mantidos, exceto entries_owner_category_key_created_idx (removido)
}
```

Notas:
- **FK composta**: aqui ela é expressável no Prisma (diferente do cartão no ADR 0005) porque `categoryId`, `userId` e `type` são todos obrigatórios. Ela garante no banco "mesmo dono" e "mesmo tipo" (RNF01) e, com `ON UPDATE RESTRICT`, impede trocar `type`/`user_id` de categoria em uso. Confirmar na implementação que o Prisma 7 aceita o campo enum `type` na relação e o `userId` em duas relações; se não aceitar, usar a mesma saída do ADR 0005 D6 (trigger `entries_category_same_owner_type_trg` em SQL manual, documentado no `schema.prisma`).
- `inactivated_at` em vez de `active boolean`: uma coluna dá situação e instante (auditoria barata), sem CHECK extra. O DTO expõe `active`.
- `status_before_cancel` reutiliza o enum `entry_status` (o CHECK impede `CANCELED` nele).
- CHECKs (SQL manual, como os existentes):
  - `categories_updated_after_created_chk`, `categories_inactivated_after_created_chk`, `categories_name_key_not_blank_chk`;
  - `cards_inactivated_after_created_chk`;
  - `entries_canceled_consistency_chk`: `(status = 'CANCELED') = (canceled_at IS NOT NULL) AND (status = 'CANCELED') = (status_before_cancel IS NOT NULL)`;
  - `entries_status_before_cancel_chk`: `status_before_cancel IS NULL OR status_before_cancel <> 'CANCELED'`;
  - `entries_type_status_chk` (recriado): INCOME com `status = 'RECEIVED'` ou (`CANCELED` e antes `RECEIVED`); EXPENSE com `status IN ('PENDING','PAID')` ou (`CANCELED` e antes `IN ('PENDING','PAID')`);
  - `entries_card_cancel_chk`: `NOT (payment_method = 'CARD' AND status_before_cancel = 'PAID')`;
  - `entries_paid_consistency_chk` (recriado): `(paid_at IS NOT NULL) = (status = 'PAID' OR status_before_cancel = 'PAID')`;
  - `entries_canceled_after_chk`: `canceled_at IS NULL OR (canceled_at >= created_at AND (paid_at IS NULL OR canceled_at >= paid_at))`.

### 7.2 Migrations (T6)

Ordem posterior às migrations da Feature A. Volume pequeno (app recém multiusuário): locks das DDLs aceitáveis; ensaiar num dump real antes do deploy.

1. **`20261029000001_entry_status_canceled`**: só `ALTER TYPE entry_status ADD VALUE IF NOT EXISTS 'CANCELED';`. Isolada porque o PostgreSQL não permite usar um valor de enum novo na mesma transação que o criou, e as migrations seguintes o referenciam em CHECKs.
2. **`20261029000002_categories_entity`** (uma transação; confirmar se o Prisma 7 envolve o arquivo em transação; se não, `BEGIN`/`COMMIT` explícitos):
   1. `CREATE TABLE IF NOT EXISTS categories (...)`, índices únicos e CHECKs.
   2. Função temporária `pg_temp.uuid_v7_at(ts timestamptz)`: 48 bits de milissegundos de `ts`, versão 7, variante `10`, resto de `gen_random_uuid()` (PostgreSQL 17 não tem `uuidv7()`).
   3. **Passo de dados idempotente** (bloco delimitado por comentários `-- data-step:begin/end`, reexecutável pelo teste de CA14):
      - `INSERT INTO categories (id, user_id, type, name, name_key, inactivated_at, created_at, updated_at) SELECT pg_temp.uuid_v7_at(f.created_at), f.user_id, f.type, f.category, f.category_key, NULL, f.created_at, f.created_at FROM (SELECT DISTINCT ON (user_id, type, category_key) user_id, type, category, category_key, created_at FROM entries ORDER BY user_id, type, category_key, created_at, id) f ON CONFLICT (user_id, type, name_key) DO NOTHING;` (P02: grafia do primeiro uso por dono e tipo).
      - `ALTER TABLE entries ADD COLUMN IF NOT EXISTS category_id uuid NULL;`
      - `UPDATE entries e SET category_id = c.id FROM categories c WHERE e.category_id IS NULL AND c.user_id = e.user_id AND c.type = e.type AND c.name_key = e.category_key;`
      - Asserção: `DO $$ BEGIN IF EXISTS (SELECT 1 FROM entries WHERE category_id IS NULL) THEN RAISE EXCEPTION 'migração de categorias: lançamento sem categoria'; END IF; END $$;`
   4. `ALTER COLUMN category_id SET NOT NULL`, FK composta `entries_category_fkey` (RESTRICT/RESTRICT), índice `entries_category_idx`.
3. **`20261029000003_cancel_and_inactivation`**: `cards.inactivated_at`, `entries.canceled_at`, `entries.status_before_cancel`, drop/recreate dos CHECKs da 7.1. Nenhum dado muda (todas as linhas existentes satisfazem os CHECKs novos com as colunas nulas).
4. **`20261029000004_drop_entry_category_text`**: drop de `entries_owner_category_key_created_idx` (ADR 0005), `entries.category_key` e `entries.category`. Separada para que o passo de dados da 2 possa ser reexecutado em teste antes do drop.

Idempotência (CA14): `migrate deploy` nunca reaplica uma migration; o passo de dados, se reexecutado manualmente antes da 4, não duplica categorias (`ON CONFLICT DO NOTHING`) nem altera lançamentos (`WHERE category_id IS NULL`). Depois da 4 ele deixa de ser aplicável por construção (as colunas de origem não existem).

Equivalência (RNF03): a distribuição atual agrupa por `category_key` mostrando o texto do primeiro lançamento do mês; como o catálogo canônico garante texto igual para a mesma chave por dono, o nome da categoria migrada é o mesmo. O teste compara, por dono e mês, contagem, resumo, série e distribuição (nomes e valores) antes e depois.

Rollback: forward-fix, como nas migrations atuais (comentário no topo da 2 e da 4 descrevendo como recriar `category`/`category_key` a partir de `categories`).

### 7.3 Índices e RNF04

- Listar categorias: `categories_owner_type_name_key_uq` cobre `WHERE user_id AND type ORDER BY name_key`; `inUse` via `EXISTS (SELECT 1 FROM entries WHERE category_id = c.id)` usa `entries_category_idx` (até 500 sondagens por índice).
- Listagens e agregações: os índices `(user_id, reference_month, type, ...)` e `(user_id, reference_month, type, status)` do ADR 0005 continuam suficientes; o filtro `status <> 'CANCELED'` é residual. O join com `categories` é por PK.
- Fatura: `entries_card_month_status_idx` atende `findByInvoiceForUpdate` e `listByMonth`.
- Medição: repetir o perf da Feature A com 5% de cancelados e 50 categorias por dono, mais um perf de `GET /api/categories` com 500 categorias.

### 7.4 Mappers e repositórios (infrastructure)

- `CategoryMapper` (`toDomain`, `toPersistence`); `CardMapper` e `EntryMapper` com os campos novos. `EntryMapper.toDomain` registra `statusAtLoad`.
- `PrismaCategoryRepository`: P2002 em `categories_owner_type_name_key_uq` -> `CategoryNameTakenError` (regex específica da constraint, não `/name_key/`, para não colidir com a de cartões).
- `PrismaEntryRepository.saveAll`: `UPDATE ... FROM unnest(...)` com as colunas novas e `WHERE e.id = v.id AND e.user_id = v.user_id AND e.status = v.status_at_load::entry_status` (sai o `type = 'EXPENSE' AND status = 'PENDING'` fixo).
- `ENTRY_RECORD_COLUMNS` / `ENTRY_VIEW_COLUMNS`: saem `e.category`; entram `e.category_id`, `e.canceled_at`, `e.status_before_cancel` e, na view, `cat.name AS category_name` com `JOIN categories cat ON cat.id = e.category_id`.

---

## 8. Read models: lançamento efetivo (R2)

Novo fragmento único em `infrastructure/mappers/entry-sql.ts`: `EFFECTIVE_ENTRY = Prisma.raw("e.status <> 'CANCELED'")`. Toda agregação usa o fragmento (revisão: nenhum `SUM`/`COUNT`/`MAX` sobre `entries` sem ele).

| Read model | Mudança |
|---|---|
| `summary` | `WHERE ... AND EFFECTIVE_ENTRY`; receita passa a `type = 'INCOME' AND status = 'RECEIVED'` (hoje sem status). |
| `monthlySeries` | idem no CTE `agg`. |
| `expenseDistribution` | `JOIN categories cat`; `WHERE type = 'EXPENSE' AND EFFECTIVE_ENTRY`; `GROUP BY cat.id, cat.name, cat.name_key`; ordem `SUM DESC, cat.name_key, cat.id`; percentual sobre efetivas. Categoria inativa aparece normalmente. |
| `listByMonth` (faturas) | `WHERE ... AND EFFECTIVE_ENTRY`: `entry_count`, `pending_count`, `MAX(closing_date/due_date)` e totais sem cancelados; fatura só com cancelados some (sem linhas no grupo). |
| `listEntries` (fatura) | `includeCanceled ? sem filtro : EFFECTIVE_ENTRY`; mesma ordenação. |
| `listExpenses` / `listIncomes` | Página: `WHERE filtros AND (includeCanceled OR EFFECTIVE_ENTRY)`; `totalItems` sobre o mesmo conjunto. Subtotal: **sempre** `filtros AND EFFECTIVE_ENTRY` (consulta própria, mesmo snapshot RepeatableRead de hoje). Filtro `e.category_id = $categoryId`. Receitas: subtotal `status = 'RECEIVED'`. |
| `findById` | retorna também cancelados (usado após cancelar/reativar). |
| `CardReadModel.listAll` | `includeInactive ? todos : inactivated_at IS NULL`; `ORDER BY (inactivated_at IS NOT NULL), name_key COLLATE "und-x-icu", id`. |
| `CategoryReadModel.list` | idem por `(user_id, type)`, com `inUse`. |

Os read models continuam por dono (ADR 0005); nenhum ganha método sem `ownerId`.

---

## 9. Impacto no Next.js (`web/`)

### 9.1 Tipos e leitura

- `lib/api/types.ts`: `Entry.category: { id, name }`, `status` com `CANCELED`, `canceledAt`, `statusBeforeCancel`; `Card.active`; `Category`; `CategoryShare.categoryId`; `NameTakenDetails`.
- `FinanceReader` (ADR 0005 9.6): `listCategories(type, { includeInactive })`, `listCards({ includeInactive })`, `listExpenses/listIncomes` com `categoryId` e `includeCanceled`, `listInvoiceEntries(..., { includeCanceled })`. Mesmo contrato nos modos protegido e demo.

### 9.2 Rotas e páginas

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/categories?type=EXPENSE\|INCOME&inactive=1` | `app/(protected)/categories/page.tsx` + `actions.ts` | `<CategoriesScreen mode={PROTECTED_MODE} reader=... />` |
| `/demo/categories` | `app/(public)/demo/categories/page.tsx` | mesma tela, `DEMO_MODE` (somente leitura, P07) |
| `features/categories/` | `categories-screen.tsx`, `category-tabs.tsx`, `category-list.tsx`, `category-form-dialog.tsx` | abas por tipo, "Mostrar inativas", selo "Inativa", ações; erros de nome inline |

Acréscimos: `MainNav` ganha "Categorias" (com `basePath`); `decideRoute`/`proxy.ts` e `safeNext` incluem `/categories` como rota protegida.

### 9.3 Server Actions (todas em `(protected)`, padrão `toResult` do ADR 0005)

| Action | Arquivo | API |
|---|---|---|
| `createCategory`, `renameCategory`, `inactivateCategory`, `reactivateCategory` | `categories/actions.ts` | 6.2 |
| `inactivateCard`, `reactivateCard` | `cards/actions.ts` | 6.3 |
| `cancelEntry`, `reactivateEntry` | `entries/actions.ts` | 6.4 |
| `createEntry` | `entries/actions.ts` | envia `categoryId` |

Cada mutação faz `revalidatePath` das telas afetadas (`/entries`, `/dashboard`, `/cards`, `/categories`). O mapeamento `code`/`reason` -> mensagem fica em `lib/api/action-result.ts` (extraído de `http.ts`, ADR 0005 13.2), com uma tabela para os códigos novos.

### 9.4 Campo Categoria do drawer (T5)

- Combobox alimentado por `listCategories(type, { includeInactive: true })` carregado com o drawer; opções selecionáveis = ativas do tipo. As inativas ficam só para detectar "Reativar e usar".
- Trocar o tipo limpa a seleção (o `categoryId` sempre pertence a um tipo).
- Digitou sem correspondência: opção `Criar "<nome>"` chama `createCategory` **na hora** e seleciona o id devolvido; 409 com `existing.active === true` seleciona a existente; com `false`, oferece "Reativar e usar" (`reactivateCategory` + seleção). Erros de nome aparecem no próprio campo.
- O formulário envia só `categoryId`. Se a criação do lançamento falhar, a categoria permanece (P03).

### 9.5 Listagens

- Query params: `canceled=1` (único para Despesas, Receitas e Faturas, P13), `categoryId` (substitui `category`), `/cards?inactive=1`, `/categories?inactive=1`. `entriesHref` e o parser de `entries-search-params.ts` passam a conhecer esses campos.
- Linha cancelada: selo "Cancelado" + estilo atenuado, sem checkbox, sem "Pagar"/"Cancelar", com "Reativar" (fora da demo). Ao receber 422 `INVOICE_HAS_PAYMENTS`, mostrar a mensagem do motivo (CA20).
- "Cancelar": Despesas (`PENDING`; PIX `PAID`) e Receitas (`RECEIVED`); nunca para `CARD` `PAID`. Diálogo com texto distinto para pago/recebido ("O valor sai dos totais. Isto não é um estorno."). A regra de exibição fica numa função pura `entryActions(entry, mode)` testada (evita espalhar condições pelos componentes).
- Filtros de categoria e cartão: opções = ativas + inativas com `inUse` (categorias) ou todos (cartões), inativas por último com sufixo "(inativa)"/"(inativo)" (P06).
- Drawer "Novo lançamento" e atalho "+ Novo cartão": só cartões ativos.
- `/cards`: "Mostrar inativos", "Inativar" com confirmação, "Reativar", "Editar" também para inativo (P05); 409 de nome com `existing.active === false` oferece "Reativar".

### 9.6 Demo

`readOnly` (ADR 0005) esconde "+ Nova categoria", "Renomear", "Inativar", "Reativar" e "Cancelar". Filtros funcionam.

### 9.7 Dashboard

`category-donut.tsx` passa a usar `categoryId` como chave estável (nome pode repetir entre renomeações no cache).

### 9.8 Stub de e2e (T8)

`web/e2e/stub-api/server.mjs`: coleções de categorias por dono e tipo, rotas 6.2-6.4, `includeCanceled`/`includeInactive`, 409 com `existing`, 422 com `reason`, e as mesmas leituras em `/api/demo/*`. Dataset do stub com categoria inativa, cartão inativo e cancelados (despesa pendente, PIX pago, receita).

---

## 10. Dataset demo (RF20, P08)

- `buildDemoDataset(anchor, version)` (ADR 0005 5.5) passa a devolver `{ categories: CategorySpec[]; cards: CardSpec[]; entries: DemoEntrySpec[] }`, com `version` incrementada (força a regeneração no próximo boot).
  - Categorias de despesa: Moradia, Alimentação, Transporte, Saúde, Lazer, Assinaturas e **Academia (inativa)**, com despesas nos meses -11 a -6. Receita: Salário, Freela.
  - Cartões: Nubank, Itaú Click e **"Cartão Antigo" (inativo)**, com despesas pagas nos meses -11 a -8.
  - Cancelados: uma despesa de cartão pendente na fatura do mês atual (antes `PENDING`), uma despesa PIX paga no mês anterior (antes `PAID`) e um "Freela" no mês -2 (antes `RECEIVED`), todos em meses com outros lançamentos efetivos.
  - `DemoEntrySpec` referencia categoria por apelido e ganha `canceled?: true`. A montagem usa `Category.create`/`inactivate`, `Card.create`/`inactivate`, `Entry.create` + `markAsPaid` + `cancel` (mesmas invariantes de produção). A inativação de categoria e cartão é aplicada **depois** de criar os lançamentos (senão `Entry.create` recusaria).
- `DemoDatasetStore.replaceIfStale`: `build()` passa a devolver também `categories`; a troca apaga `entries`, depois `cards` e `categories` do dono e insere `categories`, `cards`, `entries`, na mesma transação com advisory lock. A exclusão fica na implementação do store (infrastructure), sem método `deleteAllOf` novo nos repositórios de domínio (ISP; ver 14.8).

---

## 11. Estrutura da api (acréscimos)

```
api/src/modules/finance/
  domain/
    category/      category.ts, category.repository.ts, value-objects/{category-id,category-name,category-type}.ts,
                   events/category-events.ts, errors/category-errors.ts
    card/          card.ts (+inactivate/reactivate), errors (+CardInactiveError), events (+CardInactivated/Reactivated)
    entry/         entry.ts (+cancel/reactivate), new-entry-input.ts (categoryId), errors (+NotCancelable, NotReactivatable),
                   events (+EntryCanceled/Reactivated); REMOVIDOS: category-catalog.ts, value-objects/category.ts
    billing/       invoice-payment-state.ts
    payment/       entry-payment.service.ts (payOne, canceledIds)
  application/
    ports/         category-read-model.ts (list, findById), demais alterados
    errors/        + CategoryNotFoundError
    use-cases/categories/  create-category.ts, rename-category.ts, inactivate-category.ts, reactivate-category.ts, list-categories.ts
    use-cases/cards/       + inactivate-card.ts, reactivate-card.ts
    use-cases/entries/     + cancel-entry.ts, reactivate-entry.ts; list-categories.ts sai daqui
  infrastructure/
    repositories/  prisma-category.repository.ts; REMOVIDO prisma-category-catalog.ts
    read-models/   category-read-model.prisma.ts (reescrito)
    mappers/       category.mapper.ts, entry-sql.ts (+EFFECTIVE_ENTRY)
  presentation/http/
    categories.controller.ts (reescrito), schemas/category.schemas.ts, presenters/category.presenter.ts
```

`api/test/architecture.spec.ts`: `domain/category/**` sem Nest/Prisma; nenhum import de `category-catalog` restante.

---

## 12. Plano de testes por camada

Convenções do ADR 0001/0005 (dois donos por padrão, `TZ=America/Sao_Paulo`, cobertura >= 80% em domain/application). `TRUNCATE` passa a incluir `categories`. Builders novos: `aCategory()`, `aCanceledEntry({ before })`.

### 12.1 Domain (unitário)
- `CategoryName`: NFC/trim/colapso, 0 e 51 code points, `key` sem caixa e com acento.
- `Category`: criar (violações acumuladas), `rename` no-op exato x troca de caixa, `inactivate`/`reactivate` idempotentes sem evento e sem `updatedAt` na segunda chamada (P10), `reference()`.
- `Card`: `inactivate`/`reactivate` idempotentes; `update` não altera situação.
- `Entry.create`: categoria de tipo diferente, inativa, cartão inativo (ordem dos 422), dono divergente -> invariante.
- `Entry.cancel`: tabela por `type x method x status` (PENDING PIX/CARD, PAID PIX ok com `paidAt` mantido, RECEIVED ok, PAID CARD -> `CARD_INVOICE_PAID`, CANCELED -> false sem evento).
- `Entry.reactivate`: volta a cada status anterior; `paidAt` preservado; `NOT_CANCELED`; cartão com `invoice.hasPaidEntries` -> `INVOICE_HAS_PAYMENTS`; cartão sem `invoice` ou com fatura de outra chave -> invariante; PIX com `invoice` -> invariante.
- `Entry.restore`: snapshots incoerentes rejeitados (CANCELED sem `statusBeforeCancel`, CARD com antes `PAID`, `paidAt` sem PAID, `canceledAt < paidAt`). Propriedade com fast-check: qualquer sequência de `markAsPaid`/`cancel`/`reactivate` mantém `assertConsistent` e `cancel` seguido de `reactivate` restaura o snapshot (exceto `updatedAt`).
- `InvoicePaymentState.of`: chave divergente -> invariante; `hasPaidEntries`.
- `EntryPaymentService`: lote com receita e cancelado -> erro com as duas listas completas e nenhum aggregate mutado; `payOne`.
- `buildDemoDataset`: >= 5 categorias de despesa e 2 de receita, 1 categoria inativa com lançamentos, 1 cartão inativo com histórico, cancelados com antes `PENDING`, `PAID` e `RECEIVED`.

### 12.2 Application (unitário com fakes)
Fakes: `InMemoryCategoryRepository` (simula unicidade e a corrida no `insert`), `InMemoryCategoryReadModel`, `InMemoryEntryRepository.findByInvoiceForUpdate`.
- `CreateCategory`: sucesso; 409 com `existing` ativo/inativo; corrida no insert com releitura; 400.
- `RenameCategory`: 404 de outro dono; 409 excluindo a própria; troca de caixa aceita.
- `Inactivate/ReactivateCategory` e `Inactivate/ReactivateCard`: 404 de outro dono; idempotência sem `update`.
- `CreateEntry`: precedência 400 > 404 cartão > 404 categoria > 422; categoria de outro dono = 404.
- `CancelEntry`: 404, idempotência sem `saveAll`, 422 cartão pago, eventos publicados só se mudou.
- `ReactivateEntry`: PIX/receita sem leitura da fatura; cartão chama `findByInvoiceForUpdate` (não `findByIdsForUpdate`); `INVOICE_HAS_PAYMENTS`.
- `MarkEntryAsPaid`/`PayEntriesInBatch`: `canceledIds`; lote `[A, C]` não paga A (CA21).
- `ListExpenses/ListIncomes`: `categoryId` e `includeCanceled` repassados; `status` + `includeCanceled`.

### 12.3 Infrastructure (integração, Postgres real)
- **Migração** (CA13, CA14, RNF03): banco no estado da Feature A com Ana (despesas "alimentação"/"Alimentação", receita "Alimentação") e Bruno; snapshot de contagem/resumo/série/distribuição por dono e mês; aplicar 1-3; reexecutar o bloco `data-step` e conferir que nada muda; aplicar 4; comparar snapshot. Banco vazio migra sem erro.
- **CHECKs e FK**: insert direto violando cada CHECK novo; lançamento com categoria de outro dono ou de outro tipo falha pela FK; `UPDATE categories SET type` de categoria em uso falha.
- `PrismaCategoryRepository`: unicidade por (dono, tipo, chave); mesma chave em tipos diferentes e donos diferentes permitida; 409 em corrida.
- `PrismaEntryRepository`: `saveAll` para cada transição; guarda `statusAtLoad` (linha alterada por fora -> erro); `findByInvoiceForUpdate` com cancelados.
- **Concorrência** (CA22, R6): duas conexões reais com barreira: pagar x cancelar (PIX e cartão), `PayInvoice` x `CancelEntry`, `ReactivateEntry` x `PayEntriesInBatch` na mesma fatura (sem deadlock, resultado serial válido).
- **Read models com cancelados** (R2): para cada um (`summary`, `monthlySeries`, `expenseDistribution`, `listByMonth`, `listEntries`, `listExpenses`, `listIncomes`), um dataset com despesa cancelada (antes PENDING e antes PAID) e receita cancelada, de dois donos; asserção dos totais exatos e da presença só com `includeCanceled`. Fatura só com cancelados some.
- `CategoryReadModel`: ordem ativas/inativas, `inUse`, dois donos.
- Perf (RNF04).

### 12.4 Presentation (e2e, supertest)
- Rotas novas: 401 sem sessão (tabela de rotas do ADR 0005 atualizada), 400/404/409/422 com `details` exatos (`existing`, `reason`, `canceledIds`).
- `POST /api/entries` com `category` -> `UNKNOWN_FIELD`; precedência com corpo inválido + categoria inexistente.
- CA01-CA24 e CA27 no que é API, com Ana e Bruno logados.
- Demo: `GET /api/demo/categories`; parâmetros novos; POST/PATCH em `/api/demo/*` -> 404 `ROUTE_NOT_FOUND` (CA25).
- Teste de "seguro por padrão" do ADR 0005 atualizado com as rotas novas (nenhuma pública).

### 12.5 Web
- Vitest: `entryActions` (tabela de exibição de Cancelar/Reativar/Pagar por status e modo), parser/serializer de `canceled`, `categoryId`, `inactive`; combobox de categoria (filtra por tipo, limpa ao trocar tipo, criar, 409 ativo seleciona, 409 inativo oferece reativar); mapeamento de `reason` para mensagem; `CategoriesScreen` em `readOnly`.
- Playwright + axe (stub): CA06, CA09-CA11, CA15-CA20, CA23-CA27, 360 px e 1280 px, dois temas.

### 12.6 Matriz CA -> camada

| CA | Domain | Application | Infra (int) | e2e API | Web |
|---|---|---|---|---|---|
| 01-03 | CategoryName, Category | CreateCategory | unicidade | sim | tela |
| 04-05 | rename | RenameCategory | join nome atual | sim | tela |
| 06-07 | inactivate/reactivate | idem | read model | sim | drawer, filtros |
| 08 | - | 404 por dono | dois donos | sim | - |
| 09-11 | - | - | - | - | combobox |
| 12 | Entry.create | CreateEntry | FK composta | sim | - |
| 13-14 | - | - | migração | - | - |
| 15-16 | Card | Inactivate/ReactivateCard | listAll | sim | /cards |
| 17-18 | cancel | CancelEntry | read models | sim | abas |
| 19-20 | reactivate, InvoicePaymentState | ReactivateEntry | lock da fatura | sim | motivo |
| 21 | EntryPaymentService | pagamentos | - | sim | - |
| 22 | - | - | concorrência | - | - |
| 23-24, 27 | - | List* | read models | sim | abas |
| 25 | template | - | store | demo | demo |
| 26 | - | - | - | - | axe |

---

## 13. Decisões, alternativas descartadas e trade-offs

| # | Decisão | Alternativas descartadas | Trade-off |
|---|---|---|---|
| D1 (T2) | `Category` aggregate no `finance` | Contexto próprio "Classificação"; manter texto + tabela auxiliar | Sem fronteira artificial; o `finance` cresce um aggregate. |
| D2 (T3) | `inactivated_at` em cartão e categoria | `active boolean`; tabela de histórico | Situação + instante numa coluna; sem histórico de várias inativações (fora de escopo). |
| D3 (T3) | FK composta `(category_id, user_id, type)` | Trigger; só validação na aplicação | Integridade de dono e tipo no banco, sem SQL fora do Prisma (se o Prisma aceitar; senão trigger, como D6 do ADR 0005). Exige o índice único redundante `(id, user_id, type)`. |
| D4 (B1, T1) | `status_before_cancel` + reativação como desfazer exato | Sempre `PENDING`; sem reativação; tabela de eventos de status | Uma coluna e CHECKs mais longos; em troca, reativar nunca cria estado que não existiu. |
| D5 (B1) | "Fatura paga" avaliada por lançamento (cartão `PAID` não cancela) | Bloquear qualquer lançamento de fatura com algum `PAID`; permitir cancelar cartão pago | Regra local ao aggregate, sem consulta à fatura no cancelamento. Uma despesa pendente de fatura parcialmente paga pode ser cancelada (reduz só o pendente), mas depois não pode ser reativada enquanto houver `PAID` na fatura (assimetria aceita e explicada na UI pelo motivo). |
| D6 | `CreateEntry` sem lock de cartão/categoria | `SELECT ... FOR SHARE` dentro do UoW | Corrida "inativar enquanto cria" pode gerar um lançamento novo num cartão/categoria recém-inativado. Impacto baixo (inativo continua aceitando referência histórica) e evita transação e lock em toda criação. |
| D7 (T5) | Criar/reativar categoria na escolha do combobox | Find-or-create dentro de `POST /api/entries` (`newCategoryName`) | `CreateEntry` continua com uma responsabilidade (SRP) e o erro de nome aparece no campo, antes de salvar; aceita categoria órfã (P03). |
| D8 | Reativação de cartão trava a fatura inteira em ordem de id | Advisory lock por fatura; nível SERIALIZABLE | Mesma técnica e ordem de lock já usadas pelos pagamentos, sem deadlock; trava no máximo as despesas de uma fatura. |
| D9 (R2) | Fragmento `EFFECTIVE_ENTRY` + teste por read model | View SQL `effective_entries`; coluna gerada `is_effective` | Mudança mínima nos `$queryRaw`; a disciplina depende de revisão e dos testes de integração. View fica como evolução se surgirem novos read models. |
| D10 (T4) | `type` obrigatório em `GET /api/categories` | Lista mista com campo `type` | Força o consumidor a respeitar a separação por tipo; quebra o contrato atual (já quebrado por R4, mesmo corte). |
| D11 | `inUse` na categoria em vez de rota de "opções de filtro" | `?usage=filter`; rota separada | Um contrato só para tela, drawer e filtros; custo de um `EXISTS` indexado por categoria. |
| D12 (T6) | Quatro migrations, passo de dados idempotente | Uma migration só (sugestão da spec) | Necessário pelo enum (`ADD VALUE` não pode ser usado na mesma transação) e para testar reexecução antes do drop. |

---

## 14. Violações de SOLID e problemas no código atual que afetam a feature

1. **SRP/OCP - `PrismaEntryRepository.saveAll`** (`infrastructure/repositories/prisma-entry.repository.ts:43-52`) fixa `e.type = 'EXPENSE' AND e.status = 'PENDING'` e só persiste `status`, `paid_at`, `updated_at`. O repositório codifica a regra da única transição existente; qualquer transição nova (cancelar `PAID`/`RECEIVED`, reativar) falharia com "contrato de lock violado". Ação: guarda genérica por `statusAtLoad` e colunas novas (7.4).
2. **Duplicação de regra de pagamento (SRP/DRY)** - `MarkEntryAsPaid` chama `entry.markAsPaid` direto, enquanto lote e fatura usam `EntryPaymentService`. A regra "cancelado não paga" teria de ser escrita em dois lugares com `details` diferentes. Ação: `EntryPaymentService.payOne` (4.5).
3. **Totais de receita sem filtro de status** - `monthly-summary-read-model.prisma.ts:16` e `dashboard-read-model.prisma.ts:19` somam `type = 'INCOME'` sem status. Correto hoje por acaso (toda receita é `RECEIVED`), errado com receita cancelada. `invoice-read-model.prisma.ts:34-36` usa `COUNT(*)`/`MAX` sem status. Ação: `EFFECTIVE_ENTRY` (8).
4. **Categoria como texto espalhado** - VO `Category` em `domain/entry`, port `CategoryCatalog` no domain, `NewEntryInput.withCanonicalCategory`, `EntryRecord.category` lido em `toDomain` e `GROUP BY category_key` com `array_agg` no dashboard. Tudo sai; o conceito passa a ter um único dono (aggregate `Category`).
5. **`CreateEntry` monta a view à mão** (`toEntryView(entry, card)`), conhecendo nome de cartão e, agora, teria de conhecer nome de categoria. Ação: reler por `EntryReadModel.findById`, como `MarkEntryAsPaid` já faz (uma fonte de verdade para o DTO).
6. **OCP - `assertConsistent` de `Entry`** é uma cadeia de `if` por tipo/status. Com `CANCELED` e `statusBeforeCancel`, cresceria em combinações. Ação: tabela declarativa de combinações permitidas (`type x method x status x before`) consultada pela função.
7. **`CardNameTakenError` sem contexto** - construído no repositório a partir do P2002, sem como informar o cartão existente (P04). Ação: `details.existing` preenchido pelo use case (releitura), mantendo o repositório como único conhecedor do código Prisma.
8. **ISP - `EntryRepository.deleteAllOf`** (ADR 0005 4.2) põe no contrato de domínio uma operação que só a demo usa. Com categorias, a tentação seria repetir em `CategoryRepository`. Ação aqui: a limpeza da demo fica dentro do `PrismaDemoDatasetStore`. Recomenda-se ao ADR 0005 remover `deleteAllOf` do repositório (não editado por este ADR).
9. **`PrismaCardRepository.isNameKeyViolation`** usa `/name_key/`, que também casaria com `categories_owner_type_name_key_uq` se o executor fosse compartilhado num fluxo futuro. Ação: casar pelo nome exato da constraint.

---

## 15. Consequências, perguntas e próximos passos

- **Positivas:** nenhum dado some (sem `DELETE`); categoria renomeável com efeito retroativo; integridade de dono e tipo no banco; reativação sem efeitos colaterais; regra de efetividade num único fragmento SQL testado em cada read model; domínio sem dependências de framework.
- **Negativas:** quebra de contrato em `POST /api/entries`, `GET /api/categories`, filtros e `Entry` (corte único api + web + stub); quatro migrations; CHECKs de `entries` mais complexos; um `EXISTS` por categoria na listagem; reativação de cartão trava a fatura.
- **Perguntas (não bloqueantes; adotadas as respostas abaixo):**
  - **Q1** "Fatura já paga" foi interpretada por lançamento (D5): despesa de cartão `PAID` não cancela; despesa de cartão `PENDING` de fatura parcialmente paga cancela. Se o usuário quiser bloquear o cancelamento de **qualquer** despesa de uma fatura que tenha pagamento, muda só `CancelEntry` (passa a travar a fatura e usar `InvoicePaymentState`, como a reativação).
  - **Q2** Reativar um lançamento não cancelado responde 422 `NOT_CANCELED` (como a spec), e não sucesso idempotente. O web evita o duplo envio desabilitando a ação durante a transição.
- **Próximo passo:** aprovação do usuário; ui-designer (tela de categorias, combobox "selecionar ou criar", selos, diálogos de cancelar pendente x pago); tester (red) a partir da matriz 12.6.
