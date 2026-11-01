# ADR 0001 - Lançamentos financeiros (receitas e despesas), cartões, faturas, pagamento em lote e dashboard mensal

- **Status:** Aceito (aprovado pelo usuário em 2026-10-24, rev. 3)
- **Data:** 2026-10-24 (revisão 3)
- **Spec:** `docs/specs/lancamentos-financeiros.md` (revisão 3)
- **Design:** `docs/design/lancamentos-financeiros.md` (revisão 3)
- **Autor:** architect
- **Escopo:** `api/` (NestJS 12 ESM, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL) e `web/` (Next.js 16 App Router, Tailwind 4)

### Histórico

| Revisão | Mudança |
|---|---|
| 1 | Versão inicial sobre a spec rev. 1 (tudo é despesa, sem cartões, só tema escuro). |
| 2 | Spec rev. 2: tipo RECEITA/DESPESA, cartões (aggregate próprio), mês de referência calculado e gravado, "Pagar fatura", novos filtros/totais/saldos com sinal, dashboard revisado, erros 422/409, tema claro/escuro. B1-B5 viraram decisões; B6/B7 adotados provisoriamente. Módulo renomeado de `entries` para `finance`. |
| 3 | Spec rev. 3: **mês de referência no cartão = mês do vencimento da fatura**, calculado em duas etapas por função pura de domínio (`calculateInvoiceDates`) que produz `closingDate`, `dueDate` e `referenceMonth`, as três gravadas no lançamento. Formas de pagamento só `PIX` e `CARD` (remove `ACCOUNT`). Status inicial por forma: despesa PIX nasce `PAID` por padrão (campo opcional `paid`, `false` -> `PENDING`), despesa no cartão sempre `PENDING`, regras de 400 da P31. B6 e B7 resolvidas (só seletor de mês, mês obrigatório; receita futura no realizado). **B8 e B9 aprovadas pelo usuário** (PIX com data futura nasce pago; fatura exibe a maior data de fechamento e a maior de vencimento). Novos contratos: resumo do mês (`GET /api/summary`), listagens separadas de despesas e de receitas com subtotal pelos filtros da aba, faturas do mês (com `pendingCount`) e despesas de uma fatura por bloco (cartão + mês, sob demanda); resposta da criação com `referenceMonth` e `invoice.{closingDate, dueDate}`. Remove filtro por tipo, intervalo `fromMonth/toMonth`, "ver tudo" e o resumo de fatura C4. Dashboard por mês de referência reaproveita o resumo. CHECKs, índices, queries, impacto no web (abas, atalho "+ Novo cartão", URL com os nomes do design rev. 3) e plano de testes refeitos (matriz CA01-CA87). 8 tokens novos do ui-designer incluídos no tema e na matriz de contraste. |
| 4 | B3 foi parcialmente supersedida: despesas podem ser editadas por ADMIN, sem exclusão. Campos, autorização e política de recálculo da fatura estão documentados na extensão da spec e em `docs/api/finance.md`. |

---

## 0. Decisões de negócio

### 0.1 Decididas pelo usuário (spec, seção 3)

B1 (categoria texto livre, case-insensitive), B2 (RECEITA/DESPESA, regras de pagamento, saldos realizado/previsto), B3 (decisão original de não editar/excluir, parcialmente supersedida: edição administrativa permitida, exclusão continua fora), B4 (cartões, mês de referência gravado, pagar fatura), B5 (dashboard), Design D1-D4, D5 (tema claro/escuro), **B6** (só seletor de mês, mês obrigatório, sem intervalo), **B7** (receita com data futura conta no saldo realizado), **B8** (despesa PIX com data futura nasce PAGA), **B9** (fatura exibe a maior data de fechamento e a maior de vencimento entre suas despesas), **B10** (mês de referência no cartão = mês do vencimento), **B11** (PIX e cartão; PIX pago por padrão; cartão pendente), **B12** (tela com abas), **B13** (atalho "+ Novo cartão"), **B14** (dashboard por mês de referência), DR1-DR8. Premissas P01-P36 adotadas integralmente. **Não há premissas de negócio pendentes nesta revisão.**

### 0.2 Como B8 e B9 entram no desenho

| Id | Decisão | Onde está no ADR |
|---|---|---|
| **B8** | Despesa PIX com **data futura** nasce `PAID` como qualquer PIX, sem exceção (simétrico a B7): a data só define o mês de referência; `paidAt` = instante da criação. A UI **não** marca "Ainda não paguei" automaticamente para datas futuras. Risco R9 aceito. | Invariante 3 de `Entry` (sec. 3.5): o status inicial depende só de tipo, forma e `paid`, nunca da data; por isso o domínio **não** precisa de "hoje" nem de fuso (nenhum port `BusinessCalendar`). Drawer sem regra por data (sec. 9.4). Testes com data futura em 11.1/11.2. |
| **B9** | Quando as despesas de uma fatura (cartão + mês de referência) têm datas divergentes (cartão editado no meio do ciclo), a fatura exibe a **maior** `closingDate` e a **maior** `dueDate` entre elas, sem aviso nesta entrega. A ordenação das faturas usa essa mesma `dueDate`. A lista expansível não mostra datas por despesa. | `MAX(closing_date)`/`MAX(due_date)` em `InvoiceReadModel.listByMonth` (sec. 8.5); comentário no `InvoiceRow` (sec. 5.1); teste de integração "B9" (sec. 11.3). Domínio e schema não dependem de B9: as datas são gravadas por lançamento (P32), e a regra de exibição fica restrita ao read model (trocá-la no futuro é mudança de uma query). |

---

## 1. Contexto

- `api/src` contém apenas `main.ts`, `app.module.ts`, `AppController`/`AppService` e o spec do controller. Não há `src/modules/`, `prisma/`, `prisma.config.ts`, migrations, `@prisma/client`, validação, gerador de UUID v7 nem testcontainers. **Nenhum código das revisões 1 e 2 foi implementado**, portanto esta revisão substitui o desenho anterior sem custo de migração de código ou dados (inclusive a remoção do valor `ACCOUNT` e a inclusão das colunas de datas da fatura).
- `web/app` é o template do `create-next-app`: `layout.tsx` com Geist e `lang="en"`; `globals.css` com `--background/--foreground` e troca de tema **apenas** por `@media (prefers-color-scheme)`. Recharts, Vitest e Playwright não estão instalados.
- `docs/design/design-system.md` define tokens só do tema escuro e cita `apps/web/src/styles/tokens.css` (caminho inexistente).
- `docs/design/lancamentos-financeiros.md` está na **rev. 3** (concluída): valores do tema claro, 8 tokens novos, tela com abas, bloco de fatura, drawer com PIX/Cartão e "Ainda não paguei", atalho "+ Novo cartão". O design não nomeia endpoints e lista três dependências para o ADR, atendidas assim:

| Pedido do design rev. 3 | Atendimento |
|---|---|
| (a) A fonte de faturas do mês traz a quantidade de despesas **pendentes** por fatura (para a confirmação de "Pagar fatura") | `InvoiceDto.pendingCount` em I1 (sec. 6.1/6.2), calculado no SQL (`COUNT(*) FILTER (WHERE status = 'PENDING')`, sec. 8.5). O web não calcula a contagem. |
| (b) As despesas de uma fatura são buscáveis **por bloco** (cartão + mês de referência), carregadas ao expandir | I2 `GET /api/cards/:cardId/invoices/:referenceMonth/entries` (sem paginação, DR7) e Server Action de leitura `loadInvoiceEntries(cardId, referenceMonth)` chamada na expansão (sec. 9.2). |
| (c) A resposta da criação traz `referenceMonth` e a data de vencimento (e de fechamento, no cartão) para o toast | `EntryDto` de E1 com `referenceMonth` (sempre) e `invoice: { closingDate, dueDate }` (CARD; `null` no PIX), além de `card.name` (sec. 6.1). |

Este ADR fixa também os padrões transversais (erros 400/404/409/422, validação, ids, relógio, transação, tema, testes).

---

## 2. Bounded context e linguagem ubíqua

### 2.1 Bounded context: **Finanças pessoais** (`api/src/modules/finance/`)

Um único bounded context com **dois aggregates**: `Card` e `Entry`.

**Card é aggregate próprio, mas não contexto próprio.** Avaliação:

| Critério | Conclusão |
|---|---|
| Ciclo de vida | Independente: cartão é criado e editado sem tocar lançamentos (DR2) e lançamentos são criados/pagos sem alterar o cartão. -> **aggregate separado**. |
| Invariantes | As do cartão (nome 1-50, dias 1-31) são locais; a unicidade do nome é entre cartões (use case + índice único). Nenhuma invariante exige cartão e lançamentos na mesma transação de escrita. -> **fronteiras de consistência distintas**. |
| Linguagem | "Fechamento", "vencimento", "fatura", "mês de referência" são a mesma linguagem do lançamento; o cálculo das datas da fatura precisa dos dias de fechamento e vencimento no momento da criação. |
| Separar em contexto "Cartões" | Exigiria ACL/integração síncrona para ler os dias na criação e para "Pagar fatura"/"Faturas do mês", duplicação dos conceitos de fatura e de mês de referência, sem equipe ou modelo diferente que justifique. **Descartado.** Reavaliar se surgirem limite de crédito, fatura fechada/aberta e juros (fora de escopo). |

Referência entre aggregates **somente por id** (`Entry.cardId: CardId`). Na criação, o use case entrega ao `Entry` um snapshot imutável `CardBillingInfo { cardId, closingDay, dueDay }` (sec. 3.3); o lançamento nunca guarda nem consulta o cartão depois.

**Fatura não é aggregate.** Continua sem estado próprio (sem fechada/aberta, sem pagamento parcial, sem "fatura vazia", DR5): é o conjunto das despesas de um cartão com o mesmo mês de referência. Modelada como VO `InvoiceKey { cardId, referenceMonth }` (critério de seleção) e, na leitura, como projeção `InvoiceView` (sec. 5.1). As datas exibidas são derivadas das datas **gravadas nos lançamentos** (P32, B9), não do cartão atual. Um aggregate `Invoice` contendo os lançamentos foi descartado porque colocaria cada despesa em duas fronteiras de consistência e obrigaria a travar a fatura em toda criação de compra.

**Dashboard e resumo do mês** são o lado de leitura (CQRS leve) do mesmo contexto. O resumo do mês é um único caso de uso (RF10) consumido pelo topo da tela de lançamentos e pelos cards do dashboard.

**Shared kernel** (`api/src/shared/`): `Money`, `CalendarDate`, `YearMonth`, `Result`, `AppError`, `DomainEvent`, `AggregateRoot`; ports `Clock`, `IdGenerator`, `DomainEventPublisher`; infraestrutura comum (Prisma, filtro de erros, pipe zod).

### 2.2 Idioma e mapeamento 1:1 (decisão T8)

Código, rotas, campos JSON e enums em **inglês**; UI e documentação em pt-BR. O tester traduz os payloads dos CAs por esta tabela. Ex.: CA07 vira `{ "type": "EXPENSE", "description": "Aluguel", "category": "Moradia", "date": "2026-10-05", "amount": "1500.00", "paymentMethod": "PIX" }` e espera `"status": "PAID", "paidAt": "2026-10-05T13:00:00.000Z", "referenceMonth": "2026-10", "invoice": null`; CA08 acrescenta `"paid": false`.

| pt-BR (negócio/UI) | Código / API |
|---|---|
| Lançamento | `Entry` / recurso `entries` |
| Tipo RECEITA / DESPESA | `type`: `"INCOME"` / `"EXPENSE"` (VO `EntryType`) |
| Descrição | `description` (VO `Description`) |
| Categoria | `category` (VO `Category`) |
| Data do lançamento | `date` (`CalendarDate`, `"YYYY-MM-DD"`) |
| Valor | `amount` (`Money`) |
| Forma de pagamento PIX / CARTAO | `paymentMethod`: `"PIX"` / `"CARD"` (VO `PaymentMethod`) |
| "Ainda não paguei" / indicador `pago` | `paid?: boolean` na criação (omitido = `true` para PIX); "Ainda não paguei" = `paid: false` |
| Cartão | `Card` / recurso `cards`; no lançamento `cardId` (entrada) e `card: { id, name }` (saída) |
| Nome do cartão | `name` (VO `CardName`) |
| Dia de fechamento / vencimento | `closingDay` (VO `ClosingDay`) / `dueDay` (VO `DueDay`) |
| Dia efetivo | `DayOfMonth.effectiveIn(month)` |
| Data de fechamento / vencimento da fatura | `closingDate` / `dueDate` (`CalendarDate`); no lançamento `invoice: { closingDate, dueDate }` |
| Datas da fatura (fechamento, vencimento, mês de referência) | VO `InvoiceDates`, calculado por `calculateInvoiceDates` |
| Mês de referência | `referenceMonth` (VO `ReferenceMonth`, `"YYYY-MM"`) |
| Fatura | `InvoiceKey { cardId, referenceMonth }` / projeção `InvoiceView`; subrecurso `cards/:cardId/invoices/:referenceMonth` |
| Faturas do mês | `ListInvoices` / `GET /api/invoices?month=` |
| Quantidade de despesas / pendentes da fatura | `entryCount` / `pendingCount` |
| Despesas da fatura (lista expansível) | `ListInvoiceEntries` / `GET /api/cards/:cardId/invoices/:referenceMonth/entries` |
| Pagar fatura | `PayInvoice` / `POST /api/cards/:cardId/invoices/:referenceMonth/pay` |
| Status PENDENTE / PAGO / RECEBIDA | `status`: `"PENDING"` / `"PAID"` / `"RECEIVED"` |
| Marcar como pago | `markAsPaid` / `POST /api/entries/:id/pay` |
| Pagamento em lote | `PayEntriesInBatch` / `POST /api/entries/pay` |
| Data de pagamento | `paidAt` |
| Resumo do mês | `MonthlySummary` / `GET /api/summary?month=` -> `totals` |
| Subtotal da aba Despesas / Receitas | `subtotal: { total, paid, pending }` / `subtotal: { total }` |
| Receitas; despesas total / pagas / pendentes | `totals.income`; `totals.expenses.total` / `.paid` / `.pending` |
| Saldo realizado / previsto | `totals.balance.realized` / `.projected` |
| Série / Distribuição | `MonthlySeries` / `CategoryDistribution` |
| Filtro "PIX/sem cartão" | `cardId=pix` (API) |
| Tema claro / escuro | `theme`: `"light"` / `"dark"` (web) |

---

## 3. Modelo de domínio

Local: `api/src/modules/finance/domain/{billing,card,entry,payment,totals}/` e `api/src/shared/domain/`. **Nenhum import de NestJS, Prisma, zod, uuid ou pacote externo.** Apenas TypeScript/ECMAScript (inclusive `BigInt`).

### 3.1 Value objects do shared kernel

#### `Money` (com sinal) - decisão T9

Inteiro em centavos com `BigInt`, **com sinal**. Um único tipo para valores de lançamento, subtotais, totais e saldos.

- `Money` em geral pode ser negativo (saldos, R7). A regra "> 0 e <= 9999999999.99" é invariante do **valor de lançamento** e vive em `Money.parseEntryAmount` (chamado por `NewEntryInput`); totais nunca passam por ela (podem exceder 12 dígitos, P02).
- Parse estrito, sem trim, sem arredondamento, nunca via `Number`: regex `^-?\d+(\.\d+)?$`; fora dela `INVALID_FORMAT` (`"abc"`, `"1e3"`, `" 10"`, `".5"`, `"10."`, `"1,50"`); mais de 2 casas `TOO_MANY_DECIMALS` (inclusive `"10.120"`, P01); em `parseEntryAmount`: `<= 0` -> `MUST_BE_POSITIVE`, `> 999999999999` centavos -> `TOO_LARGE`.
- `toString()`: 2 casas, sinal `-` só para negativos, zero nunca vira `"-0.00"`.

```ts
// api/src/shared/domain/value-objects/money.ts
export type MoneyViolation = 'INVALID_FORMAT' | 'TOO_MANY_DECIMALS' | 'MUST_BE_POSITIVE' | 'TOO_LARGE';

export class Money {
  static readonly ZERO: Money;
  static readonly MAX_ENTRY_AMOUNT: Money;                               // 9999999999.99
  static parse(value: string): Result<Money, MoneyViolation>;            // com sinal, até 2 casas
  static parseEntryAmount(value: string): Result<Money, MoneyViolation>; // > 0 e <= MAX
  static fromCents(cents: bigint): Money;
  static sum(values: readonly Money[]): Money;
  add(other: Money): Money;
  subtract(other: Money): Money;
  negate(): Money;
  sign(): -1 | 0 | 1;
  isZero(): boolean;
  isNegative(): boolean;
  compare(other: Money): -1 | 0 | 1;
  equals(other: Money): boolean;
  toCents(): bigint;
  toString(): string;                                                    // "-150.00"
}
```

Alternativa descartada: VO separado `SignedMoney`/`Balance` - duplicaria parse/aritmética/serialização; a positividade do valor de lançamento já está no ponto de entrada (`parseEntryAmount`) e no CHECK do banco.

#### `CalendarDate`

Data civil `{ year, month, day }`, parse `^\d{4}-\d{2}-\d{2}$` com validação de calendário por aritmética pura (bissexto), ano 0001-9999. Nunca construída via `new Date(string)` (R2).

```ts
export class CalendarDate {
  static parse(value: string): Result<CalendarDate, 'INVALID_FORMAT' | 'INVALID_DATE'>;
  /** Pré-condição: day em 1..month.lengthInDays(); violação -> InvariantViolationError. */
  static of(month: YearMonth, day: number): CalendarDate;
  get day(): number;
  get yearMonth(): YearMonth;
  compare(other: CalendarDate): -1 | 0 | 1;
  isAfter(other: CalendarDate): boolean;
  equals(other: CalendarDate): boolean;
  toString(): string;            // "2026-10-05"
}
```

#### `YearMonth`

Aritmética de mês civil, sem significado de negócio.

```ts
export class YearMonth {
  static parse(value: string): Result<YearMonth, 'INVALID_FORMAT'>; // "YYYY-MM", mês 01-12, ano 0001-9999
  lengthInDays(): 28 | 29 | 30 | 31;
  next(): YearMonth;                 // 2026-12 -> 2027-01
  minusMonths(n: number): YearMonth; // 2026-10 - 11 = 2025-11
  firstDay(): CalendarDate;
  compare(other: YearMonth): -1 | 0 | 1;
  equals(other: YearMonth): boolean;
  toString(): string;                // "2026-10"
}
```

### 3.2 Value objects do contexto

| VO | Regras | Violações |
|---|---|---|
| `EntryId`, `CardId` | UUID minúsculo; aceita qualquer versão (bem formado e inexistente -> 404; mal formado -> 400). Ids **gerados** são v7 (port `IdGenerator`). | `INVALID_FORMAT` |
| `EntryType` | `'INCOME' \| 'EXPENSE'`. Imutável no aggregate. | `INVALID_VALUE` |
| `PaymentMethod` | `'PIX' \| 'CARD'`. `CONTA`/`ACCOUNT`/`DINHEIRO` não existem (CA14). | `INVALID_VALUE` |
| `EntryStatus` | `'PENDING' \| 'PAID' \| 'RECEIVED'` (decisão T10: enum único; `RECEIVED` só para INCOME). | - |
| `Description` | NFC + trim, 1-120 **code points**. | `REQUIRED`, `TOO_LONG` |
| `Category` | NFC + trim + colapso de espaços, 1-50 code points; `key = value.toLocaleLowerCase('pt-BR')`; `equals` por `key`; acentos diferenciam (P04). Grafia canônica resolvida pelo use case via `CategoryCatalog`. | `REQUIRED`, `TOO_LONG` |
| `CardName` | NFC + trim + colapso de espaços, 1-50 code points; `key` como em `Category` (P18). | `REQUIRED`, `TOO_LONG` |
| `DayOfMonth` (base) | Inteiro 1-31; `effectiveIn(month) = min(value, month.lengthInDays())`. Recebe `number` do zod; rejeita não inteiro aqui. | `NOT_INTEGER`, `OUT_OF_RANGE` |
| `ClosingDay`, `DueDay` | Subtipos nominais de `DayOfMonth` (não intercambiáveis por tipo). `DueDay` agora **participa do cálculo** (P20 rev. 3). | idem |
| `ReferenceMonth` | Mês de competência; envolve `YearMonth`. Fábricas `forPix(date)` e `ofDueDate(dueDate)`. | `INVALID_FORMAT` |
| `InvoiceDates` | `{ closingDate, dueDate, referenceMonth }` de uma compra no cartão (3.3). | - (invariantes de construção) |
| `InvoiceKey` | `{ cardId: CardId; referenceMonth: ReferenceMonth }`. | - |
| `CardBillingInfo` | Snapshot `{ cardId, closingDay, dueDay }` produzido por `Card.billingInfo()`. | - |

### 3.3 Cálculo das datas da fatura e do mês de referência (puro, testável) - RF05, RNF05, R4, T17

A regra é uma **função pura de domínio** em `domain/billing/`, sem I/O, sem relógio e sem fuso: depende só da data civil da compra e dos dias do cartão vigentes na criação. Não existe outra implementação (nem no SQL, nem no web, P24).

```ts
// api/src/modules/finance/domain/billing/day-of-month.ts
export abstract class DayOfMonth {
  get value(): number;
  /** Dia efetivo = min(value, último dia do mês). */
  effectiveIn(month: YearMonth): number;
}
export class ClosingDay extends DayOfMonth {
  static create(value: number): Result<ClosingDay, 'NOT_INTEGER' | 'OUT_OF_RANGE'>;
}
export class DueDay extends DayOfMonth {
  static create(value: number): Result<DueDay, 'NOT_INTEGER' | 'OUT_OF_RANGE'>;
}

// api/src/modules/finance/domain/billing/invoice-dates.ts
export class InvoiceDates {
  get closingDate(): CalendarDate;
  get dueDate(): CalendarDate;
  get referenceMonth(): ReferenceMonth;            // sempre ReferenceMonth.ofDueDate(dueDate)
  /**
   * Reidrata datas gravadas (mapper). Valida as relações estruturais
   * (purchaseDate <= closingDate < dueDate; closing no mês da compra ou no seguinte;
   * due no mês do fechamento ou no seguinte; referenceMonth = mês de dueDate).
   * Violação -> InvariantViolationError. NÃO recalcula a partir do cartão (DR2).
   */
  static restore(p: { purchaseDate: CalendarDate; closingDate: CalendarDate; dueDate: CalendarDate }): InvoiceDates;
  equals(other: InvoiceDates): boolean;
}

// api/src/modules/finance/domain/billing/calculate-invoice-dates.ts
/** RF05 em duas etapas. Função pura, total (definida para toda data e todo par de dias 1..31). */
export function calculateInvoiceDates(
  purchaseDate: CalendarDate,
  closingDay: ClosingDay,
  dueDay: DueDay,
): InvoiceDates;

// api/src/modules/finance/domain/billing/reference-month.ts
export class ReferenceMonth {
  static parse(value: string): Result<ReferenceMonth, 'INVALID_FORMAT'>;
  static of(month: YearMonth): ReferenceMonth;
  /** PIX (despesa ou receita): mês da data do lançamento. */
  static forPix(date: CalendarDate): ReferenceMonth;
  /** CARD: mês/ano da data de vencimento da fatura. */
  static ofDueDate(dueDate: CalendarDate): ReferenceMonth;
  get yearMonth(): YearMonth;
  minusMonths(n: number): ReferenceMonth;
  compare(other: ReferenceMonth): -1 | 0 | 1;
  equals(other: ReferenceMonth): boolean;
  toString(): string; // "2026-11"
}
```

**Algoritmo** (especificação, não implementação):

1. **Fechamento:** `m = purchaseDate.yearMonth`; `F = closingDay.effectiveIn(m)`. Se `purchaseDate.day <= F` -> `closingDate = (m, F)`; senão `closingDate = (m.next(), closingDay.effectiveIn(m.next()))`.
2. **Vencimento** (estritamente após o fechamento): `c = closingDate.yearMonth`; `V = dueDay.effectiveIn(c)`. Se `V > closingDate.day` -> `dueDate = (c, V)`; senão `dueDate = (c.next(), dueDay.effectiveIn(c.next()))`.
3. **Mês de referência** = `ReferenceMonth.ofDueDate(dueDate)`.

Exemplos que travam os casos contraintuitivos (CA21): #7 (fecha 10, vence 10) -> 10/10 e 10/11; #18 (fecha 31, vence 30, compra 28/02/2026) -> fechamento 28/02, vencimento ajustado 28/02 não é estritamente após -> 30/03; #20 (fecha 28, vence 30, compra 29/01/2026) -> fechamento 28/02, vencimento 30/03.

**Propriedades verificáveis por teste** (para todas as datas de 2026-2028 x fechamento 1..31 x vencimento 1..31):
(a) `purchaseDate <= closingDate < dueDate`;
(b) `closingDate` está no mês da compra ou no seguinte; `dueDate` está no mês do fechamento ou no seguinte (logo `referenceMonth` está entre o mês da compra e dois meses depois);
(c) `closingDate.day = closingDay.effectiveIn(closingDate.yearMonth)` e `dueDate.day = dueDay.effectiveIn(dueDate.yearMonth)`;
(d) minimalidade: não existe data de fechamento efetivo `>= purchaseDate` anterior a `closingDate`, nem vencimento efetivo `> closingDate` anterior a `dueDate`;
(e) `referenceMonth = dueDate.yearMonth`;
(f) monotonicidade: compras posteriores no mesmo cartão nunca produzem `dueDate` anterior.

O cálculo acontece **uma única vez**, dentro de `Entry.create`; `Entry` não expõe método que altere datas da fatura ou mês de referência, e `Card.update` não conhece lançamentos (DR2, CA05). A função fica em `billing/` (e não como método de `Card` ou de `Entry`) para ser importada por ambos sem ciclo e testada isoladamente pela tabela CA21.

### 3.4 Aggregate `Card`

Estado: `id, name: CardName, closingDay: ClosingDay, dueDay: DueDay, createdAt, updatedAt`.

Invariantes: (1) nome 1-50 após normalização; (2) dias 1-31 inteiros (vencimento pode ser menor, igual ou maior que o fechamento); (3) `updatedAt >= createdAt`; (4) **unicidade de `name.key` entre cartões** - invariante de conjunto, garantida pelo use case (`CardRepository.findByNameKey`) e, contra corrida, pelo índice único `cards_name_key_uq` (o repositório traduz a violação em `CardNameTakenError`).

```ts
// api/src/modules/finance/domain/card/card.ts
export interface CardProps { name: string; closingDay: number; dueDay: number; }

export class Card extends AggregateRoot<CardDomainEvent> {
  /** Lança CardValidationError com TODAS as violações. Emite CardCreated. */
  static create(props: CardProps & { id: CardId; now: Date }): Card;
  static restore(snapshot: CardSnapshot): Card;
  /** Substitui os três campos (PUT). Sem mudança efetiva: no-op (sem updatedAt nem evento). Retorna se mudou. */
  update(props: CardProps, now: Date): boolean;
  billingInfo(): CardBillingInfo;           // { cardId, closingDay, dueDay }
  get id(): CardId; get name(): CardName; get closingDay(): ClosingDay; get dueDay(): DueDay;
  toSnapshot(): CardSnapshot;
}
```

### 3.5 Aggregate `Entry`

Estado: `id, type, description, category, date, amount, paymentMethod, cardId | null, invoiceDates: InvoiceDates | null, referenceMonth, status, paidAt | null, createdAt, updatedAt`.

**Invariantes**

1. `type` é obrigatório e imutável.
2. `INCOME` => `status = RECEIVED`, `paymentMethod = PIX`, `cardId = null`, `invoiceDates = null`, `paidAt = null`, para sempre (B7: data futura não muda nada).
3. `EXPENSE` => `status ∈ {PENDING, PAID}`. **Status inicial (B11, P31):** `PIX` -> `PAID` com `paidAt = now` quando `paid` é omitido ou `true`, `PENDING` quando `paid = false`; **independe da data do lançamento, inclusive futura (B8)**; `CARD` -> sempre `PENDING`.
4. `paymentMethod = CARD` <=> `cardId != null` <=> `invoiceDates != null`; `CARD` => `EXPENSE`.
5. `status = PAID` <=> `paidAt != null`; `paidAt >= createdAt` (PIX pago na criação: `paidAt = createdAt`, mesmo `Clock`, T13).
6. `PAID` é terminal: não existe método que volte a `PENDING` (CA28).
7. `referenceMonth` é calculado em `create`; `restore` aceita os valores gravados sem recalcular, validando só a coerência estrutural (`InvoiceDates.restore`). Em `updateExpense`, PIX deriva a referência da nova data; para cartão pendente, uma nova data recalcula a fatura com o calendário vigente, mas sem mudança da data mantém-se o snapshot histórico. Alterar a data de cartão pago é proibido. Tipo, forma, cartão, status e `paidAt` não são alteráveis por esse caso de uso.
8. `amount` > 0 e <= `9999999999.99`; `description` 1-120; `category` 1-50.
9. `markAsPaid` em despesa já paga (inclusive PIX que nasceu paga) é no-op (sem mudar `paidAt`/`updatedAt`, sem evento). Em receita lança `IncomeNotPayableError` (DR1) sem alterar nada.
10. `updatedAt >= createdAt`.

Validação em duas etapas, para respeitar a precedência 400 > 404 (sec. 6.4) sem perder o acúmulo de violações (CA19):

```ts
// api/src/modules/finance/domain/entry/new-entry-input.ts
export interface RawEntryInput {
  type: string; description: string; category: string; date: string;
  amount: string; paymentMethod: string; cardId: string | null;
  /** undefined = omitido (distinto de false). */
  paid: boolean | undefined;
}
/** Valida tudo que não depende de I/O, inclusive consistência tipo x forma x cartão x paid (CA09, CA11, CA12). */
export class NewEntryInput {
  /** Lança EntryValidationError com TODAS as violações (field + code). */
  static parse(raw: RawEntryInput): NewEntryInput;
  get type(): EntryType; get paymentMethod(): PaymentMethod; get cardId(): CardId | null;
  get paid(): boolean | undefined; get date(): CalendarDate; get category(): Category; /* ... */
  withCanonicalCategory(category: Category): NewEntryInput;
}

// api/src/modules/finance/domain/entry/entry.ts
export class Entry extends AggregateRoot<EntryDomainEvent> {
  /**
   * CARD: invoiceDates = calculateInvoiceDates(date, card.closingDay, card.dueDay); referenceMonth = invoiceDates.referenceMonth.
   * PIX: referenceMonth = ReferenceMonth.forPix(date).
   * Define o status inicial (invariante 3) e emite EntryCreated.
   * `card` é obrigatório se e somente se input.paymentMethod = CARD e deve ter o mesmo id;
   * divergência é erro de programação (InvariantViolationError -> 500), não de entrada.
   */
  static create(props: { id: EntryId; input: NewEntryInput; card: CardBillingInfo | null; now: Date }): Entry;
  static restore(snapshot: EntrySnapshot): Entry; // valida invariantes 2-5, 7 e 10; sem eventos
  /** true se houve transição; false se já PAID. Lança IncomeNotPayableError para INCOME. */
  markAsPaid(at: Date): boolean;
  isIncome(): boolean;
  get id(): EntryId; get type(): EntryType; get status(): EntryStatus; get amount(): Money;
  get referenceMonth(): ReferenceMonth; get invoiceDates(): InvoiceDates | null; get cardId(): CardId | null; /* ... */
  toSnapshot(): EntrySnapshot;
}
```

Códigos de violação de consistência (todos 400, campo indicado):

| Situação | Campo: código |
|---|---|
| `INCOME` com `paymentMethod = CARD` | `paymentMethod: NOT_ALLOWED_FOR_INCOME` |
| `INCOME` com `cardId` informado | `cardId: NOT_ALLOWED_FOR_INCOME` |
| `INCOME` com `paid` informado (`true` ou `false`) | `paid: NOT_ALLOWED_FOR_INCOME` (P31) |
| `CARD` sem `cardId` | `cardId: REQUIRED` |
| `PIX` com `cardId` | `cardId: NOT_ALLOWED_FOR_PIX` |
| `CARD` com `paid: true` | `paid: NOT_ALLOWED_FOR_CARD` (P31; `false` ou omitido é aceito) |

`cardId: null` explícito equivale a omitido. `paid: null` ou `"true"` são barrados antes pelo zod (`INVALID_TYPE`).

### 3.6 `FinancialTotals` e `ExpenseTotals` (VOs) - fórmula única

Os somatórios vêm do banco (RF18); as derivações (total de despesas e saldos) são feitas **uma vez**, aqui, com `Money` exato. As invariantes de CA49 valem por construção no resumo, nos subtotais, nas faturas e na série.

```ts
// api/src/modules/finance/domain/totals/expense-totals.ts
export class ExpenseTotals {
  static readonly ZERO: ExpenseTotals;
  /** Lança InvariantViolationError se algum componente for negativo. */
  static of(p: { paid: Money; pending: Money }): ExpenseTotals;
  get paid(): Money;
  get pending(): Money;
  get total(): Money;             // paid + pending
}

// api/src/modules/finance/domain/totals/financial-totals.ts
export class FinancialTotals {
  static readonly ZERO: FinancialTotals;
  static of(p: { income: Money; expenses: ExpenseTotals }): FinancialTotals;
  get income(): Money;
  get expenses(): ExpenseTotals;
  get realizedBalance(): Money;   // income - expenses.paid  (B7: inclui receitas de data futura)
  get projectedBalance(): Money;  // income - expenses.total (sempre <= realized)
}
```

`ExpenseTotals` é reutilizado pelo subtotal da aba Despesas e pelos totais de cada fatura; o subtotal da aba Receitas é um `Money`.

### 3.7 Domain service `EntryPaymentService`

Puro, usado por `PayEntriesInBatch` e `PayInvoice`:

```ts
export interface PaymentOutcome { paid: Entry[]; alreadyPaid: Entry[]; }
export class EntryPaymentService {
  /**
   * Se houver qualquer INCOME, lança IncomesNotPayableError com TODOS os ids de receita,
   * antes de alterar qualquer aggregate (DR1, CA32). Caso contrário, aplica markAsPaid(at) a todos.
   */
  payAll(entries: readonly Entry[], at: Date): PaymentOutcome;
}
```

### 3.8 Domain events

| Evento | Quando | Payload |
|---|---|---|
| `CardCreated` | `Card.create` | `cardId, name, closingDay, dueDay, occurredAt` |
| `CardUpdated` | `Card.update` com mudança | `cardId, before {name, closingDay, dueDay}, after {...}, occurredAt` |
| `EntryCreated` | `Entry.create` | `entryId, type, amount, date, paymentMethod, cardId, closingDate, dueDate, referenceMonth, status, paidAt, categoryKey, occurredAt` |
| `EntryPaid` | `markAsPaid` com transição | `entryId, amount, paidAt, cardId, referenceMonth` |

PIX que nasce `PAID` emite **só** `EntryCreated` (com `status: PAID` e `paidAt`), não `EntryPaid`: não houve transição de estado. Um consumidor futuro de "pagamentos" deve escutar os dois. Publicados pelo use case **após o commit** via `DomainEventPublisher` (in-process, sem assinantes, sem outbox). Lote e fatura emitem um `EntryPaid` por despesa alterada; não há evento de lote nem `InvoicePaid`.

### 3.9 Erros

```ts
export type ErrorKind = 'validation' | 'not_found' | 'conflict' | 'business_rule';
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly kind: ErrorKind;
  readonly details: unknown;
}
export interface FieldViolation { field: string; code: string; message: string; }
```

| Classe | Camada | code | kind -> HTTP | details |
|---|---|---|---|---|
| `EntryValidationError`, `CardValidationError` | domain | `VALIDATION_ERROR` | validation -> 400 | `{ fields: FieldViolation[] }` |
| `InvalidQueryError` | application | `VALIDATION_ERROR` | validation -> 400 | `{ fields: FieldViolation[] }` |
| `EntryNotFoundError` | application | `ENTRY_NOT_FOUND` | not_found -> 404 | `{ id }` |
| `EntriesNotFoundError` | application | `ENTRIES_NOT_FOUND` | not_found -> 404 | `{ missingIds: string[] }` |
| `CardNotFoundError` | application | `CARD_NOT_FOUND` | not_found -> 404 | `{ id }` |
| `CardNameTakenError` | domain | `CARD_NAME_TAKEN` | conflict -> 409 | `{ fields: [{ field: "name", code: "NAME_TAKEN", message }] }` |
| `IncomeNotPayableError` | domain | `ENTRY_NOT_PAYABLE` | business_rule -> 422 | `{ incomeIds: [id] }` |
| `IncomesNotPayableError` | domain | `ENTRIES_NOT_PAYABLE` | business_rule -> 422 | `{ incomeIds: string[] }` |
| `InvariantViolationError` | domain | `INTERNAL_ERROR` | (não mapeado) -> 500 | `null` |

O filtro HTTP mapeia só `kind -> status`; novos erros não alteram o filtro (OCP). `CardNameTakenError` usa `details.fields` para o web reaproveitar o renderizador de erro inline (tela de cartões **e** atalho "+ Novo cartão", CA75). Códigos confirmam a sugestão T2 da spec, como o design rev. 3 pressupõe.

---

## 4. Interfaces de repositório (domain)

```ts
// api/src/modules/finance/domain/card/card.repository.ts
export interface CardRepository {
  /** Lança CardNameTakenError se o índice único de name_key for violado (corrida). */
  insert(card: Card): Promise<void>;
  /** Idem; persiste name, closingDay, dueDay, updatedAt. */
  update(card: Card): Promise<void>;
  findById(id: CardId): Promise<Card | null>;
  findByNameKey(key: string): Promise<Card | null>;
}

// api/src/modules/finance/domain/entry/entry.repository.ts
export interface EntryRepository {
  /** Persiste também closingDate, dueDate e referenceMonth calculados; status/paidAt iniciais. */
  insert(entry: Entry): Promise<void>;
  /** Exige transação (UnitOfWork). Lock exclusivo em ordem de id asc; ids inexistentes não aparecem. */
  findByIdsForUpdate(ids: readonly EntryId[]): Promise<Entry[]>;
  /** Exige transação. Despesas PENDING do cartão com esse mês de referência (= mês do vencimento), travadas em ordem de id asc (DR4, P21). */
  findPendingByInvoiceForUpdate(key: InvoiceKey): Promise<Entry[]>;
  /** Persiste status, paidAt, updatedAt de despesas existentes (guarda status = PENDING). */
  saveAll(entries: readonly Entry[]): Promise<void>;
}

// api/src/modules/finance/domain/entry/category-catalog.ts
export interface CategoryCatalog {
  /** Grafia canônica (primeiro uso, receitas e despesas - P23) ou null. */
  findByKey(key: string): Promise<Category | null>;
}
```

Não há `findById` de `Entry` sem lock: o único fluxo que altera lançamentos é o pagamento.

---

## 5. Application: ports e use cases

Local: `api/src/modules/finance/application/` e `api/src/shared/application/`. Sem NestJS: use cases são classes simples, instanciadas por `useFactory` com `inject: [TOKEN...]`; tokens `Symbol` exportados junto das interfaces.

### 5.1 Ports

```ts
// shared/application/ports
export interface Clock { now(): Date; }                                                          // CLOCK
export interface IdGenerator { next(): string; }                                                  // ID_GENERATOR (UUID v7)
export interface DomainEventPublisher { publish(events: readonly DomainEvent[]): Promise<void>; } // DOMAIN_EVENT_PUBLISHER

// finance/application/ports/finance-unit-of-work.ts                                             // FINANCE_UNIT_OF_WORK
export interface FinanceTransactionScope { entries: EntryRepository; cards: CardRepository; }
export interface FinanceUnitOfWork {
  /** Uma transação; exceção -> rollback e relança. */
  run<T>(work: (scope: FinanceTransactionScope) => Promise<T>): Promise<T>;
}

// finance/application/ports/views.ts
export interface EntryView {
  id: string; type: EntryType; description: string; category: string; date: CalendarDate;
  amount: Money; paymentMethod: PaymentMethod; card: { id: string; name: string } | null;
  invoice: { closingDate: CalendarDate; dueDate: CalendarDate } | null;
  referenceMonth: ReferenceMonth; status: EntryStatus; paidAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface Page<T> { items: T[]; totalItems: number; }
export interface Paging { page: number; pageSize: number; }   // page >= 1; pageSize 1..100

// finance/application/ports/entry-read-model.ts                                                 // ENTRY_READ_MODEL
export type ExpenseCardFilter = { kind: 'any' } | { kind: 'card'; cardId: CardId } | { kind: 'pix' };
export interface ExpenseListCriteria {
  month: ReferenceMonth;                    // obrigatório (B6, P14)
  status?: 'PENDING' | 'PAID';
  categoryKey?: string;
  card: ExpenseCardFilter;
  paging: Paging;
}
export interface IncomeListCriteria { month: ReferenceMonth; categoryKey?: string; paging: Paging; }
export interface ExpenseSubtotalRow { paid: Money; pending: Money; }
export interface EntryReadModel {
  /** Página ordenada por date DESC, created_at DESC, id DESC + subtotal sobre TODO o conjunto filtrado (DR6). */
  listExpenses(c: ExpenseListCriteria): Promise<Page<EntryView> & { subtotal: ExpenseSubtotalRow }>;
  listIncomes(c: IncomeListCriteria): Promise<Page<EntryView> & { subtotal: Money }>;
  findById(id: EntryId): Promise<EntryView | null>;
}

// finance/application/ports/monthly-summary-read-model.ts                                       // MONTHLY_SUMMARY_READ_MODEL
export interface TotalsRow { income: Money; paidExpenses: Money; pendingExpenses: Money; }
export interface MonthlySummaryReadModel {
  /** Mês inteiro, sem filtros (RF10, DR6). */
  summary(month: ReferenceMonth): Promise<TotalsRow>;
}

// finance/application/ports/invoice-read-model.ts                                               // INVOICE_READ_MODEL
export interface InvoiceRow {
  card: { id: string; name: string };
  referenceMonth: ReferenceMonth;
  closingDate: CalendarDate;  // MAX entre as despesas da fatura (B9)
  dueDate: CalendarDate;      // MAX entre as despesas da fatura (B9)
  entryCount: number;
  pendingCount: number;       // pedido (a) do design rev. 3: confirmação de "Pagar fatura"
  paid: Money; pending: Money;
}
export interface InvoiceReadModel {
  /** Uma linha por cartão com >= 1 despesa no mês (DR5); ordem dueDate asc, nome do cartão, id. */
  listByMonth(month: ReferenceMonth): Promise<InvoiceRow[]>;
  /** Todas as despesas de UMA fatura (bloco = cartão + mês), sem paginação, date DESC, created_at DESC, id DESC (DR7). */
  listEntries(key: InvoiceKey): Promise<EntryView[]>;
}

// finance/application/ports/card-read-model.ts                                                  // CARD_READ_MODEL
export interface CardView { id: string; name: string; closingDay: number; dueDay: number; createdAt: Date; updatedAt: Date; }
export interface CardReadModel {
  listAll(): Promise<CardView[]>;                   // ordenado por nome
  findById(id: CardId): Promise<CardView | null>;
}

// finance/application/ports/category-read-model.ts                                              // CATEGORY_READ_MODEL
export interface CategoryReadModel { listDistinct(): Promise<string[]>; }

// finance/application/ports/dashboard-read-model.ts                                             // DASHBOARD_READ_MODEL
export interface MonthlyRow { month: ReferenceMonth; totals: TotalsRow; }
export interface CategoryShare { category: string; total: Money; percentage: string; }   // "75.00"
export interface DashboardReadModel {
  monthlySeries(from: ReferenceMonth, to: ReferenceMonth): Promise<MonthlyRow[]>; // um por mês, com zeros
  expenseDistribution(month: ReferenceMonth): Promise<CategoryShare[]>;           // só EXPENSE, desc
}
```

ISP: escrita (repositórios), catálogo, listagens, resumo, faturas, cartões, categorias e dashboard são ports distintos; cada use case depende só do que usa. O resumo saiu do `DashboardReadModel` porque agora tem dois consumidores (tela de lançamentos e dashboard) e um único use case (RF10, RF15). Read models devolvem somatórios crus (`TotalsRow`, `ExpenseSubtotalRow`); os use cases os convertem em `FinancialTotals`/`ExpenseTotals`.

Helper de aplicação compartilhado (SRP, evita repetir parsing em 8 use cases): `application/queries/query-params.ts` com `parseRequiredMonth(raw, field)`, `parsePaging(page?, pageSize?)`, `parseCategoryKey(raw?)` (via `Category.create(...).key`), `parseExpenseCardFilter(raw?)`; todos acumulam `FieldViolation` e lançam um único `InvalidQueryError`.

### 5.2 Use cases

| Use case | Input | Output | Dependências | Erros (em ordem de precedência) |
|---|---|---|---|---|
| `CreateCard` | `{ name: string; closingDay: number; dueDay: number }` | `CardView` | `CardRepository`, `IdGenerator`, `Clock`, `DomainEventPublisher` | `CardValidationError` > `CardNameTakenError` |
| `ListCards` | `{}` | `{ items: CardView[] }` | `CardReadModel` | - |
| `UpdateCard` | `{ id: string; name; closingDay; dueDay }` | `CardView` | `CardRepository`, `Clock`, `DomainEventPublisher` | `InvalidQueryError`/`CardValidationError` > `CardNotFoundError` > `CardNameTakenError` |
| `CreateEntry` | `RawEntryInput` (inclui `paid?`) | `EntryView` (com `referenceMonth` e `invoice`) | `EntryRepository`, `CardRepository`, `CategoryCatalog`, `IdGenerator`, `Clock`, `DomainEventPublisher` | `EntryValidationError` > `CardNotFoundError` |
| `MarkEntryAsPaid` | `{ id: string }` | `EntryView` | `FinanceUnitOfWork`, `EntryReadModel`, `Clock`, `DomainEventPublisher` | `InvalidQueryError` > `EntryNotFoundError` > `IncomeNotPayableError` |
| `PayEntriesInBatch` | `{ ids: string[] }` | `{ paidIds: string[]; alreadyPaidIds: string[] }` | `FinanceUnitOfWork`, `EntryPaymentService`, `Clock`, `DomainEventPublisher` | `InvalidQueryError` > `EntriesNotFoundError` > `IncomesNotPayableError` |
| `PayInvoice` | `{ cardId: string; referenceMonth: string }` | `{ cardId; referenceMonth; paidIds: string[]; paidCount: number; paidAmount: Money }` | `FinanceUnitOfWork`, `EntryPaymentService`, `Clock`, `DomainEventPublisher` | `InvalidQueryError` > `CardNotFoundError` |
| `GetMonthlySummary` | `{ month: string }` | `{ month: ReferenceMonth; totals: FinancialTotals }` | `MonthlySummaryReadModel` | `InvalidQueryError` |
| `ListExpenses` | `{ month: string; status?; category?; cardId?; page?; pageSize? }` (strings) | `{ month; items: EntryView[]; pagination: { page; pageSize; totalItems; totalPages }; subtotal: ExpenseTotals }` | `EntryReadModel` | `InvalidQueryError` |
| `ListIncomes` | `{ month: string; category?; page?; pageSize? }` | `{ month; items; pagination; subtotal: Money }` | `EntryReadModel` | `InvalidQueryError` |
| `ListInvoices` | `{ month: string }` | `{ month; items: { card; referenceMonth; closingDate; dueDate; entryCount; pendingCount; totals: ExpenseTotals }[] }` | `InvoiceReadModel` | `InvalidQueryError` |
| `ListInvoiceEntries` | `{ cardId: string; referenceMonth: string }` | `{ card: { id; name }; referenceMonth; items: EntryView[] }` | `CardReadModel`, `InvoiceReadModel` | `InvalidQueryError` > `CardNotFoundError` |
| `ListCategories` | `{}` | `{ items: string[] }` | `CategoryReadModel` | - |
| `GetMonthlySeries` | `{ month: string }` | `{ from; to; points: { month; totals: FinancialTotals }[] }` (12) | `DashboardReadModel` | `InvalidQueryError` |
| `GetCategoryDistribution` | `{ month: string }` | `{ month; total: Money; items: CategoryShare[] }` | `DashboardReadModel` | `InvalidQueryError` |

Removidos em relação à rev. 2: `ListEntries` (substituído por `ListExpenses` + `ListIncomes`) e `GetInvoiceSummary` (substituído por `ListInvoices`, cujo item já traz `pendingCount` e `pending` para a confirmação de "Pagar fatura").

**Fluxos**

- **CreateCard**: `Card.create` (acumula violações) -> `findByNameKey(name.key)`; existe -> `CardNameTakenError` -> `insert` (índice único como última barreira) -> publica `CardCreated`. É o mesmo use case da tela `/cards` e do atalho "+ Novo cartão" (RF01, CA03, CA75).
- **UpdateCard**: valida `id` e props (400) -> `findById` (404) -> `findByNameKey`; se existe com **outro** id -> 409 -> `card.update(props, now)`; se mudou, `update` + publica `CardUpdated`. Last-write-wins aceito (sem multiusuário). Nenhum lançamento é tocado (DR2): datas da fatura e mês de referência gravados ficam como estão (CA05).
- **CreateEntry** (precedência 400 > 404):
  1. `NewEntryInput.parse(raw)` -> 400 com todas as violações (inclui CA09 `paid: true` no cartão, CA11, CA12).
  2. Se `CARD`: `cards.findById(cardId)` -> null -> `CardNotFoundError` (CA13). Os dias lidos são os vigentes no instante da criação (RF05); edição concorrente é resolvida por "quem leu primeiro", aceitável.
  3. `catalog.findByKey(category.key)` -> grafia canônica (CA20).
  4. `now = clock.now()` (uma leitura); `Entry.create({ id: idGenerator.next(), input, card: card?.billingInfo() ?? null, now })` -> calcula `InvoiceDates`/`ReferenceMonth` e status inicial (`paidAt = createdAt = now` no PIX pago, qualquer que seja a data, B8) -> `insert` (FK garante que o cartão existe).
  5. Publica `EntryCreated`; retorna view com `referenceMonth`, `card: { id, name }` do cartão já carregado e `invoice: { closingDate, dueDate }` (CA22; pedido (c) do design: insumo do toast da RF23).
- **MarkEntryAsPaid**: em `uow.run`: `findByIdsForUpdate([id])` (vazio -> 404) -> `entry.markAsPaid(now)` (receita -> 422, CA27) -> se mudou `saveAll`. Após commit: publica e retorna `entryReadModel.findById(id)`. PIX que nasceu paga: sucesso sem alteração (CA25).
- **PayEntriesInBatch** (RF07, P07):
  1. 1..100 itens na lista **bruta** (T3), cada um UUID -> 400 (`ids`, `ids[3]`).
  2. Dedup preservando a primeira ocorrência (CA35).
  3. `uow.run`: `found = findByIdsForUpdate(ids)`; `missing` não vazio -> `EntriesNotFoundError(missing)` (todos, CA31/CA33); `paymentService.payAll(found, now)` -> receitas -> `IncomesNotPayableError(todas)` (CA32); `saveAll(outcome.paid)`. Todas as checagens antes de qualquer escrita; rollback cobre o resto (CA34).
  4. Após commit: publica `EntryPaid`. Retorno na ordem do request deduplicado.
- **PayInvoice** (RF08, DR4):
  1. `cardId` UUID e `referenceMonth` `YYYY-MM` válido -> senão 400 (CA41).
  2. `uow.run`: `cards.findById` -> 404; `found = entries.findPendingByInvoiceForUpdate({ cardId, referenceMonth })` - o mês é o **do vencimento** (CA39), seleção no instante da execução (P21); `paymentService.payAll(found, now)` (nunca há receita: CHECK `CARD => EXPENSE`; se houvesse, 500 por invariante); `saveAll`.
  3. Resposta: `paidIds`, `paidCount`, `paidAmount = Money.sum(...)`; sem pendências -> `[]`, `0`, `"0.00"` (CA40).
  Sem limite de quantidade (seleção do servidor, um cartão/mês); timeout de transação (10 s) como proteção.
- **GetMonthlySummary**: `parseRequiredMonth` -> `summary(month)` -> `FinancialTotals.of(...)`. Sem filtros por construção: a assinatura do port não aceita filtros (DR6, CA47).
- **ListExpenses**: `month` obrigatório (`REQUIRED`/`INVALID_FORMAT`, CA46/CA57); `status ∈ PENDING|PAID` (`RECEIVED` ou outro -> `INVALID_VALUE`); `cardId` UUID ou literal `pix` (outro -> `INVALID_FORMAT`); `category` normalizada via `Category.create(...).key` (vazia -> 400); `page >= 1` (padrão 1), `pageSize` 1..100 (padrão 20). Cartão inexistente bem formado -> vazio com subtotal zero (P19). `totalPages = ceil(totalItems / pageSize)`; página além do fim -> `items: []` com metadados corretos.
- **ListIncomes**: `month` obrigatório; `category` opcional; paginação igual. Não aceita `status`/`cardId` (rejeitados pelo schema estrito da query, sec. 6.5).
- **ListInvoices**: `month` obrigatório; mapeia cada `InvoiceRow` para `ExpenseTotals.of({ paid, pending })`, preservando `entryCount` e `pendingCount`. Lista vazia quando nenhum cartão tem despesa no mês (CA44). A ordenação vem do SQL e é verificada no teste de integração.
- **ListInvoiceEntries** (pedido (b) do design): valida `cardId`/`referenceMonth` (400) -> `cardReadModel.findById` (404) -> `invoiceReadModel.listEntries(key)`; cartão existente sem despesas no mês -> `items: []` (não 404: a UI só pede isso para faturas listadas; o caso só ocorre em corrida ou URL manual).
- **Dashboard**: `GetMonthlySeries` calcula `from = month.minusMonths(11)`, `to = month` e afirma 12 pontos. Cards do dashboard usam `GetMonthlySummary` (RF15).

### 5.3 Concorrência e atomicidade - decisão T6 (inalterada)

Transação interativa + `SELECT ... FOR UPDATE` **ordenado por id** + regra no aggregate + `UPDATE` com guarda `status = 'PENDING'`.

- Lote x lote: o segundo espera o commit do primeiro e, em `READ COMMITTED`, relê a versão nova (PAID) -> trata como já paga; `paidAt` único (CA37).
- Lote x fatura: `findPendingByInvoiceForUpdate` filtra `status = 'PENDING'`; quando a linha travada é liberada já como PAID, o Postgres reavalia o `WHERE` na versão nova (EvalPlanQual) e **a exclui**. Se a fatura travou primeiro, o lote vê PAID e reporta em `alreadyPaidIds`. Em ambos: um `paidAt`, conjuntos de pagos disjuntos e totais consistentes (CA37).
- Mesma ordem de lock (id asc) em lote, fatura e individual -> sem deadlock entre eles.
- `READ COMMITTED`, `timeout` 10 s, `maxWait` 5 s.
- Criação de lançamento não trava nada: uma compra criada durante "Pagar fatura" não é vista pelo `FOR UPDATE` já executado e fica PENDING (P21, R6).

Descartados: somente `UPDATE ... WHERE status='PENDING' RETURNING` (regra sai do aggregate; mantido como guarda); lock otimista (`version`, exige retry); `SERIALIZABLE` (retry em falhas de serialização).

---

## 6. Contratos HTTP

Prefixo `/api`. JSON. Instantes ISO-8601 UTC com `Z` e milissegundos; datas civis `YYYY-MM-DD`; meses `YYYY-MM`; valores monetários string com 2 casas e sinal opcional (só em saldos).

### 6.1 DTOs

```jsonc
// CardDto
{ "id": "0192f1e2-...", "name": "Nubank", "closingDay": 25, "dueDay": 5,
  "createdAt": "2026-10-24T13:00:00.000Z", "updatedAt": "2026-10-24T13:00:00.000Z" }

// EntryDto (resposta de E1, itens de E2/E3/I2 e resposta de E4)
{ "id": "0192f1e2-...", "type": "EXPENSE", "description": "Mercado", "category": "Alimentação",
  "date": "2026-10-10", "amount": "250.00", "paymentMethod": "CARD",
  "card": { "id": "0192f1e2-...", "name": "Nubank" },            // null quando PIX
  "invoice": { "closingDate": "2026-10-25", "dueDate": "2026-11-05" }, // null quando PIX
  "referenceMonth": "2026-11",                                    // sempre presente
  "status": "PENDING",                                            // PENDING | PAID | RECEIVED
  "paidAt": null, "createdAt": "...", "updatedAt": "..." }

// TotalsDto (resumo do mês e cada ponto da série)
{ "income": "5000.00",
  "expenses": { "total": "5500.00", "paid": "3000.00", "pending": "2500.00" },
  "balance": { "realized": "2000.00", "projected": "-500.00" } }

// ExpenseTotalsDto (subtotal da aba Despesas e totais de cada fatura)
{ "total": "140.00", "paid": "40.00", "pending": "100.00" }

// PaginationDto
{ "page": 1, "pageSize": 20, "totalItems": 25, "totalPages": 2 }

// InvoiceDto
{ "card": { "id": "0192f1e2-...", "name": "Nubank" }, "referenceMonth": "2026-11",
  "closingDate": "2026-10-25", "dueDate": "2026-11-05",          // MAX entre as despesas (B9)
  "entryCount": 2, "pendingCount": 1,
  "totals": { "total": "140.00", "paid": "40.00", "pending": "100.00" } }
```

`card.name` é o nome **atual** do cartão (join na leitura); datas da fatura e mês de referência são os gravados.

### 6.2 Endpoints

| # | Método e rota | Entrada | Sucesso | Erros |
|---|---|---|---|---|
| C1 | `POST /api/cards` | body `{ name: string, closingDay: integer, dueDay: integer }` (strict) | `201 CardDto` | `400 VALIDATION_ERROR`, `409 CARD_NAME_TAKEN` |
| C2 | `GET /api/cards` | - | `200 { items: CardDto[] }` ordenado por nome | - |
| C3 | `PUT /api/cards/:id` | path UUID; body igual a C1 (substituição completa) | `200 CardDto` | `400`, `404 CARD_NOT_FOUND`, `409 CARD_NAME_TAKEN` |
| I1 | `GET /api/invoices?month=YYYY-MM` | `month` obrigatório | `200 { month, items: InvoiceDto[] }` ordenado por `dueDate` asc, nome do cartão | `400` |
| I2 | `GET /api/cards/:cardId/invoices/:referenceMonth/entries` | path UUID e `YYYY-MM` (um bloco) | `200 { card: { id, name }, referenceMonth, items: EntryDto[] }` (sem paginação, data desc) | `400`, `404 CARD_NOT_FOUND` |
| I3 | `POST /api/cards/:cardId/invoices/:referenceMonth/pay` | path; sem body | `200 { cardId, referenceMonth, paidIds: string[], paidCount, paidAmount }` | `400`, `404 CARD_NOT_FOUND` |
| E1 | `POST /api/entries` | body `{ type, description, category, date, amount, paymentMethod, cardId?, paid? }`; todos string exceto `cardId` (`string \| null`, opcional) e `paid` (`boolean`, opcional); strict (`status`, `referenceMonth`, `closingDate`, `dueDate`, `invoice` e chaves desconhecidas -> 400 `UNKNOWN_FIELD`, CA15) | `201 EntryDto` (com `referenceMonth` e `invoice.{closingDate, dueDate}` no cartão) | `400 VALIDATION_ERROR`, `400 MALFORMED_JSON`, `404 CARD_NOT_FOUND` |
| E2 | `GET /api/entries/expenses` | query `month` (obrigatório), `status?` (`PENDING`\|`PAID`), `category?`, `cardId?` (UUID ou `pix`), `page?` (1), `pageSize?` (20, máx. 100) | `200 { month, items: EntryDto[], pagination: PaginationDto, subtotal: ExpenseTotalsDto }` | `400` |
| E3 | `GET /api/entries/incomes` | query `month` (obrigatório), `category?`, `page?`, `pageSize?` | `200 { month, items: EntryDto[], pagination: PaginationDto, subtotal: { total } }` | `400` |
| E4 | `POST /api/entries/:id/pay` | path UUID; sem body | `200 EntryDto` (idempotente) | `400`, `404 ENTRY_NOT_FOUND`, `422 ENTRY_NOT_PAYABLE` |
| E5 | `POST /api/entries/pay` | body `{ ids: string[] }` (1..100, strict) | `200 { paidIds, alreadyPaidIds }` | `400`, `404 ENTRIES_NOT_FOUND`, `422 ENTRIES_NOT_PAYABLE` |
| E6 | `GET /api/categories` | - | `200 { items: string[] }` | - |
| S1 | `GET /api/summary?month=YYYY-MM` | `month` obrigatório | `200 { month, totals: TotalsDto }` (mês inteiro, sem filtros) | `400` |
| D2 | `GET /api/dashboard/monthly-series?month=YYYY-MM` | idem | `200 { from, to, points: [{ month, totals: TotalsDto }] }` (12) | `400` |
| D3 | `GET /api/dashboard/category-distribution?month=YYYY-MM` | idem | `200 { month, total, items: [{ category, total, percentage }] }` (só despesas) | `400` |

Removidos da rev. 2: `GET /api/entries` (com `type`, `fromMonth/toMonth`, "ver tudo"), `GET /api/cards/:cardId/invoices/:referenceMonth` (C4) e `GET /api/dashboard/summary` (substituído por S1).

Notas:
- **Por que E2 e E3 separados (T8)** em vez de `GET /api/entries?type=`: filtros e subtotal diferentes por tipo (status e cartão só existem para despesas; subtotal `{total, paid, pending}` x `{total}`), o que dá schemas estritos por endpoint (`status=RECEIVED` ou `cardId` em receitas -> 400 em vez de "combinação válida que retorna vazio") e DTOs sem campos opcionais por tipo. Ficam sob `/api/entries/` porque são vistas do mesmo recurso; não há `GET /api/entries/:id`, e as rotas `:id` usam pipe de UUID, então `expenses`/`incomes` nunca colidem.
- **Por que S1 fora de `/dashboard`**: é o mesmo resumo para duas telas (RF10/RF15); um endpoint só garante CA59 ("iguais ao resumo do topo").
- **Por que I1 em `/api/invoices`**: lista transversal a cartões, filtrada por mês; I2/I3 continuam subrecurso de cartão porque a fatura é identificada por (cartão, mês) e o 404 do cartão sai da hierarquia.
- **`pendingCount` em I1** (pedido (a) do design): a confirmação de "Pagar fatura" mostra quantidade e soma pendentes sem chamada extra nem cálculo no cliente. `entryCount` continua para o bloco. Ambos com o mesmo snapshot dos totais (uma query).
- **Por que I2 separado de I1** (pedido (b) do design): a lista é expansível e carregada sob demanda por bloco; com até 20 cartões, embutir as despesas multiplicaria o payload da aba a cada carga. E por que não reutilizar E2 com `cardId` sem paginação: E2 é paginado por contrato (RNF06) e tem semântica de aba; I2 tem semântica de fatura (sem paginação, DR7).
- **Resposta de E1** (pedido (c) do design): `referenceMonth` sempre; `invoice.dueDate` e `invoice.closingDate` quando `CARD` (`invoice: null` no PIX); `card.name` para "do Nubank". O toast não depende de nenhuma outra chamada.
- **`paid`**: `boolean` estrito (`"true"`, `1`, `null` -> `INVALID_TYPE`). Omitido para PIX = pago. Regras P31 na sec. 3.5.
- Por que `PUT` e não `PATCH` em cartões: a edição envia os três campos com as mesmas validações do cadastro (RF03).
- `closingDay: "10"` -> `INVALID_TYPE` (zod); `10.5` -> `NOT_INTEGER`, `0`/`32` -> `OUT_OF_RANGE` (domínio) (CA02).
- `amount` numérico -> 400 `INVALID_TYPE` (CA17). Não há rota de estorno, `PATCH` ou `DELETE` de lançamento (CA28) nem `DELETE` de cartão.
- Três chamadas no dashboard (S1, D2, D3): blocos com loading/erro independentes (RF26).

### 6.3 Formato de erro (RNF04) - decisão T2

```json
{ "code": "ENTRIES_NOT_PAYABLE", "message": "Receitas não podem ser marcadas como pagas.",
  "details": { "incomeIds": ["...R"] } }

{ "code": "VALIDATION_ERROR", "message": "Dados inválidos.",
  "details": { "fields": [{ "field": "paid", "code": "NOT_ALLOWED_FOR_CARD", "message": "Despesa no cartão sempre nasce pendente." }] } }
```

| HTTP | code | Origem |
|---|---|---|
| 400 | `VALIDATION_ERROR` | pipe zod (forma/tipo/chaves, body e query) ou `kind: 'validation'` |
| 400 | `MALFORMED_JSON` | `SyntaxError` do body parser |
| 404 | `ENTRY_NOT_FOUND`, `ENTRIES_NOT_FOUND`, `CARD_NOT_FOUND` | `kind: 'not_found'` |
| 404 | `ROUTE_NOT_FOUND` | `NotFoundException` do Nest |
| 409 | `CARD_NAME_TAKEN` | `kind: 'conflict'` |
| 413 | `PAYLOAD_TOO_LARGE` | body parser |
| 422 | `ENTRY_NOT_PAYABLE`, `ENTRIES_NOT_PAYABLE` | `kind: 'business_rule'` |
| 500 | `INTERNAL_ERROR` | qualquer outro (inclui `InvariantViolationError`); `details: null`, sem stack |

Códigos por campo: `REQUIRED`, `INVALID_TYPE`, `INVALID_FORMAT`, `INVALID_DATE`, `INVALID_VALUE`, `TOO_LONG`, `MUST_BE_POSITIVE`, `TOO_MANY_DECIMALS`, `TOO_LARGE`, `NOT_INTEGER`, `OUT_OF_RANGE`, `UNKNOWN_FIELD`, `EMPTY`, `TOO_MANY_ITEMS`, `NOT_ALLOWED_FOR_INCOME`, `NOT_ALLOWED_FOR_PIX`, `NOT_ALLOWED_FOR_CARD`, `NAME_TAKEN`. Removidos: `NOT_ALLOWED_FOR_ACCOUNT`, `CONFLICTING_FILTERS`, `INVALID_RANGE`. Mensagens em pt-BR.

### 6.4 Precedência de erros (400 > 404 > 422; 409)

Garantida pela **ordem das etapas no use case** (sec. 5.2), não pelo filtro HTTP:

1. **400** - forma (pipe zod, antes do controller) e semântica sem I/O (VOs/`NewEntryInput`/`InvalidQueryError`). Ex.: receita no cartão com `cardId` inexistente -> 400 (CA11); despesa no cartão com `paid: true` e `cardId` inexistente -> 400 (CA09), não 404.
2. **404** - existência (cartão na criação de lançamento, na fatura e na edição; lançamentos no individual/lote, todos os ausentes listados).
3. **422** - regra de negócio sobre ids existentes (receitas no lote, todas listadas; P07: receita + já paga -> 422).
4. **409** - só em cartões: depois de 400 e 404 (`PUT` em cartão inexistente com nome duplicado -> 404).

### 6.5 Validação de entrada

- **zod 4** na presentation (`ZodValidationPipe` em `shared/presentation/pipes/`, schemas em `finance/presentation/http/schemas/`): presença, tipo (string vs number vs boolean), `.strict()`, tamanho do array, formato UUID/`YYYY-MM`. Nunca importado por domain/application.
- **Queries também são estritas** (mudança da rev. 3): parâmetro desconhecido -> 400 `UNKNOWN_FIELD`. Isso cumpre CA57 ("parâmetros de intervalo de/até -> 400") e impede que `type`, `fromMonth`, `toMonth` ou `period` da rev. 2 sejam silenciosamente ignorados. Parâmetro repetido (`?month=a&month=b`) -> `INVALID_TYPE`.
- **Domínio/aplicação**: semântica (normalização e comprimentos, calendário, `Money`, dias 1-31, consistência tipo x forma x cartão x `paid`).
- O zod barra primeiro (forma); só payloads bem formados chegam ao domínio. Para CA19 ("todas as violações juntas"), o zod reporta todas as violações de forma de uma vez, e o domínio todas as semânticas de uma vez.
- Descartado `class-validator` (coerção implícita de tipos, risco para `amount` e `paid`).

---

## 7. Persistência: schema Prisma, constraints, índices e migration

### 7.1 Setup (Prisma 7 + adapter-pg)

- `api/prisma/schema.prisma`, generator `prisma-client`, `output = "../src/shared/infrastructure/prisma/generated"` (no `.gitignore`); `api/prisma.config.ts` com `DATABASE_URL`.
- `PrismaService` com `new PrismaPg({ connectionString })`, `PrismaModule` global.
- Dependências: `@prisma/client`, `zod`, `uuid`; dev `@testcontainers/postgresql`, `fast-check` (testes de propriedade do domínio, sec. 11.1).

### 7.2 Schema

```prisma
enum EntryType {
  INCOME
  EXPENSE
  @@map("entry_type")
}

enum PaymentMethod {
  PIX
  CARD
  @@map("payment_method")
}

enum EntryStatus {
  PENDING
  PAID
  RECEIVED
  @@map("entry_status")
}

model Card {
  id         String   @id @db.Uuid
  name       String   @db.VarChar(50)
  nameKey    String   @unique(map: "cards_name_key_uq") @map("name_key") @db.VarChar(100)
  closingDay Int      @map("closing_day") @db.SmallInt
  dueDay     Int      @map("due_day") @db.SmallInt
  createdAt  DateTime @map("created_at") @db.Timestamptz(3)
  updatedAt  DateTime @map("updated_at") @db.Timestamptz(3)
  entries    Entry[]

  @@map("cards")
}

model Entry {
  id             String        @id @db.Uuid
  type           EntryType
  description    String        @db.VarChar(120)
  category       String        @db.VarChar(50)
  categoryKey    String        @map("category_key") @db.VarChar(100)
  date           DateTime      @db.Date
  amount         Decimal       @db.Decimal(12, 2)
  paymentMethod  PaymentMethod @map("payment_method")
  cardId         String?       @map("card_id") @db.Uuid
  card           Card?         @relation(fields: [cardId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  closingDate    DateTime?     @map("closing_date") @db.Date    // só CARD
  dueDate        DateTime?     @map("due_date") @db.Date        // só CARD
  referenceMonth DateTime      @map("reference_month") @db.Date // sempre dia 01
  status         EntryStatus
  paidAt         DateTime?     @map("paid_at") @db.Timestamptz(3)
  createdAt      DateTime      @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime      @map("updated_at") @db.Timestamptz(3)

  @@index([referenceMonth, type, date, createdAt, id], map: "entries_month_type_date_idx")
  @@index([referenceMonth, type, status], map: "entries_month_type_status_idx")
  @@index([cardId, referenceMonth, status], map: "entries_card_month_status_idx")
  @@index([categoryKey, createdAt, id], map: "entries_category_key_created_idx")
  @@map("entries")
}
```

Decisões:
- **`reference_month` como `DATE` no dia 01** (T1): aritmética de datas do Postgres (`generate_series`, `date_trunc`), sem fuso, ordenável e indexável; trafega como `YYYY-MM`. Descartados `CHAR(7)` e `year`/`month` inteiros.
- **`closing_date` e `due_date` como `DATE` nuláveis** (T1, P32): gravadas na criação para CARD, nulas para PIX. Gravar só o mês de referência foi descartado: a fatura precisa exibir as datas com que suas despesas foram classificadas (B9), e recalcular a partir do cartão atual violaria DR2 após uma edição.
- **`reference_month` continua coluna própria** (e não derivada de `due_date` na leitura): PIX não tem `due_date`, e todos os filtros/índices usam uma única coluna para as duas formas. A redundância com `due_date` no CARD é amarrada por CHECK (7.4).
- **Status sem default**: o status inicial depende de tipo, forma e `paid`, e é decidido pelo aggregate.
- **`status` enum único com `RECEIVED`** (T10).
- **Unicidade de nome por coluna `name_key`** (T11), calculada pelo domínio; descartado índice funcional `lower(name)` (Prisma não modela índices de expressão; `lower()` não aplica NFC/colapso).
- **FK `Restrict`**: cartões não são excluídos (fora de escopo).
- `id`, `createdAt`, `updatedAt`, `paidAt` sem defaults do banco (aplicação: UUID v7 e `Clock`, T13).

### 7.3 Índices (T12, RNF06)

Com mês obrigatório em todas as leituras (B6), todo acesso a `entries` começa por `reference_month` ou por `card_id`; o índice "ver tudo" `(date, created_at, id)` e os índices de baixa seletividade `(type, ...)`/`(status, ...)` da rev. 2 saem.

| Índice | Atende |
|---|---|
| `(reference_month, type, date, created_at, id)` | E2/E3: igualdade em mês e tipo + ordenação `date DESC, created_at DESC, id DESC` (P30, T5) sem sort, com `LIMIT/OFFSET`; filtros de status/categoria/cartão aplicados sobre as ~4 mil linhas de um mês (100 mil em 24 meses). |
| `(reference_month, type, status)` | S1 (resumo), subtotais de E2/E3, I1 (mês + `EXPENSE`, agrupado por cartão), D2 (série: `reference_month BETWEEN` 12 meses), D3 (distribuição: mês + `EXPENSE`). |
| `(card_id, reference_month, status)` | I2, I3 e o `FOR UPDATE` das pendentes da fatura, filtro `cardId` de E2, FK. |
| `(category_key, created_at, id)` | `CategoryCatalog.findByKey` (`ORDER BY created_at, id LIMIT 1`) e `DISTINCT ON (category_key)` de E6. |

Nota sobre I1: o planner deve usar `entries_month_type_status_idx` e agrupar por `card_id` em memória (no máximo ~1,7 mil linhas por mês no cenário de 40% no cartão). Se o `EXPLAIN` mostrar o contrário, avaliar `(reference_month, card_id)`.

Regra mantida: o teste de desempenho (sec. 8.7) roda `EXPLAIN (ANALYZE)` em cada cenário e **todo índice que o planner não usar em nenhum cenário é removido antes do merge**. `INCLUDE` continua descartado (Prisma não modela).

### 7.4 Constraints adicionais (SQL manual na migration)

```sql
-- cards
ALTER TABLE "cards" ADD CONSTRAINT "cards_closing_day_chk" CHECK ("closing_day" BETWEEN 1 AND 31);
ALTER TABLE "cards" ADD CONSTRAINT "cards_due_day_chk"     CHECK ("due_day" BETWEEN 1 AND 31);
ALTER TABLE "cards" ADD CONSTRAINT "cards_updated_after_created_chk" CHECK ("updated_at" >= "created_at");

-- entries: valores e timestamps
ALTER TABLE "entries" ADD CONSTRAINT "entries_amount_positive_chk" CHECK ("amount" > 0);
ALTER TABLE "entries" ADD CONSTRAINT "entries_updated_after_created_chk" CHECK ("updated_at" >= "created_at");

-- entries: status
ALTER TABLE "entries" ADD CONSTRAINT "entries_paid_consistency_chk"
  CHECK (("status" = 'PAID') = ("paid_at" IS NOT NULL));
ALTER TABLE "entries" ADD CONSTRAINT "entries_paid_after_created_chk"
  CHECK ("paid_at" IS NULL OR "paid_at" >= "created_at");                 -- PIX pago na criação: igual
ALTER TABLE "entries" ADD CONSTRAINT "entries_type_status_chk"
  CHECK (("type" = 'INCOME' AND "status" = 'RECEIVED')
      OR ("type" = 'EXPENSE' AND "status" IN ('PENDING', 'PAID')));

-- entries: forma de pagamento x cartão x datas da fatura
ALTER TABLE "entries" ADD CONSTRAINT "entries_income_pix_chk"
  CHECK ("type" = 'EXPENSE' OR "payment_method" = 'PIX');
ALTER TABLE "entries" ADD CONSTRAINT "entries_method_card_chk"
  CHECK (("payment_method" = 'CARD') = ("card_id" IS NOT NULL)
     AND ("payment_method" = 'CARD') = ("closing_date" IS NOT NULL)
     AND ("payment_method" = 'CARD') = ("due_date" IS NOT NULL));
ALTER TABLE "entries" ADD CONSTRAINT "entries_invoice_dates_order_chk"
  CHECK ("closing_date" IS NULL OR (
         "closing_date" >= "date"
     AND "closing_date" <  (date_trunc('month', "date") + interval '2 month')::date          -- mês da compra ou seguinte
     AND "due_date"     >  "closing_date"
     AND "due_date"     <  (date_trunc('month', "closing_date") + interval '2 month')::date));-- mês do fechamento ou seguinte

-- entries: mês de referência
ALTER TABLE "entries" ADD CONSTRAINT "entries_ref_month_first_day_chk"
  CHECK (EXTRACT(DAY FROM "reference_month") = 1);
ALTER TABLE "entries" ADD CONSTRAINT "entries_ref_month_rule_chk"
  CHECK (("payment_method" = 'PIX'  AND "reference_month" = date_trunc('month', "date")::date)
      OR ("payment_method" = 'CARD' AND "reference_month" = date_trunc('month', "due_date")::date));
```

Defesa em profundidade para as invariantes 2-5, 7, 8 e 10 de `Entry` e as de `Card`. Os CHECKs **não reimplementam** o dia efetivo nem a escolha "mesmo mês x mês seguinte" (isso continua só em `calculateInvoiceDates`); garantem apenas as relações estruturais (as mesmas de `InvoiceDates.restore`). O "status inicial por forma" (cartão nasce PENDING; PIX nasce PAID salvo `paid: false`) não é expressável por CHECK - depende do momento da criação - e fica no aggregate + testes. O Prisma não gerencia CHECKs nem os remove em migrations futuras.

### 7.5 Estratégia de migration

1. Nenhuma migration existe (revs. 1 e 2 não foram implementadas): sem dados, backfill nem conversão. O enum `payment_method` nasce já com `PIX`/`CARD`; não há `ALTER TYPE` para remover `ACCOUNT`.
2. Duas migrations, na ordem das tarefas 12 e 13 da spec: `prisma migrate dev --create-only --name create_cards` e depois `--name create_entries` (depende da FK). Editar cada `migration.sql` para acrescentar os CHECKs da 7.4. Commitar.
3. Ambientes, CI e testes: `prisma migrate deploy` (globalSetup do testcontainers).
4. Rollback = forward-fix; SQL inverso comentado no topo de cada migration (`DROP TABLE "entries"; DROP TYPE "entry_status", "payment_method", "entry_type";` / `DROP TABLE "cards";`).
5. `api/.env.example` documenta `DATABASE_URL` (sem segredos).
6. Futuro (fora de escopo): status "a receber" para receitas (B7 resolvida contra ele nesta entrega) exigiria `ALTER TYPE "entry_status" ADD VALUE` em migration própria + troca de `entries_type_status_chk`.

### 7.6 Mappers (infrastructure)

- `amount`: leitura `amount::text` / `Prisma.Decimal.toFixed(2)` -> `Money.parse`; escrita `money.toString()`.
- `date`, `closing_date`, `due_date`: leitura sempre `::text` no SQL cru; via client, `toISOString().slice(0, 10)` com teste em `TZ=America/Sao_Paulo` (CA23); escrita `new Date(`${d}T00:00:00.000Z`)`. Reidratação por `InvoiceDates.restore` (sem recalcular).
- `reference_month`: leitura `to_char(reference_month, 'YYYY-MM')` ou `slice(0, 7)`; escrita `${rm}-01`.
- `name_key`/`category_key`: escritos a partir de `CardName.key`/`Category.key`.
- `PrismaCardRepository.insert/update`: `PrismaClientKnownRequestError` `P2002` com alvo `cards_name_key_uq` -> `CardNameTakenError` (único ponto que conhece o código do Prisma).

---

## 8. Queries agregadas

`$queryRaw` parametrizado + fragmentos `Prisma.sql`. Toda soma sai como texto (`::numeric(20,2)::text`) - nunca `number` no driver e `"0.00"` sem linhas. As derivações (total de despesas, saldos) são feitas por `ExpenseTotals`/`FinancialTotals` (sec. 3.6); agregação sobre linhas continua no banco (RF18).

Colunas comuns de `EntryView` (`<entry_cols>`):

```sql
e.id, e.type, e.description, e.category, e."date"::text AS date, e.amount::text AS amount,
e.payment_method, e.card_id, c.name AS card_name,
e.closing_date::text AS closing_date, e.due_date::text AS due_date,
to_char(e.reference_month, 'YYYY-MM') AS reference_month,
e.status, e.paid_at, e.created_at, e.updated_at
```

### 8.1 Resumo do mês (S1, RF10, RF15)

```sql
SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)::numeric(20,2)::text                       AS income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PAID'), 0)::numeric(20,2)::text    AS expenses_paid,
       COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PENDING'), 0)::numeric(20,2)::text AS expenses_pending
FROM entries WHERE reference_month = $month::date;
```

Sem nenhum filtro além do mês, por construção (DR6).

### 8.2 Despesas do mês (E2, RF11)

```sql
-- $where (despesas)
e.reference_month = $month::date AND e.type = 'EXPENSE'
[AND e.status = $status::entry_status]
[AND e.category_key = $categoryKey]
[AND e.card_id = $cardId::uuid]           -- ExpenseCardFilter.card
[AND e.payment_method = 'PIX']            -- ExpenseCardFilter.pix

-- página
SELECT <entry_cols>
FROM entries e LEFT JOIN cards c ON c.id = e.card_id
WHERE $where
ORDER BY e."date" DESC, e.created_at DESC, e.id DESC
LIMIT $pageSize OFFSET ($page - 1) * $pageSize;

-- contagem + subtotal sobre todo o conjunto filtrado (não a página)
SELECT COUNT(*)::int AS total_items,
       COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::numeric(20,2)::text    AS paid,
       COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0)::numeric(20,2)::text AS pending
FROM entries e WHERE $where;
```

### 8.3 Receitas do mês (E3, RF12)

```sql
-- $where (receitas)
e.reference_month = $month::date AND e.type = 'INCOME' [AND e.category_key = $categoryKey]

-- página: mesma projeção e ORDER BY da 8.2 (card/invoice sempre nulos)
SELECT COUNT(*)::int AS total_items, COALESCE(SUM(amount), 0)::numeric(20,2)::text AS total
FROM entries e WHERE $where;
```

Página e subtotal de 8.2/8.3 rodam em `prisma.$transaction([...], { isolationLevel: 'RepeatableRead' })` (mesmo snapshot durante um pagamento concorrente). Offset (T4). O resumo do topo (8.1) é uma requisição separada e pode, numa corrida, refletir um instante diferente; aceito (uso individual).

### 8.4 Categorias (RF14) e cartões (C2)

```sql
SELECT category FROM (
  SELECT DISTINCT ON (category_key) category_key, category
  FROM entries ORDER BY category_key, created_at, id
) c ORDER BY category_key;
```

`CategoryCatalog.findByKey`: `WHERE category_key = $key ORDER BY created_at, id LIMIT 1`. Cartões: `SELECT ... FROM cards ORDER BY name_key COLLATE "und-x-icu", id` (ordem alfabética com acentos; ICU na imagem oficial do Postgres - verificado no teste CA04).

### 8.5 Faturas (I1, I2, I3; RF08, RF09)

```sql
-- I1: faturas do mês (DR5: só cartões com despesa no mês; B9: MAX das datas; pendingCount para a confirmação)
SELECT c.id AS card_id, c.name AS card_name,
       to_char(e.reference_month, 'YYYY-MM')                                               AS reference_month,
       MAX(e.closing_date)::text                                                           AS closing_date,
       MAX(e.due_date)::text                                                               AS due_date,
       COUNT(*)::int                                                                       AS entry_count,
       COUNT(*) FILTER (WHERE e.status = 'PENDING')::int                                   AS pending_count,
       COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'PAID'), 0)::numeric(20,2)::text    AS paid,
       COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'PENDING'), 0)::numeric(20,2)::text AS pending
FROM entries e JOIN cards c ON c.id = e.card_id
WHERE e.reference_month = $month::date AND e.type = 'EXPENSE' AND e.payment_method = 'CARD'
GROUP BY c.id, c.name, c.name_key, e.reference_month
ORDER BY MAX(e.due_date), c.name_key COLLATE "und-x-icu", c.id;      -- P33

-- I2: despesas de uma fatura (um bloco; DR7: sem paginação)
SELECT <entry_cols>
FROM entries e JOIN cards c ON c.id = e.card_id
WHERE e.card_id = $cardId::uuid AND e.reference_month = $month::date
ORDER BY e."date" DESC, e.created_at DESC, e.id DESC;

-- I3: seleção com lock (PayInvoice)
SELECT <colunas> FROM entries
WHERE card_id = $cardId::uuid AND reference_month = $month::date AND status = 'PENDING'
ORDER BY id
FOR UPDATE;

-- persistência (saveAll, compartilhado com lote/individual)
UPDATE entries AS e
SET status = v.status::entry_status, paid_at = v.paid_at, updated_at = v.updated_at
FROM unnest($ids::uuid[], $statuses::text[], $paidAts::timestamptz[], $updatedAts::timestamptz[])
     AS v(id, status, paid_at, updated_at)
WHERE e.id = v.id AND e.type = 'EXPENSE' AND e.status = 'PENDING';
-- linhas afetadas != esperado -> erro (rollback): violação do contrato de lock
```

CA49 ("soma dos totais das faturas do mês = soma das despesas no cartão do mês") vale por construção: I1 particiona exatamente o conjunto `reference_month = $m AND payment_method = 'CARD'` por `card_id`; verificado em teste de integração.

### 8.6 Dashboard por mês de referência (RF16, RF17)

```sql
-- série de 12 meses com zeros (T7)
WITH agg AS (
  SELECT reference_month,
         SUM(amount) FILTER (WHERE type = 'INCOME')                       AS income,
         SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PAID')    AS paid,
         SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PENDING') AS pending
  FROM entries
  WHERE reference_month BETWEEN $from::date AND $to::date
  GROUP BY reference_month
)
SELECT to_char(m.month, 'YYYY-MM')                AS month,
       COALESCE(a.income, 0)::numeric(20,2)::text  AS income,
       COALESCE(a.paid, 0)::numeric(20,2)::text    AS expenses_paid,
       COALESCE(a.pending, 0)::numeric(20,2)::text AS expenses_pending
FROM generate_series($from::date, $to::date, interval '1 month') AS m(month)
LEFT JOIN agg a ON a.reference_month = m.month::date
ORDER BY m.month;

-- distribuição: só despesas (RF17, P10)
SELECT (array_agg(category ORDER BY created_at, id))[1]             AS category,
       SUM(amount)::numeric(20,2)::text                             AS total,
       ROUND(SUM(amount) * 100 / SUM(SUM(amount)) OVER (), 2)::text AS percentage
FROM entries
WHERE reference_month = $month::date AND type = 'EXPENSE'
GROUP BY category_key
ORDER BY SUM(amount) DESC, category_key;
```

Mês sem despesas: zero linhas na distribuição (sem divisão por zero), `total "0.00"` (CA65). Soma de `percentage` pode não dar `"100.00"` por arredondamento (exibição). Uma compra no cartão de 10/09 com vencimento em outubro entra na série e no resumo de outubro (CA63), porque tudo agrupa por `reference_month`.

### 8.7 Desempenho (RNF06)

Teste opt-in (`PERF=1`): 100 mil lançamentos (~15% receitas, ~40% no cartão, ~50% das despesas PIX pagas) em 24 meses, 20 cartões, ~10 categorias; p95 de 50 execuções para: S1; E2 (página 1 e última, cada filtro e combinações status+cartão, categoria+status, `cardId=pix`); E3; I1; I2 da maior fatura; I3 (com rollback); D2; D3; E6. `EXPLAIN (ANALYZE)` registra o índice usado (insumo da regra de remoção da 7.3). Meta < 300 ms. A carga da aba Despesas soma S1 + E2 + E6 + C2 em paralelo no servidor Next; cada uma isoladamente deve cumprir a meta.

---

## 9. Impacto no Next.js (`web/`)

### 9.1 Estrutura

```
web/app/
  layout.tsx                    # Server: lang="pt-BR"; lê cookie de tema; <html data-theme?>; fontes do DS; <meta name="color-scheme">
  global-error.tsx              # client; <html> próprio + script inline mínimo de tema (sec. 9.5)
  globals.css                   # @import "tailwindcss"; @import "./styles/tokens.css"; @theme inline -> utilitários
  styles/tokens.css             # tokens dos dois temas (sec. 9.5)
  page.tsx                      # redirect('/entries')
  (app)/layout.tsx              # shell: navegação Lançamentos / Dashboard / Cartões + ThemeToggle (P36, design D9)
  (app)/entries/page.tsx        # RSC: lê searchParams; cabeçalho (S1) + painel da aba ativa (E2 | I1 | E3); C2 e E6 para drawer/filtros
  (app)/entries/loading.tsx, error.tsx
  (app)/entries/actions.ts      # 'use server': createEntry, payEntry, payEntries, payInvoice, loadInvoiceEntries (leitura de I2)
  (app)/entries/_components/
    month-header.tsx            # RSC: MonthPicker + "+ Novo lançamento" + MonthSummary (S1), com Suspense/erro próprios
    entry-tabs.tsx              # client: tablist ARIA; troca de aba = navegação (URL)
    expenses-panel.tsx          # RSC + ilhas client (seleção, filtros, subtotal)
    invoices-panel.tsx          # RSC (lista de InvoiceDto) + invoice-block.tsx client (expansão sob demanda, Pagar fatura)
    incomes-panel.tsx           # RSC
    entry-drawer.tsx            # client: formulário + atalho "+ Novo cartão" (new-card-inline.tsx)
  (app)/cards/page.tsx          # RSC: lista de cartões
  (app)/cards/loading.tsx, error.tsx
  (app)/cards/actions.ts        # 'use server': createCard, updateCard (createCard também usado pelo atalho do drawer)
  (app)/cards/_components/
  (app)/dashboard/page.tsx      # três blocos com <Suspense> + BlockErrorBoundary: S1, D2, D3
  (app)/dashboard/_components/
web/components/ui/              # primitivos (design): Tabs, MonthPicker, Drawer, Modal, Button, IconButton, Checkbox, SegmentedControl, ...
web/components/theme/theme-toggle.tsx   # 'use client'
web/lib/
  api/http.ts                   # 'server-only'; ApiError { code, message, details }
  api/entries.ts, api/invoices.ts, api/cards.ts, api/summary.ts, api/dashboard.ts
  money/decimal.ts              # string <-> centavos BigInt COM SINAL; formatBRL("-150.00") = "-R$ 150,00"; signOf()
  dates/format.ts               # formatCivilDate, formatInstant, currentYearMonthSP, monthLabelPtBR ("nov/26"), monthLongPtBR
  filters/entries-search-params.ts  # parse/serialize de month, tab, d_* , r_* e page (sec. 9.3)
  theme/theme.ts                # puro: THEME_COOKIE, parseTheme, cookie string, resolveEffectiveTheme
  theme/contrast.ts             # puro: luminância relativa WCAG, razão, composição alfa
  theme/contrast-pairs.ts       # matriz de pares por tema (sec. 9.5)
web/e2e/                        # Playwright + axe; stub-api/ com cenários
```

Dependências: `recharts` 3.x. Dev: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `@axe-core/playwright`.

### 9.2 Estratégia de dados (T14)

- Leitura em Server Components com `fetch(..., { cache: 'no-store' })`; `API_URL` só no servidor; o navegador nunca chama a API (sem CORS).
- `/entries` busca em paralelo: **S1** (sempre, independente de aba/filtros/página - DR6, CA47), o painel da **aba ativa** (E2, I1 ou E3), **C2** (drawer e filtro de cartão) e **E6** (autocomplete e filtro de categoria). Cabeçalho e painel ficam em `<Suspense>`/error boundaries separados (RF24: loading/erro por aba e para o resumo). Abas inativas não são buscadas.
- **Lista expansível da fatura (pedido (b) do design)**: carregada **por bloco, sob demanda**, ao expandir, via Server Action de leitura `loadInvoiceEntries(cardId, referenceMonth)` que chama I2; o resultado fica em estado do `InvoiceBlock`, com chave `(cardId, referenceMonth, totals.pending, totals.paid)` para descartar o cache quando a fatura muda (ex.: após "Pagar fatura"). Erro/loading da lista são do bloco, sem afetar os demais. Alternativas descartadas: buscar I2 de todas as faturas no RSC (até 20 chamadas por carga); expansão por parâmetro de URL (o design exclui blocos expandidos da URL, e cada expansão re-renderizaria a rota); Route Handler proxy (mais uma superfície HTTP para o mesmo fim).
- **Mutações** por Server Actions: `createEntry`, `payEntry`, `payEntries`, `payInvoice` -> `revalidatePath('/entries')` e `('/dashboard')`; `createCard`, `updateCard` -> `('/cards')` e `('/entries')`. Uma mutação re-renderiza resumo, subtotal, faturas e listas juntos (R16, CA51, CA70, CA72). Retorno `{ ok: true, data } | { ok: false, error }` para erros inline (400 por campo, 409 no nome do cartão), `missingIds` (404) e mensagem de receitas (422).
- **Atalho "+ Novo cartão"** (RF23, CA75): o drawer chama a mesma action `createCard`; no sucesso, insere o `CardDto` retornado na lista local de cartões do formulário e o seleciona. O `revalidatePath('/entries')` re-renderiza o RSC, mas o drawer é componente client montado na mesma posição da árvore, então estado e dados digitados são preservados (verificado em CA75); o novo cartão aparece também no filtro e em `/cards`.
- **"Pagar fatura" (pedido (a) do design)**: a confirmação usa `card.name`, `referenceMonth`, `dueDate`, `pendingCount` e `totals.pending` do `InvoiceDto` de I1 - a contagem vem da API, o cliente não calcula; o feedback usa `paidCount`/`paidAmount` da resposta de I3 (P21). Desabilitado quando `pendingCount = 0` (CA45).

### 9.3 Estado na URL

Nomes alinhados às sugestões do design rev. 3 (sec. 3.5 do design):

`/entries?month=2026-11&tab=expenses&d_status=PENDING&d_category=Moradia&d_card=<uuid>|pix&r_category=Salário&page=2`

- `month` (`YYYY-MM`): ausente -> mês corrente em America/Sao_Paulo (P14, P16, CA61); inválido -> mês corrente + aviso (comportamento do design). O web sempre envia `month` à API.
- `tab` ∈ `expenses` | `invoices` | `income`; ausente = Despesas.
- Filtros **prefixados por aba**, para cada aba guardar os seus (P34): Despesas `d_status` (`PENDING`|`PAID`), `d_category`, `d_card` (UUID ou `pix`); Receitas `r_category`. A aba Faturas não tem filtros; blocos expandidos **não** vão para a URL.
- `page` é da aba ativa e é **descartada** ao trocar de aba, de mês ou de filtro; trocar de mês, filtro ou página limpa a seleção (P11, CA68). Voltar/avançar restaura mês, aba, filtros e página.
- Mapeamento para a API: `d_status -> status`, `d_category -> category`, `d_card -> cardId`, `r_category -> category`, `page -> page` (E2 ou E3, conforme `tab`).
- Atalho de `/cards` (DR8, CA77): `/entries?month=<mês corrente SP>&tab=expenses&d_card=<id>`.
- `/dashboard?month=YYYY-MM`. `/cards` sem estado.
- Removidos: `type`, `fromMonth`, `toMonth`, `period=all`, `cardId=none`.

### 9.4 Precisão, fuso e exibição (RNF01, RNF03, R1, R2)

- Valores sempre string até a tela. `formatBRL` por manipulação de string, com sinal: `"-150.00"` -> `-R$ 150,00` (CA67). `signOf("-0.10")` -> `negative`; rótulo textual positivo/negativo/zerado (P25).
- Soma dos selecionados com BigInt.
- Recharts: `Number()` **apenas** no `dataKey` de geometria (inclusive barras/linhas negativas); tooltip, legenda, rótulos e tabela alternativa usam a string formatada.
- Datas civis (`date`, `invoice.closingDate`, `invoice.dueDate`, `InvoiceDto.closingDate/dueDate`) e meses por split de string; proibido `new Date("YYYY-MM-DD")`.
- Rótulo "Fatura nov/26" na aba Despesas quando `paymentMethod === 'CARD' && referenceMonth !== date.slice(0, 7)` (RF20).
- Toast de criação no cartão (pedido (c) do design) com `referenceMonth`, `card.name` e `invoice.dueDate` **da resposta de E1** (P24): "Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026". O teste "aparece no mês selecionado?" compara o `referenceMonth` da resposta com o `month` da URL e o tipo com a aba.
- **Formulário** (RF23): tipo padrão Despesa, forma padrão PIX, "Ainda não paguei" desmarcado (P26). Envio: `paid: false` **somente** quando Despesa + PIX + "Ainda não paguei" marcado; caso contrário o campo é omitido (nunca envia `paid: true`, nem `paid` em receita ou cartão, evitando os 400 da P31). Receita: forma fixa PIX, sem `cardId`. Cartão: "Ainda não paguei" indisponível com texto explicativo. O web não calcula fatura, vencimento nem mês de referência (P24). **B8**: o drawer não muda o checkbox nem o envio conforme a data (data futura também nasce paga).

### 9.5 Tema claro/escuro (RF27, RNF10, RNF11) - decisões T15/T16

**Mecanismo (sem flash, sem script bloqueante na rota normal)** - inalterado da rev. 2:

1. **Tokens com `light-dark()` e `color-scheme`** em `web/app/styles/tokens.css`:
   ```css
   :root { color-scheme: light dark; /* sem preferência: segue o sistema, ao vivo */
     --bg: light-dark(<claro>, #0B0F1A);
     --text: light-dark(<claro>, #E6EAF5);
     /* ... um valor por tema para cada token */ }
   :root[data-theme="light"] { color-scheme: light; }
   :root[data-theme="dark"]  { color-scheme: dark; }
   ```
   Cada token é declarado **uma vez** com os dois valores. Isso também faz os controles nativos (date/month picker, select, scrollbars) seguirem o tema (CA86). Sem preferência, o CSS acompanha `prefers-color-scheme` em tempo real sem JS (CA79).
2. **Preferência em cookie** `theme=light|dark` (`Path=/; Max-Age=31536000; SameSite=Lax`; `Secure` em HTTPS; não HttpOnly porque o cliente grava). `web/app/layout.tsx` lê `cookies()` e renderiza `<html data-theme="...">` **no servidor** -> primeiro quadro no tema certo, inclusive `loading.tsx` e `error.tsx` de segmento, sem hydration mismatch (CA80, CA81). Valor inválido = ausente.
3. **Alternador** (`ThemeToggle`, client): grava `document.documentElement.dataset.theme` e o cookie; não recarrega e não toca estado React de outras árvores (drawer, atalho de novo cartão, inputs, seleção, aba e filtros preservados, CA84).
4. **Ícone sem flash**: os dois ícones no DOM, visibilidade por CSS. `aria-label` fixo "Tema escuro"; `aria-pressed` via `useSyncExternalStore` (servidor = cookie; cliente = tema efetivo via `matchMedia`). Alvo >= 44x44, foco visível, ícones `aria-hidden` (P29, CA78).
5. **Troca instantânea**: o toggle aplica `data-theme-switching` por um frame com `transition: none !important` global (CA84, CA87). Expansão do bloco de fatura respeita `prefers-reduced-motion` (CA87).
6. **`global-error.tsx`**: único script inline do app (lê o cookie e define `data-theme` antes da pintura).
7. **Terceiros**: Recharts recebe cores só via `var(--chart-*)`; tooltip e legenda próprios (fundo `--tooltip-bg`, borda `--tooltip-border`); `scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track)`.

Alternativas descartadas: `localStorage` + script bloqueante (`next-themes`); dois blocos de variáveis duplicados; script inline para "seguir o sistema". Trade-off: `cookies()` no root layout torna as rotas dinâmicas (já são, `no-store`); navegadores sem `light-dark()` não suportados.

**Tokens** (valores no design rev. 3, `docs/design/lancamentos-financeiros.md` 1.2): `--bg`, `--surface`, `--surface-2`, `--border` (decorativa), `--border-strong` (bordas de controles >= 3:1), `--text`, `--text-muted`, `--text-disabled` (>= 3:1), `--primary`, `--primary-strong`, `--on-primary`, `--accent`, `--focus-ring`, `--scrim`, `--success`/`--warning`/`--danger` (preenchimentos/bordas) e `--success-text`/`--warning-text`/`--danger-text` (texto), `--income`, `--expense`, `--skeleton`, `--chart-1..6`, `--chart-income`, `--chart-paid`, `--chart-pending`, `--chart-balance-realized`, `--chart-balance-projected`, `--chart-axis`, `--chart-grid`, `--chart-zero-line`, `--chart-cursor`, `--tooltip-bg`, `--scrollbar-thumb`, `--scrollbar-track`, e os **8 tokens novos propostos pelo ui-designer, incorporados**:

| Token novo | Claro / Escuro | Papel | Regra arquitetural |
|---|---|---|---|
| `--surface-active` | `#E2E7F0` / `#222B4A` | Pressionado de botões secundários/ícone, itens de menu, `::selection` | Fundo; precisa de pares de texto e de borda. |
| `--input-bg` | `#FFFFFF` / `#0B0F1A` | Fundo de input, select, combobox, date/month picker, checkbox; fundo forçado no `:-webkit-autofill` | Fundo; pares de texto, placeholder e borda de erro. |
| `--header-bg` | `rgb(255 255 255 / 0.95)` / `rgb(18 24 41 / 0.95)` | Navbar fixa com blur | **Único token de superfície com alfa** (além de `--scrim`); alfa <= 0.95 é invariante testada; contraste calculado **composto** sobre o pior fundo rolando por baixo. |
| `--primary-strong-hover` | `#4338CA` / `#4338CA` | Hover do botão primário, checkbox marcado, segmento selecionado | Fundo de `--on-primary`. |
| `--primary-strong-active` | `#3730A3` / `#3730A3` | Pressionado do botão primário e segmento selecionado | Fundo de `--on-primary`. |
| `--primary-border` | `#4F46E5` / `#818CF8` | Borda obrigatória de todo elemento preenchido com `--primary-strong` (botão primário, segmento, checkbox, página atual) | Contorno não textual >= 3:1; compensa `--primary-strong` x `--surface` escuro (2,81:1). |
| `--focus-color` | `#0E7490` / `#22D3EE` | Cor do anel de foco; `--focus-ring` passa a ser a **forma** (contorno 2px + offset 2px) que usa essa cor | Não textual >= 3:1 contra todos os fundos onde há foco. |
| `--tooltip-border` | `#737D92` / `#6E7891` | Borda do tooltip dos gráficos | Não textual >= 3:1 contra `--surface`. |

**Regras para o ui-designer/frontend**: nenhum componente usa cor literal (`#`, `rgb(`, `hsl(`, nomes de cor) fora de `tokens.css` - verificado por teste (sec. 11.5); o estado "atualizando" **não** usa opacidade sobre texto (indicador + `aria-busy`); disabled com tokens próprios, não `opacity`; todo elemento com fundo `--primary-strong*` declara borda `--primary-border`.

**Verificação de contraste (T16)** - duas camadas, porque o axe não cobre tudo (ignora desabilitados, não avalia contraste não textual, marca transparências como "incomplete"):

1. **Teste unitário de tokens** (Vitest, `web/lib/theme/contrast.ts` + matriz `web/lib/theme/contrast-pairs.ts`): parseia `tokens.css` (`light-dark(a, b)`) e, **para cada tema**, verifica cada par. Assinatura da matriz:
   ```ts
   // web/lib/theme/contrast-pairs.ts
   export type ContrastKind = 'text' | 'large-text' | 'non-text' | 'disabled';   // 4.5 | 3 | 3 | 3
   export interface ContrastPair {
     fg: `--${string}`;
     bg: `--${string}`;
     /** Fundos efetivos sob um bg com alfa (ex.: --header-bg); o teste compõe e usa o PIOR caso. */
     over?: readonly `--${string}`[];
     kind: ContrastKind;
     where: string;   // componente/estado, para mensagem de falha
   }
   export const CONTRAST_PAIRS: readonly ContrastPair[];
   /** Pares abaixo do mínimo aceitos por estarem cobertos por outro par (ex.: preenchimento coberto por borda). */
   export const DECORATIVE_PAIRS: readonly (ContrastPair & { coveredBy: ContrastPair })[];
   ```
   Fundos com alfa (`--scrim`, `--header-bg`) são compostos sobre o fundo efetivo antes do cálculo. Pares obrigatórios dos tokens novos (valores esperados do design, claro / escuro):

   | fg | bg | kind | Mín. | Esperado |
   |---|---|---|---|---|
   | `--text` | `--surface-active` | text | 4,5 | 14,38 / 11,53 |
   | `--text-muted` | `--surface-active` | text | 4,5 | 6,10 / 4,62 |
   | `--border-strong` | `--surface-active` | non-text | 3 | 3,33 / 3,14 |
   | `--text` | `--input-bg` | text | 4,5 | 17,85 / 15,90 |
   | `--text-muted` (placeholder) | `--input-bg` | text | 4,5 | 7,57 / 6,37 |
   | `--border-strong` | `--input-bg` | non-text | 3 | (calculado) |
   | `--danger` (borda de erro) | `--input-bg` | non-text | 3 | 4,82 / 6,91 |
   | `--text-disabled` | `--surface-2` (campo/checkbox desabilitado) | disabled | 3 | (calculado) |
   | `--text` | `--header-bg` over `[--bg, --surface, --surface-2, --text]` | text | 4,5 | 16,13 / 13,08 (pior caso) |
   | `--text-muted` | `--header-bg` over idem | text | 4,5 | 6,84 / 5,24 |
   | `--accent` (item de navegação ativo) | `--header-bg` over idem | text | 4,5 | 4,84 / 8,71 |
   | `--focus-color` | `--header-bg` over idem | non-text | 3 | (calculado) |
   | `--on-primary` | `--primary-strong-hover` | text | 4,5 | 7,90 / 7,90 |
   | `--on-primary` | `--primary-strong-active` | text | 4,5 | 9,93 / 9,93 |
   | `--primary-border` | `--surface` | non-text | 3 | 6,28 / 5,92 |
   | `--primary-border` | `--bg` | non-text | 3 | 5,86 / 6,41 |
   | `--primary-border` | `--surface-2` | non-text | 3 | 5,55 / 5,38 |
   | `--focus-color` | `--surface` | non-text | 3 | 5,35 / 9,77 |
   | `--focus-color` | `--bg` | non-text | 3 | 4,99 / 10,58 |
   | `--focus-color` | `--surface-2` | non-text | 3 | 4,73 / 8,89 |
   | `--focus-color` | `--input-bg` | non-text | 3 | (calculado) |
   | `--tooltip-border` | `--surface` | non-text | 3 | 4,13 / 4,00 |
   | `--text` / `--text-muted` | `--tooltip-bg` | text | 4,5 | 17,85 / 7,57 ; 13,35 / 5,35 |

   `DECORATIVE_PAIRS` contém `--primary-strong` x `--surface` (2,81:1 no escuro) com `coveredBy` = `--primary-border` x `--surface`; o teste falha se o par de cobertura não existir ou não passar. Invariantes extras do teste: alfa de `--header-bg` <= 0.95; `--focus-ring` referencia `--focus-color`; todo token declarado em `tokens.css` aparece em pelo menos um par (fg ou bg) ou numa allowlist justificada (ex.: `--skeleton`, `--scrim`). Além dos pares acima, a matriz mantém os demais da tabela 1.9 do design (texto/status/gráficos sobre `--bg`, `--surface`, `--surface-2`; estados de botão; séries e eixos). Roda em todo `pnpm test`.
2. **Playwright + `@axe-core/playwright`** em `web/e2e/`: cada tela/estado do CA82 x {claro, escuro} (tema via cookie; "sistema" via `emulateMedia({ colorScheme })`), regras `wcag2aa` + `color-contrast`; falha com qualquer violação e com `incomplete` de `color-contrast` não justificado em allowlist revisada (a navbar com `--header-bg` entra como `incomplete` esperado, coberta pela camada 1). O Next roda com `API_URL` apontando para `web/e2e/stub-api` (cenários por `POST /__scenario`: com dados, vazio, erro 500, 404/422 do lote, fatura sem pendências, nenhuma fatura no mês, erro ao carregar a lista de um bloco, 409 no atalho de cartão). Roda no CI.

---

## 10. Estrutura da api e composição

```
api/src/
  main.ts                        # NestFactory.create + configureApp + listen
  bootstrap/configure-app.ts     # prefixo /api, filtro global de erros, shutdown hooks, limites do body parser
  app.module.ts                  # PrismaModule, SharedModule, FinanceModule
  shared/
    domain/                      # Money, CalendarDate, YearMonth, Result, AppError, DomainEvent, AggregateRoot
    application/ports/           # Clock, IdGenerator, DomainEventPublisher (+ tokens)
    infrastructure/              # prisma/, system-clock, uuid-v7-id-generator, in-process-event-publisher
    presentation/                # filters/http-error.filter.ts (kind -> 400/404/409/422), pipes/zod-validation.pipe.ts
  modules/finance/
    domain/
      billing/                   # day-of-month.ts (ClosingDay, DueDay), reference-month.ts, invoice-dates.ts,
                                 #   calculate-invoice-dates.ts, invoice-key.ts
      card/                      # card.ts, value-objects/ (card-name), card-billing-info.ts, events/, errors/, card.repository.ts
      entry/                     # entry.ts, new-entry-input.ts, value-objects/ (entry-type, payment-method, entry-status,
                                 #   description, category), events/, errors/, entry.repository.ts, category-catalog.ts
      payment/entry-payment.service.ts
      totals/                    # expense-totals.ts, financial-totals.ts
    application/
      use-cases/{cards,entries,invoices,summary,dashboard}/
      queries/query-params.ts    # parseRequiredMonth, parsePaging, parseCategoryKey, parseExpenseCardFilter
      ports/, views/, errors/
    infrastructure/              # repositories/ (prisma-card, prisma-entry, prisma-category-catalog),
                                 # prisma-finance-unit-of-work.ts, read-models/*.prisma.ts, mappers/
    presentation/http/           # cards.controller.ts, invoices.controller.ts, entries.controller.ts (inclui expenses/incomes),
                                 # categories.controller.ts, summary.controller.ts, dashboard.controller.ts, schemas/ (zod), presenters/
    finance.module.ts            # tokens -> implementações; use cases via useFactory
```

- `billing/` não importa `card/` nem `entry/`; `card/` e `entry/` importam `billing/` (sem ciclo). `CardBillingInfo` fica em `card/` e é o único tipo de `card/` que `entry/` conhece.
- `PrismaFinanceUnitOfWork.run` usa `prisma.$transaction(async (tx) => work({ entries: new PrismaEntryRepository(tx), cards: new PrismaCardRepository(tx) }), { timeout: 10_000, maxWait: 5_000 })`.
- Presenters convertem views (`Money`, `ExpenseTotals`, `FinancialTotals`, `ReferenceMonth`, `CalendarDate`, `Date`) em DTOs string; um único `presentEntry` serve E1, E2, E3, E4 e I2 (garante que `referenceMonth` e `invoice` saem iguais em todos).
- UUID v7 via `uuid` (`v7()`) em infrastructure (T13).

---

## 11. Plano de testes por camada

Convenções: unitários `*.spec.ts`; integração `*.int-spec.ts` (`vitest.config.int.ts`, globalSetup com `PostgreSqlContainer` + `migrate deploy`, `fileParallelism: false`, `TRUNCATE entries, cards` entre testes); e2e `*.e2e-spec.ts` com o mesmo container e `configureApp`. Integração e e2e com `TZ=America/Sao_Paulo`. Cobertura com `include` em `src/**/domain/**` e `src/**/application/**`, thresholds 80%. Fakes em `api/test/fakes/`: `InMemoryCardRepository`, `InMemoryEntryRepository`, `InMemoryFinanceUnitOfWork` (snapshot + rollback), `FixedClock`, `SequentialIdGenerator`, `SpyEventPublisher`, read models em memória. Web: Vitest (`web/**/*.spec.ts(x)`) e Playwright (`web/e2e/*.pw.ts`). Payloads dos CAs traduzidos pela 2.2.

### 11.1 Domain (unitário, sem I/O)

| Alvo | Casos |
|---|---|
| `Money` | CA17 (tabela com código de violação por valor), CA18 (`"10"`/`"10.5"`), limite `9999999999.99`; sinal: `"-150.00"` parse/`toString`, `subtract`/`negate`, zero nunca `"-0.00"`; CA52 (`0.10+0.20+0.30 = "0.60"`, `0.50-0.60 = "-0.10"`); somas acima de 12 dígitos. |
| `CalendarDate`, `YearMonth` | CA19 (`2026-02-30`), bissextos; `lengthInDays` (fev 2026/2027/2028, abr, jan); `next` em dezembro; `minusMonths(11)` de 2026-10 = 2025-11 (CA62); `CalendarDate.of` fora do mês -> invariante. |
| `DayOfMonth`/`ClosingDay`/`DueDay` | CA02 (0, 32, 10.5); `effectiveIn` (31 em fev/abr; 29 em fev bissexto e não bissexto; 30 em fev). |
| **`calculateInvoiceDates`** | **CA21 linhas 1-20 como teste parametrizado** (fechamento, vencimento e mês de referência por linha); **propriedades (a)-(f) da 3.3** com `fast-check` sobre datas 2026-2028 x fechamento 1..31 x vencimento 1..31 (mais uma varredura exaustiva de 2026-2028 para (a), (b) e (e)); CA05 (fecha 10/vence 17 e fecha 20/vence 25 para 2026-10-15); CA22 (2026-10-26, fecha 25, vence 5 -> 25/11, 05/12, 2026-12); CA39 (2026-10-10 -> referência 2026-11); CA63 (2026-09-10 -> 2026-10). |
| `ReferenceMonth`, `InvoiceDates` | CA21 linhas 21-22 (`forPix`); `ofDueDate`; parse `2026-13` inválido (CA41, CA57); `InvoiceDates.restore` rejeita `closing < purchase`, `due <= closing`, closing dois meses depois, due dois meses depois do fechamento. |
| `Description`, `Category`, `CardName` | CA16 (vazio, espaços, 120/121, emoji = 1); CA20 (trim, colapso, `key` case-insensitive, acento diferencia); CA03 (`" nubank "` tem a mesma `key` de `"Nubank"`). |
| `NewEntryInput` | CA09 (`paid: true` no cartão -> `paid: NOT_ALLOWED_FOR_CARD`; `false`/omitido aceitos), CA11 (receita + CARD; receita + cardId; receita + `paid` true e false), CA12 (CARD sem cartão; PIX com cartão -> `NOT_ALLOWED_FOR_PIX`), CA14 (`TRANSFERENCIA`, `CONTA`, `DINHEIRO` -> `INVALID_VALUE`), CA19 (todas as violações juntas). |
| `Entry` | CA07 (PIX sem `paid` -> PAID, `paidAt = createdAt = now`, `invoiceDates = null`, referência do mês da data), CA08 (`paid: false` -> PENDING sem `paidAt`; `paid: true` = CA07), **B8** (PIX com data futura sem `paid` -> PAID com `paidAt = now`; com `paid: false` -> PENDING), CA09 (CARD -> PENDING com `invoiceDates` e referência do vencimento), CA10 (INCOME -> RECEIVED, PIX, sem cartão, data futura), CA21 via `create` com `CardBillingInfo`; `create` com card divergente ou ausente para CARD -> `InvariantViolationError`; CA24 (`markAsPaid` registra `paidAt`, emite `EntryPaid`), CA25 (no-op em PAID, inclusive PIX que nasceu paga), CA27 (receita lança `IncomeNotPayableError`, estado intacto), CA28 (sem API de reversão - teste de tipo), CA05 (nenhum método altera datas/referência); `EntryCreated` com status/`paidAt`, sem `EntryPaid` na criação; `restore` rejeita snapshots inconsistentes (INCOME PAID, INCOME CARD, CARD sem `invoiceDates`, PIX com `invoiceDates`, referência CARD != mês do vencimento, referência PIX != mês da data, PAID sem `paidAt`, `paidAt < createdAt`). |
| `Card` | CA01 (create + `CardCreated`), CA02 (acumula violações), `update` com e sem mudança (evento/`updatedAt`), `billingInfo` com `closingDay` e `dueDay`. |
| `EntryPaymentService` | CA29, CA30, CA32 (todas as receitas listadas, nada alterado), lote só de pagas. |
| `ExpenseTotals`, `FinancialTotals` | CA48 (valores exatos), CA49 (propriedade com valores aleatórios: `total = paid + pending`, `realized = income - paid`, `projected = income - total`, `projected <= realized`), CA51, CA52, CA60 (saldo previsto negativo), CA65 (zeros), componente negativo -> invariante. |

### 11.2 Application (unitário com fakes)

| Use case | Casos |
|---|---|
| `CreateCard` | CA01 (id do gerador, tempos do clock), CA02, CA03 (`CardNameTakenError`, nada inserido). |
| `UpdateCard` | CA05 (com `CreateEntry`: primeira despesa mantém 17/11 e 2026-11; nova recebe 20/10, 25/10, 2026-10), CA06 (404), 409 para nome de outro cartão, renomear a caixa do próprio é permitido, precedência 404 > 409. |
| `CreateEntry` | CA07, CA08, **B8** (data futura com `FixedClock` anterior -> PAID), CA09 (inclui `paid: true` com cartão inexistente -> 400, nada consultado), CA10, CA11 (com cartão inexistente -> 400), CA12, CA13 (404, nada inserido), CA20 (grafia canônica), CA22 (view com `referenceMonth`, `invoice.closingDate`, `invoice.dueDate` e `card.name` - pedido (c) do design), dias lidos do cartão no instante (CA05), `paidAt` e `createdAt` da mesma leitura do `Clock` (T13); evento publicado após `insert`. |
| `MarkEntryAsPaid` | CA24, CA25 (sem `saveAll`/evento; PIX nascida paga), CA26, CA27 (422, nada salvo), id mal formado -> 400. |
| `PayEntriesInBatch` | CA29, CA30, CA31 (todos os ausentes), CA32, CA33 (404 > 422), P07 (receita + já paga -> 422), CA34 (falha em `saveAll` -> rollback do fake, nada publicado), CA35, CA36 (vazio, mal formado, 101), `paidAt` único, ordem de saída. |
| `PayInvoice` | CA38 (só PENDING do cartão/mês; contagem e soma), CA39 (mês do vencimento), CA40 (`[]`, 0, `"0.00"`), CA41 (cartão inexistente 404; `2026-13` 400), CA42 (falha -> nada alterado/publicado). |
| `GetMonthlySummary` | CA48 (conversão para `FinancialTotals`), `month` ausente/inválido -> 400; assinatura sem filtros (DR6). |
| `ListExpenses` | CA46 (padrões page 1/20; `month` ausente -> 400), CA57 (`2026-13`, `status=RECEIVED`, `cardId` mal formado), `cardId=pix` -> filtro `pix`, P19, `pageSize` 101 -> 400, `totalPages`, subtotal convertido em `ExpenseTotals`. |
| `ListIncomes` | padrões, `month` obrigatório, categoria normalizada, subtotal `Money`. |
| `ListInvoices` | `month` obrigatório, CA44 (vazio), mapeamento de totais, `entryCount` e `pendingCount` (pedido (a) do design). |
| `ListInvoiceEntries` | pedido (b) do design: busca por (cartão, mês); 400 > 404; cartão existente sem despesas -> `items: []`. |
| Dashboard | CA62 (pede `2025-11..2026-10`, 12 pontos), `month` inválido -> 400, CA65 (distribuição vazia `"0.00"`). |

### 11.3 Infrastructure (integração, Postgres real)

- `PrismaCardRepository`/`CardReadModel`: round-trip; CA03 (unique de `name_key`, inclusive **corrida**: dois `CreateCard` simultâneos -> um sucesso e um `CardNameTakenError`); CA04 (ordem por nome com acentos via ICU); CHECKs de dias.
- `PrismaEntryRepository`: round-trip de todos os campos (Decimal, `date`, `closing_date`, `due_date`, `reference_month`) sem deslocamento em `TZ=America/Sao_Paulo` (CA23); **cada CHECK da 7.4 rejeita a linha inválida**: receita PAID, receita CARD, CARD sem cartão, CARD sem `due_date`, PIX com `closing_date`, `closing_date < date`, `due_date = closing_date`, `due_date` dois meses após o fechamento, `reference_month` dia 15, referência CARD != mês do vencimento, referência PIX != mês da data, PAID sem `paid_at`, `paid_at < created_at`; FK impede cartão inexistente; as 22 linhas do CA21 inseridas via `CreateEntry` passam em todos os CHECKs.
- `PrismaFinanceUnitOfWork` com use cases reais: CA34 e CA42 (decorator que executa o `UPDATE` e lança; banco inalterado); CA31 com banco inalterado; **CA37**: lote x lote e lote x fatura concorrentes (`Promise.all`, N repetições) - todos PAID, um `paidAt` por despesa, conjuntos pagos disjuntos e união correta, totais consistentes.
- `findPendingByInvoiceForUpdate`: CA38 (exclui E3 paga, E4 de outro mês, E5 de outro cartão, E6 PIX), CA39 (usa mês do vencimento, não da compra nem do fechamento).
- `EntryReadModel.listExpenses`: CA46 (25 despesas, ordem com desempate), CA50 (30 itens, página de 20, subtotal das 30), CA53 (compra no cartão de 10/10 em 2026-11; PIX de 20/10 fora), CA54, CA55 (C1 e `pix`), CA56, CA58, página além do fim, `card.name` atual após edição do cartão, P19.
- `EntryReadModel.listIncomes`: CA53 (receita de 05/11), CA56 (só receitas da categoria), subtotal.
- `MonthlySummaryReadModel`: CA47/CA48, CA49 (propriedade com valores aleatórios contra soma em memória), CA51 (pagar e consultar), CA52, CA10 (receita futura conta), CA07 e B8 (PIX pago, inclusive com data futura, reduz o realizado do seu mês de referência).
- `InvoiceReadModel.listByMonth`: CA43 (datas, contagens, `pendingCount`, totais, ordem A antes de B), CA44, CA45 (`pendingCount = 0`), empate de vencimento ordenado por nome com acento, **B9** (duas despesas da mesma fatura com datas diferentes após edição do cartão -> maiores `closingDate` e `dueDate`, e ordenação por essa `dueDate`), CA49 (soma das faturas = soma das despesas CARD do mês). `listEntries`: DR7 (todas as despesas do bloco, sem paginação, data desc), CA38 (só do cartão e mês).
- `CategoryReadModel`/`CategoryCatalog`: distintas por chave entre receitas e despesas (P23), grafia do primeiro uso.
- `DashboardReadModel`: CA59, CA60, CA62 (12 pontos com zeros e virada de ano), CA63 (compra de 10/09 com vencimento em outubro entra em outubro), CA64 (`"75.00"`/`"25.00"`, sem receitas), CA65.
- Desempenho opt-in (8.7).

### 11.4 Presentation (e2e, supertest + container)

- C1-C3: CA01 (201, nibble de versão `7`), CA02 (`"10"` -> `INVALID_TYPE`, 10.5, 0, 32, nome 51), CA03 (409 `CARD_NAME_TAKEN` com `details.fields[0].field = "name"`), CA04, CA05 (fluxo HTTP completo com datas da fatura nas respostas), CA06.
- E1: CA07 (`paidAt` igual ao `FixedClock` injetado no módulo de teste), CA08, B8 (data futura -> `PAID`), CA09, CA10, CA11, CA12, CA13 (404 `CARD_NOT_FOUND`), CA14 (`"CONTA"`, `"DINHEIRO"`, `"ACCOUNT"` -> 400), CA15 (`UNKNOWN_FIELD` para `status`, `referenceMonth`, `closingDate`, `dueDate`), CA16, CA17 (inclui `amount` numérico), CA18, CA19, CA20, CA21 (amostra HTTP: linhas 1, 3, 7, 8, 18, 20, 21, 22), CA22 (resposta de E1 com `referenceMonth` e `invoice.{closingDate, dueDate}`, e o mesmo item em E2), `paid: "true"`/`null` -> `INVALID_TYPE`, JSON inválido -> `MALFORMED_JSON`.
- E4: CA24, CA25 (`paidAt` igual nas duas respostas), CA26, CA27 (422 `ENTRY_NOT_PAYABLE`, `details.incomeIds`), CA28 (`PATCH`/`DELETE /api/entries/:id` -> 404 `ROUTE_NOT_FOUND`).
- E5: CA29, CA30, CA31 (`details.missingIds` = [X, Y]), CA32 (422 `ENTRIES_NOT_PAYABLE`), CA33, CA35, CA36.
- I3: CA38, CA39, CA40, CA41.
- I1/I2: CA43 (inclui `pendingCount`), CA44, CA45, B9 (datas máximas), I2 por bloco com DR7 (ordem, sem paginação), I2 cartão inexistente 404 e mês inválido 400.
- S1/E2/E3: CA46, CA48, CA50, CA51 (S1 e subtotal de E2 após E5), CA52, CA53 (parte API), CA54, CA55, CA56, CA57 (`month` ausente, `2026-13`, `status=RECEIVED`, `cardId=abc`, `fromMonth`/`toMonth`/`type` -> 400 `UNKNOWN_FIELD`; `status`/`cardId` em E3 -> 400), CA58; formato completo (`subtotal`, `pagination`, `totals` aninhado, saldos com sinal).
- E6, D2, D3, S1 no dashboard: CA59 (S1 igual para as duas telas), CA60, CA62, CA63, CA64, CA65, `month` ausente/inválido -> 400.
- Rota inexistente -> 404 padrão; erro inesperado -> 500 `INTERNAL_ERROR` sem vazar detalhes.

### 11.5 Web

**Unitários (Vitest)**
- `lib/money`: CA67 (`"1234.56"` -> `R$ 1.234,56`, `"-150.00"` -> `-R$ 150,00`, NBSP normalizado), `"0.00"` zerado, `signOf`, soma BigInt dos selecionados, máscara.
- `lib/dates`: CA23/CA67 (`formatCivilDate("2026-10-31")` com `TZ=UTC` e `TZ=America/Sao_Paulo`), CA61 (`currentYearMonthSP` em `2026-11-01T02:30:00Z` -> `"2026-10"`), `monthLabelPtBR("2026-11") = "nov/26"` (rótulo "Fatura nov/26", toast), `monthLongPtBR("2026-11") = "novembro de 2026"` (CA72).
- `lib/filters`: parse/serialize de `month`, `tab` (`expenses|invoices|income`), `d_status`, `d_category`, `d_card` (UUID ou `pix`), `r_category` e `page`; trocar de aba mantém mês e filtros e descarta `page` (P34); trocar de mês ou filtro descarta `page` (CA68); parâmetros legados (`type`, `fromMonth`, `cardId=none`) descartados; mapeamento para a query de E2/E3.
- `lib/theme`: `parseTheme` (inválido = ausente), string do cookie, `resolveEffectiveTheme`.
- **Contraste de tokens** (CA82, CA83 nível de token, RNF10): matriz por tema da 9.5, **incluindo os 8 tokens novos** (`--surface-active`, `--input-bg`, `--header-bg` composto no pior caso, `--primary-strong-hover`, `--primary-strong-active`, `--primary-border`, `--focus-color`, `--tooltip-border`), `DECORATIVE_PAIRS` com cobertura, alfa de `--header-bg` <= 0.95, todo token coberto por algum par.
- **Sem cores literais**: varre `web/app/**`, `web/components/**` (`.tsx`, `.css`, exceto `tokens.css`) e falha com `#hex`, `rgb(`, `hsl(` ou cores nomeadas (RF27).
- Payload do drawer: Despesa + PIX sem "Ainda não paguei" -> sem `paid` (inclusive com data futura, B8); marcado -> `paid: false`; Cartão e Receita -> sem `paid` (P31).

**Componentes (Testing Library)**
- Cabeçalho: CA47 (resumo vem de S1 e não muda com aba/filtro/página), CA60 (saldo negativo com texto/ícone), CA59 (mesmos componentes de card no dashboard).
- Abas: CA69 (tablist com setas/Home/End, `aria-selected`, cabeçalho persistente), CA71 (Receitas sem checkbox nem ação).
- Aba Despesas: rótulo "Fatura nov/26" (RF20), CA54-CA56 (filtros e subtotal), CA58 (estado vazio com resumo intacto), CA70 (seleção, soma e confirmação), CA71 (pagas com checkbox indisponível), mensagens de 404 (ids) e 422 (receitas) (RF24).
- Aba Faturas: CA43/CA72 (bloco com nome, fechamento, vencimento, total, pago, pendente; confirmação com `pendingCount` e soma pendente vindos do `InvoiceDto`), CA44 (estado vazio com atalho), CA45 ("Pagar fatura" desabilitado com `pendingCount = 0`), expansão sob demanda por bloco (chama `loadInvoiceEntries` uma vez por expansão, loading/erro do bloco, cache invalidado quando os totais mudam), estado anunciado (RNF09).
- Drawer: CA73 (tipo/forma/"Ainda não paguei"), CA74 (erros inline, sucesso com fatura e vencimento lidos da resposta), CA75 (atalho: cria, seleciona, preserva dados, 409 inline, cancelar devolve foco ao campo cartão).
- Cartões: CA77 (estado vazio, "Fecha dia 25 · Vence dia 5", atalho para a aba Despesas filtrada com `d_card`), aviso de não retroatividade na edição (CA05).
- Dashboard: CA64 (tooltip do donut com R$ e %), CA65 (vazio), CA66 (bloco com "Tentar novamente").
- CA78 (ThemeToggle: `aria-label` estável, `aria-pressed`, Enter/Espaço, foco mantido), foco preso/Esc (RNF09).

**Playwright (`web/e2e/`, contra `stub-api`)**
- Fluxos: CA47 (trocar aba, filtrar e paginar sem mudar o resumo), CA53, CA68, CA69, CA70, CA72, CA74, CA75, CA77; CA61 (relógio do navegador e do servidor fixados em 2026-11-01T02:30Z -> outubro).
- CA76: viewport 360x800, abas/seletor/resumo utilizáveis, cards em vez de tabela, alvos >= 44px por `boundingBox`, blocos de fatura expansíveis.
- CA79: sem cookie, `emulateMedia({ colorScheme })` e troca ao vivo.
- CA80: alternar, recarregar, outra rota, novo contexto com o mesmo cookie; `emulateMedia` contrário não sobrepõe.
- CA81: (a) JavaScript desabilitado + cookie diferente do sistema -> `<html data-theme>` e `background-color` do `body` corretos; (b) rede lenta na tela de loading e na página de erro: cor do `body` no primeiro `DOMContentLoaded` igual à final; (c) nenhum log "hydration".
- CA82: matriz de telas/estados x temas com axe - cabeçalho com resumo; abas Despesas (com dados, vazia, erro, atualizando, com seleção, banner 404/422), Faturas (bloco recolhido, expandido, carregando a lista e com erro na lista; aba vazia), Receitas; drawer de lançamento (com erros e com o atalho de novo cartão aberto) e de cartão; modal; folha de filtros mobile; toasts; tela de cartões; dashboard (com dados, vazio, erro, tooltip aberto, tabela alternativa).
- CA83: botões, abas e paginação em hover/foco/pressionado (`hover()`, `focus()`, `mouse.down()`), carregando e desabilitado, com axe + razão calculada pelas cores computadas (disabled e bordas `--primary-border`, que o axe não avalia).
- CA84: drawer, atalho de cartão e modal abertos com dados digitados; alternar 5 vezes; valores, seleção, aba e filtros preservados; cores computadas pertencem ao conjunto do tema ativo.
- CA85: no escuro, nenhuma `background-color` computada fora dos tokens escuros (inclui navbar `--header-bg`, inputs `--input-bg`, autofill, tooltip, toast, skeleton, abas, blocos de fatura, "atualizando").
- CA86: após alternar, `fill`/`stroke` de eixos, grade, séries, cursor, tooltip (inclusive `--tooltip-border`) iguais aos tokens; `color-scheme` computado de `<html>`, `input[type=date]`, `input[type=month]` e `select` igual ao tema.
- CA87: `emulateMedia({ reducedMotion: 'reduce' })` -> alternar tema e expandir bloco de fatura sem animação (`getAnimations()` vazio, `transition-duration` `0s`).

### 11.6 Matriz CA -> camada

| CA | Domain | Application | Integração | e2e API | Web unit/comp. | Playwright |
|---|---|---|---|---|---|---|
| CA01-CA02 | x | x | | x | | |
| CA03 | x | x | x (corrida) | x | x (409 inline) | x (via CA75) |
| CA04 | | | x | x | | |
| CA05 | x | x | | x | x (aviso) | |
| CA06 | | x | | x | | |
| CA07-CA10 (+ B8) | x | x | x (CHECKs, resumo) | x | x (payload `paid`) | |
| CA11-CA12, CA14, CA16-CA19 | x | x (CA11) | | x | | |
| CA13 | | x | | x | | |
| CA15 | | | | x | | |
| CA20 | x | x | x | x | | |
| CA21 | x (tabela + propriedades) | x | x (CHECKs) | x (amostra) | | |
| CA22 | x | x | x | x | x (rótulo, toast) | |
| CA23 | | | x | x | x | |
| CA24-CA27 | x | x | | x | | |
| CA28 | x (tipo) | | | x | x | |
| CA29-CA30, CA32 | x | x | | x | | |
| CA31, CA33, CA35, CA36 | | x | x (CA31) | x | | |
| CA34 | | x | x | | | |
| CA37 | | | x | | | |
| CA38-CA39 | x (CA39) | x | x | x | | |
| CA40-CA41 | x (CA41 mês) | x | | x | | |
| CA42 | | x | x | | | |
| CA43 (+ B9) | | x | x | x | x | |
| CA44 | | x | x | x | x | |
| CA45 | | | x | x | x | |
| CA46 | | x | x | x | | |
| CA47 | | x | x | x | x | x |
| CA48-CA49 | x | x (CA48) | x | x | | |
| CA50 | | | x | x | | |
| CA51 | x | | x | x | | x (via CA70) |
| CA52 | x | | x | x | x | |
| CA53 | | | x | x | | x |
| CA54-CA56 | | x (CA55) | x | x | x | |
| CA57 | x (mês) | x | | x | | |
| CA58 | | | x | x | x | |
| CA59 | | x | x | x | x | |
| CA60 | x | | x | x | x | |
| CA61 | | | | | x | x |
| CA62 | x | x | x | x | | |
| CA63 | x | | x | x | | |
| CA64 | | | x | x | x | |
| CA65 | x | x | x | x | x | |
| CA66 | | | | | x | |
| CA67 | | | | | x | |
| CA68-CA70, CA72, CA74, CA75, CA77 | | | | | x | x |
| CA71, CA73 | | | | | x | |
| CA76 | | | | | | x |
| CA78 | | | | | x | x |
| CA79-CA81 | | | | | x (lib/theme) | x |
| CA82-CA83 | | | | | x (tokens, 8 novos) | x |
| CA84-CA87 | | | | | | x |

---

## 12. Decisões, alternativas descartadas e trade-offs

| # | Decisão | Alternativas descartadas | Trade-off aceito |
|---|---|---|---|
| Contexto | Um bounded context "Finanças pessoais" com aggregates `Card` e `Entry`; módulo `finance` | Contexto "Cartões" separado; `Card` como entidade dentro de `Entry` | Módulo maior; separação futura exigirá extrair `card/` e `billing/`. |
| Fatura | `InvoiceKey` (VO) + projeção `InvoiceView`; datas derivadas das gravadas nos lançamentos | Aggregate `Invoice`; tabela `invoices` materializada | Sem lugar para estado de fatura; revisitar se surgir fechada/aberta. |
| RF05 / T17 | Função pura `calculateInvoiceDates` em `domain/billing/` retornando `InvoiceDates { closingDate, dueDate, referenceMonth }`, chamada só por `Entry.create` | Método de `Card` (acopla a regra ao ciclo de vida do cartão e a `Card.update`); fábrica `ReferenceMonth.forCard` da rev. 2 (não produz as datas); cálculo no SQL; cálculo no web | Mais um módulo de domínio; regra testável isoladamente pela tabela e por propriedades. |
| P32 | Gravar `closing_date`, `due_date` e `reference_month` | Gravar só `reference_month`; recalcular datas na leitura a partir do cartão | Redundância `reference_month` x `due_date` no CARD, amarrada por CHECK. |
| T1 | `date`, `closing_date`, `due_date` e `reference_month` como `DATE` (este no dia 01) | `timestamptz`; `CHAR(7)`; ano/mês inteiros | CHECK extra para dia 01. |
| B11 | Status inicial decidido no aggregate a partir de tipo, forma e `paid`; `paid` opcional, omitido = pago no PIX | Campo `status` na entrada; `paid` obrigatório; default `false` | Um campo com três estados (omitido/true/false) e regras P31 por combinação. |
| B8 | PIX com data futura nasce PAID; status inicial não depende da data | PENDING automático por data (exigiria "hoje" em SP no domínio, via port `BusinessCalendar`); pré-marcar "Ainda não paguei" na UI | Saldo realizado do mês futuro reduzido antes de o dinheiro sair (R9, aceito pelo usuário); domínio fica sem dependência de fuso. |
| B9 | Fatura exibe `MAX(closing_date)` e `MAX(due_date)` e ordena por essa `due_date`; regra só no read model | `MIN`; datas da despesa mais recente; aviso de divergência | Divergência após edição do cartão não é sinalizada (R10, aceito); trocar a regra é mudar uma query. |
| Eventos | PIX pago na criação emite só `EntryCreated` (com status e `paidAt`) | Emitir também `EntryPaid` | Consumidor de pagamentos precisa escutar dois eventos. |
| T2 | 404 `ENTRIES_NOT_FOUND`/`CARD_NOT_FOUND`, 422 `ENTRY(IES)_NOT_PAYABLE` (`incomeIds`), 409 `CARD_NAME_TAKEN` (`fields`), `kind: 'business_rule'` | 400 para receitas; ignorar receitas no lote | Cliente precisa ler `details`. |
| Precedência | Ordem das etapas nos use cases | Ordenar no filtro HTTP | Testada por use case, não centralizada. |
| T3 | 100 ids por lote (lista bruta); fatura sem limite | Limite na fatura | Fatura enorme depende do timeout (10 s). |
| T4/T5 | Offset; `date DESC, created_at DESC, id DESC` | Cursor | Offset profundo degrada com volumes muito maiores. |
| T6 | `FOR UPDATE` ordenado por id em lote, fatura e individual + guarda no `UPDATE` | Só `UPDATE` condicional; otimista; `SERIALIZABLE` | Pagamentos sobrepostos esperam um pelo outro. |
| T7 | `generate_series` | Zeros na aplicação | SQL mais longo. |
| T8 | Inglês; E2 e E3 separados; S1 único para lançamentos e dashboard; I1 transversal `/api/invoices` com `pendingCount`; I2 por bloco e I3 como subrecurso de cartão; E1 devolve `referenceMonth` + `invoice`; `paid`; `PIX`/`CARD`; `cardId=pix` | `GET /api/entries?type=` com tipo obrigatório; resumo embutido nas listagens; despesas embutidas em I1; E2 sem paginação para a fatura; contagem de pendentes calculada no cliente | Mais endpoints; a tela faz 3-4 chamadas em paralelo no servidor. |
| Queries estritas | Parâmetro de query desconhecido -> 400 | Ignorar desconhecidos (rev. 2) | Cliente não pode mandar parâmetros extras (o web controla todos). |
| DR6 | Resumo por port sem filtros (`MonthlySummaryReadModel`); subtotal por listagem | Totais únicos "respeitando filtros" (rev. 2) | Uma query a mais por carga de tela. |
| T9 | `Money` único com sinal (BigInt) + `parseEntryAmount` | `SignedMoney` separado; decimal.js | Tipo não impede, sozinho, valor de lançamento negativo (protegido na entrada e no CHECK). |
| Totais | Somatórios no SQL, derivações em `ExpenseTotals`/`FinancialTotals` | Saldos calculados em SQL | Aritmética fora do banco; fórmula única (CA49). |
| T10 | Enum único `PENDING/PAID/RECEIVED` + CHECKs (forma x cartão x datas, regra do mês, `paid_at >= created_at`) | `status` nulo para receitas; enums por tipo | Combinações inválidas impedidas só por CHECK/aggregate; status inicial do cartão só no aggregate. |
| T11 | Coluna `name_key` + unique; `P2002 -> 409` | Índice funcional `lower(name)` | Normalização duplicada em coluna. |
| T12 | 4 índices liderados por `reference_month`/`card_id`/`category_key`, com regra de remoção por `EXPLAIN` | 6 índices da rev. 2; `INCLUDE` | Filtros de status/categoria/cartão aplicados após o recorte do mês. |
| T13 | UUID v7 via port + `uuid`; `Clock` port; `paidAt` do PIX = `createdAt` | `uuidv7()` do Postgres; `now()` no banco | Uma dependência. |
| T14 | RSC + Server Actions + `revalidatePath`; lista da fatura por bloco sob demanda via Server Action de leitura | SWR/React Query; buscar todas as listas de fatura no RSC; expansão via URL | Server Actions são serializadas por cliente (aceitável para expansão pontual). |
| URL | Nomes do design rev. 3: `tab`, `d_status`, `d_category`, `d_card`, `r_category`, `page` da aba ativa | Filtros sem prefixo (perdidos ao trocar de aba); página por aba | Query string mais longa; página não é preservada entre abas (comportamento desejado pelo design). |
| T15 | Cookie + `data-theme` no servidor + `light-dark()`/`color-scheme` | `localStorage` + script (`next-themes`); blocos duplicados | Rotas dinâmicas; navegadores sem `light-dark()` não suportados. |
| T16 | Contraste em duas camadas: matriz de tokens (inclui 8 tokens novos, composição de `--header-bg`, pares decorativos com cobertura) + axe/Playwright | Só axe; verificação manual | Manter a matriz e o stub da API. |
| - | Use cases sem decorators Nest | `@Injectable()` | Mais código de composição. |
| - | Eventos in-process pós-commit, sem outbox | Outbox | Perda possível em crash (sem consumidores). |
| B1 | Grafia do primeiro uso + agrupamento por `category_key` | Tabela `categories` | Corrida pode gravar duas grafias; filtros/donut corretos pela chave. |
| - | `Number` só na geometria do Recharts | Lib com valores string | Exceção restrita a `dataKey`. |

---

## 13. Violações de SOLID e problemas no código atual que afetam a feature

O código não mudou desde a rev. 2; os pontos continuam válidos.

1. **DIP - `api/src/app.controller.ts`** injeta a classe concreta `AppService` por tipo: único exemplo de injeção no projeto e modelo errado para os novos módulos. Ação: remover `AppController`/`AppService`/`app.controller.spec.ts` e o e2e de exemplo, ou trocar por health check injetado por token.
2. **Injeção por tipo depende de `emitDecoratorMetadata`**, que o transform do Vitest 4/Vite 8 pode não emitir; injeção por token (`@Inject(TOKEN)`) elimina a dependência (ou plugin SWC no Vitest).
3. **SRP - `api/src/main.ts`** concentra bootstrap sem prefixo, filtro de erros (400/404/409/422), limites nem shutdown hooks; e2e criariam uma app diferente da de produção. Ação: `src/bootstrap/configure-app.ts` usado por `main.ts` e pelos e2e.
4. **`api/vitest.config.ts`** inclui `**/*.spec.ts` sem separar integração e sem `include`/thresholds de cobertura. Ação: `*.int-spec.ts` com config própria, cobertura em domain/application >= 80%.
5. **Dependências ausentes**: api `@prisma/client`, `zod`, `uuid`, `@testcontainers/postgresql`, `fast-check`; web `recharts`, `vitest`, Testing Library, `jsdom`, `@playwright/test`, `@axe-core/playwright`.
6. **OCP/tema - `web/app/globals.css`**: tokens genéricos (`--background/--foreground`) e tema decidido só por `@media (prefers-color-scheme)`, que impede a preferência explícita (RF27); `body` fixa `font-family: Arial`. Ação: esquema da 9.5 (`tokens.css` com `light-dark()` + `data-theme`).
7. **`web/app/layout.tsx`**: `lang="en"`, fontes Geist em vez das do design system, metadata do template, e não lê o cookie de tema (necessário para CA81).
8. **Documentação**: `docs/design/design-system.md` cita `apps/web/src/styles/tokens.css` (correto: `web/app/styles/tokens.css`) e não tem valores do tema claro nem os 8 tokens novos (fonte de verdade passa a ser o design da feature + `tokens.css`). Correção a cargo do doc-writer.

---

## 14. Consequências

- Positivas: regra das datas da fatura isolada numa função pura coberta por tabela (CA21) e propriedades; datas gravadas tornam faturas estáveis frente à edição do cartão (DR2) e reforçadas por CHECKs; B8 sem dependência de fuso no domínio; B9 confinada a uma query; resumo do mês estruturalmente imune a filtros (DR6); saldos exatos com sinal e fórmula única; precedência de erros determinística; fatura reaproveita as garantias do lote; contratos cobrem as três dependências do design (contagem de pendentes, lista por bloco, dados do toast); queries mais simples e índices menores com o mês obrigatório; tema sem flash, com contraste verificado automaticamente nos dois temas, incluindo os 8 tokens novos.
- Negativas: fundação ainda pesada (R18) - cartões, faturas, 422/409, tema, Playwright e stub da API; mais endpoints de leitura (S1, E2, E3, I1, I2); PIX pago por padrão, inclusive com data futura, sem estorno (R9); datas divergentes de fatura não sinalizadas (R10); redundância `reference_month`/`due_date`; `light-dark()` exclui navegadores antigos; lock pessimista serializa pagamentos sobrepostos.
- Próximo passo do fluxo: aprovação do usuário deste ADR (B8 e B9 já aprovadas; design rev. 3 concluído), depois tester (red) usando a matriz 11.6.

---

## 15. Notas de implementação (desvios aceitos no code review)

Status do ADR permanece **Aceito**. A implementação (branch `feature/finance`) foi verificada e aprovada pelo code-reviewer com os desvios abaixo em relação ao texto acima. Onde houver conflito, vale o que está aqui e no código. Contratos HTTP efetivos: `docs/api/finance.md`.

| # | Seção do ADR | Desvio | Motivo e efeito |
|---|---|---|---|
| 1 | 6.5 (validação de entrada) | UUID de ids/`cardId` e formato `YYYY-MM` são validados **nos use cases** (`application/queries/query-params.ts`, `EntryId`/`CardId`/`ReferenceMonth`), não nos schemas zod. O zod valida só forma: presença, tipo, chaves desconhecidas (`strictObject`) e tamanho do array de `ids`. | Mantém a regra única no domínio/application e acumula violações por campo; a saída é a mesma (`VALIDATION_ERROR` com `fields`). Ids de path (`:id`, `:cardId`, `:referenceMonth`) passam sem pipe e são validados no use case, preservando 400 > 404 > 422. |
| 2 | 7.1 (setup Prisma) | `PrismaService` abre a conexão com `options: '-c timezone=UTC -c datestyle=ISO'` no `PrismaPg`. | O adapter serializa/parseia `timestamptz` sem offset e as leituras `::text` de `DATE` não podem depender da configuração do banco; datas ficam em UTC. |
| 3 | 10 (estrutura e composição) | Os providers do módulo (tokens, `useFactory`) ficam em `infrastructure/finance-infrastructure.providers.ts`, usados por `finance.module.ts`. | Mantém o módulo Nest enxuto e a composição de repositórios/read models na camada de infraestrutura. |
| 4 | 9 (web) | `next.config.ts` **não** habilita `cacheComponents` nem `partialPrefetching`. | O layout raiz lê `cookies()` (tema, 9.5), o que torna as rotas dinâmicas; essas opções não são usadas. Já era o trade-off descrito em 9.5. |
| 5 | 9 (web) | `web/tsconfig.json` usa `target` ES2022. | Necessário para literais BigInt (Money em centavos) e a flag `s` de regex usada nos testes; desvio aceito pelo reviewer, sem efeito no contrato. |
| 6 | 6.2 / 6.5 (limites) | Teto de `page` = **1.000.000** (acima disso, `OUT_OF_RANGE`) e faixa de anos **1900-9998** para `month`, `referenceMonth` e `date` (`OUT_OF_RANGE`). Antes, o ADR citava `INVALID_FORMAT` para `ReferenceMonth.parse` e ano 0001-9999. | `OFFSET = (page-1)*pageSize` precisa caber em `integer` do Postgres; anos extremos estourariam a aritmética de mês/fatura (`ReferenceMonth.MIN_YEAR/MAX_YEAR`). |
| 7 | 6.3 (formato de erro) | `URIError` de percent-encoding inválido no path (convertido em `BadRequestException` pelo adaptador do Nest) vira `VALIDATION_ERROR` com `fields: [{ field: "path", code: "INVALID_FORMAT" }]`, e não `MALFORMED_JSON`. Os demais `BadRequestException` continuam `MALFORMED_JSON`. | Distingue URL inválida de corpo JSON ilegível. |
| 8 | 7.4 (constraints) | A migration 3 (`20261024000003_entries_checks_date_cast`) recria `entries_invoice_dates_order_chk` e `entries_ref_month_rule_chk` com `date_trunc('month', "date"::timestamp)`. | `date_trunc` sobre `DATE` faz cast implícito para `timestamptz`, dependente do `TimeZone` da sessão; com `::timestamp` o CHECK não depende do fuso. |
| 9 | 9.2 (estratégia de dados) | A porta padrão de `API_URL` no web é **3001** (`web/lib/api/http.ts`, `web/.env.example`). A API continua com `PORT` padrão 3000 (igual ao `next dev`), por isso deve ser iniciada com `PORT=3001`. | Evita colisão de portas em desenvolvimento local. |

Consequência prática: ao reutilizar este ADR como referência, ler 6.5, 7.1, 7.4 e 10 junto com esta seção.

Fechamento: a execução do Playwright, a medição do RNF06 (8.7) e o stub da API (11.5) foram revistos no `docs/adr/0002-lancamentos-financeiros-fechamento.md`, que prevalece sobre esses pontos.
