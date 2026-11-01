# ADR 0007 - Listagem de lançamentos: mês inicial e status padrão orientados a pendências

- **Status:** Aceito (2026-10-30). Aprovado pelo usuário, com as decisões da seção 0; implementado na branch `feat/listies`. Divergências da implementação: seção 15.
- **Adendo:** a decisão PV2 sobre faturas anteriores a M foi alterada pelo ADR 0009: faturas de cartão pendentes antigas passam a ser selecionadas; PIX anterior a M continua ignorado.
- **Data:** 2026-10-30
- **Spec:** `docs/specs/listagem-mes-e-status-padrao.md` (rev. 3)
- **Relacionados:** ADR 0001 (contratos, BFF, URL como estado), ADR 0005 (dono, demo, `FinanceReader`, `AppMode`), ADR 0006 (cancelamento, aprovado e ainda não implementado), `docs/api/finance.md`
- **Autor:** architect

**Limite de verificação deste ADR (texto original, anterior à implementação).** Foi produzido por leitura de código, sem executar nada. Portanto:
- os `EXPLAIN` e os p95 da seção 8 **não foram rodados**;
- o comportamento do Next.js 16.4.3 vem da documentação e do código em `web/node_modules/next`, e deve ser provado pelos e2e indicados.

---

## 0. Decisões registradas na aprovação

| Item | Decisão | Efeito neste ADR |
|---|---|---|
| **PV1** | PIX futuro conta na busca pela próxima pendência. | Mantém o padrão (seção 11). |
| **PV2 (decisão original, refinada pelo ADR 0009)** | Pendência anterior a M não interfere. | Aplicável a PIX antigo; fatura de cartão pendente antiga passou a ser selecionada. |
| **PV3** | Sem cartão e sem pendência: abre em M. | Mantém o padrão (seção 11). |
| **R3** | Opção A: avanço sem limite. | Risco aceito (seção 12). |
| **RNF01** | Vale número constante de consultas e p95 abaixo de 300 ms. | Resolve C2. O índice de contingência continua condicionado à medição (seção 8). |
| **Atalho de fatura paga** | Abre Despesas com `d_status=ALL`. | Muda 7.4 e diverge de RF19 e CA58 (C9). |

**Sem decisão do usuário:** se cartão inativo conta em `hasCard`. Fica a resolver quando o ADR 0006 for implementado, sem efeito nesta feature, pois hoje não existe cartão inativo.

---

## 1. Resumo das decisões

| T | Decisão | Seção |
|---|---|---|
| **T1** | Regra pura no domínio (`resolveInitialMonth`), caso de uso `GetInitialEntriesMonth`, `GET /api/entries/initial-month` e `GET /api/demo/entries/initial-month`. O web não contém a regra. | 3, 5, 6.1 |
| **T2** | Sem `month` na URL, a página resolve o mês e chama `redirect()` (tipo `replace`), mantendo os demais parâmetros. Aviso por `adv` e `adv_from`, removidos da URL pelo cliente na montagem. | 7.2, 7.3 |
| **T3** | `d_status` e `f_status` aceitam `PENDING`, `PAID` e `ALL`. Ausente ou inválido = `PENDING`. A serialização omite `PENDING` e escreve `PAID` e `ALL`. `ALL` não chega à API. | 7.1 |
| **T4** | Uma única consulta (`MIN(reference_month)` + `EXISTS` de cartão). **Sem migração**, condicionada à medição da seção 8. Enquanto resolve, a tela mostra o `loading.tsx` atual. Timeout de 1,5 s nessa leitura. | 8 |
| **T5** | A regra recebe M como dado, sem relógio. "Agora" vem do port `BusinessCalendar`, já existente, sobre `Clock`. O stub ganha `now` por cenário. Sem gancho de relógio no código de produção do web. | 5.2, 10 |
| **T6** | `status` opcional em `GET /api/invoices` (e demo), filtrado no SQL com `HAVING`. Sem `status`, a resposta não muda. | 5.3, 6.2 |

Banco: nenhuma mudança de schema, migração ou dado. Contratos: 2 rotas novas e 1 parâmetro opcional em 2 rotas existentes, todos aditivos.

---

## 2. Bounded context e linguagem ubíqua

Tudo fica em **Finanças pessoais** (`api/src/modules/finance/`). `identity` não muda. No shared kernel, só se reutilizam `BusinessCalendar`, `Clock` e `YearMonth`.

| Negócio (spec) | Código |
|---|---|
| Mês atual (M) | `BusinessCalendar.currentMonth()`; `currentMonth` no DTO |
| Pendência | linha `type = 'EXPENSE' AND status = 'PENDING'` |
| Mês inicial | `InitialMonthDecision.month`; `month` no DTO |
| Avanço de mês | `MonthAdvance` (`NONE`, `NEXT_PENDING`, `NO_PENDING_AHEAD`) |
| Escolha explícita de mês | `month` válido na URL |
| Status padrão | `DEFAULT_STATUS_FILTER = 'PENDING'` (só no web) |
| "Todos" | `StatusFilter = 'ALL'` (só no web); na API, ausência de `status` |
| Fatura pendente / paga | `pendingCount > 0` / `pendingCount = 0`, com ao menos uma despesa |

---

## 3. Modelo de domínio

**Aggregates e entidades:** nenhuma mudança. `Entry` e `Card` não são tocados (RF02).

**Repositórios de domínio:** nenhuma mudança. Trata-se de leitura, e o projeto já separa leituras em `*ReadModel` na camada de application.

**Domain events:** nenhum. Não há mudança de estado.

**Value objects:**
- `ReferenceMonth` ganha `next(): ReferenceMonth`, delegando a `YearMonth.next()`.
- `MonthAdvance` é um tipo união fechado.

**Regra pura**, em `domain/initial-month/resolve-initial-month.ts`, importando só `ReferenceMonth`:

```ts
export type MonthAdvance = 'NONE' | 'NEXT_PENDING' | 'NO_PENDING_AHEAD';

export interface InitialMonthFacts {
  currentMonth: ReferenceMonth;
  /** Menor mês de referência >= currentMonth com pendência; null se não houver. */
  firstPendingMonth: ReferenceMonth | null;
  hasCard: boolean;
}

export interface InitialMonthDecision {
  month: ReferenceMonth;
  advance: MonthAdvance;
}

export function resolveInitialMonth(facts: InitialMonthFacts): InitialMonthDecision;
```

| RF01 | `firstPendingMonth` | `hasCard` | `month` | `advance` |
|---|---|---|---|---|
| 1 | = M | indiferente | M | `NONE` |
| 2 | > M | indiferente | `firstPendingMonth` | `NEXT_PENDING` |
| 3 | null | true | M+1 | `NO_PENDING_AHEAD` |
| 4 | null | false | M | `NONE` |

**Invariantes:**
1. `advance = NONE` se e somente se `month = M`.
2. `month >= M`.
3. `NO_PENDING_AHEAD` implica `hasCard` e `month = M+1`.
4. `firstPendingMonth < M` lança `InvariantViolationError`, pois o read model filtrou a partir de M. Sob PV2, é erro de programação, não dado de negócio.

---

## 4. Violações de SOLID no código atual que afetam a feature

| # | Onde | Violação | Efeito | Tratamento |
|---|---|---|---|---|
| S1 | `entries-search-params.ts` (`status?`), `changeFilter`, `expense-filters.tsx` (`apply({})`, `setDraft({})`, `?? "ALL"`), `expenses-panel.tsx`, `feedback.ts` | SRP e OCP: "ausente = Todos" está implícito e espalhado, com a limpeza duplicada em `CLEAR_EXPENSE_FILTERS`, `apply({})` e `expenses: {}` | R8 | `status` passa a ser **obrigatório** no tipo, e o compilador aponta cada ponto. Uma só função de limpeza (7.1). |
| S2 | `invoice-block.tsx` | SRP: renderização, leitura sob demanda, pagamento, toast e foco no mesmo componente. DIP: importa Server Actions de `app/` | RF21 aumenta o acoplamento | Decisão de foco em função pura `focusTargetAfterPay` (7.5). A extração completa fica fora de escopo. |
| S3 | `PANEL_TITLE_ID` em `expenses-panel.tsx` | DIP: constante compartilhada presa a um módulo de servidor, que o `invoice-block` (cliente) não deve importar | RF21 precisa dela | Mover para `_components/panel-ids.ts`. |
| S4 | `matchesFilters` e `toApiQuery` | OCP: ramificam por aba, e `matchesFilters` lê filtros de Despesas | Faturas agora tem filtro | Acrescentar o ramo de Faturas com teste. Sem refatorar para estratégia: são 3 abas estáveis. |
| S5 | `monthQuerySchema` | ISP: um só schema para 5 rotas | Ampliá-lo aceitaria `status` em resumo e dashboard | Novo `invoicesQuerySchema`. |
| S6 | `parseExpenseStatus` | Nome preso a Despesas | Passa a servir Faturas | Renomear para `parsePaymentStatusFilter`, mantendo campo e código de erro. |
| S7 | `FinanceReadHandlers` | OCP e SRP: cada leitura edita a classe | Baixo | Seguir o padrão. Não refatorar nesta feature. |
| S8 | Stub (`server.mjs`, `invoice-dates.mjs`) | Regra duplicada em relação ao domínio | Haveria uma terceira cópia de regra | Fixture de casos compartilhada, no padrão de `invoice-dates.cases.json` (10). |

---

## 5. Application

### 5.1 Port novo

`application/ports/pending-overview-read-model.ts`:

```ts
export interface PendingOverview {
  firstPendingMonth: ReferenceMonth | null;
  hasCard: boolean;
}

export interface PendingOverviewReadModel {
  /** Pendências do dono a partir de `from` (inclusive) e se ele tem cartão, em uma única consulta. */
  overviewFrom(ownerId: OwnerId, from: ReferenceMonth): Promise<PendingOverview>;
}

export const PENDING_OVERVIEW_READ_MODEL = Symbol('PENDING_OVERVIEW_READ_MODEL');
```

Port próprio, por ISP e por ser uma consulta só, em vez de `EntryReadModel` + `CardReadModel.hasAny`, que custariam duas idas ao banco.

### 5.2 Caso de uso `GetInitialEntriesMonth`

Em `application/use-cases/entries/get-initial-entries-month.ts`.

```ts
export interface GetInitialEntriesMonthInput { ownerId: string }
export interface GetInitialEntriesMonthOutput {
  currentMonth: ReferenceMonth;
  month: ReferenceMonth;
  advance: MonthAdvance;
}
// constructor(overview: PendingOverviewReadModel, calendar: BusinessCalendar)
```

Passos: `requireOwnerId`; `ReferenceMonth.of(calendar.currentMonth())`; `overviewFrom(ownerId, M)`; `resolveInitialMonth`. O dono vem sempre do principal, ou é `DEMO_USER_ID` na demo (RNF04).

### 5.3 Caso de uso `ListInvoices` (alterado)

```ts
export type InvoiceStatusFilter = 'PENDING' | 'PAID';
export interface InvoiceListCriteria { month: ReferenceMonth; status?: InvoiceStatusFilter }

export interface InvoiceReadModel {
  listByMonth(ownerId: OwnerId, criteria: InvoiceListCriteria): Promise<InvoiceRow[]>;
  listEntries(ownerId: OwnerId, key: InvoiceKey): Promise<EntryView[]>;
}
```

- Entrada: `{ ownerId, month, status? }`. Saída: inalterada.
- O filtro seleciona a fatura inteira: totais e contagens continuam sobre todas as despesas (RF18, DR7).

### 5.4 Infraestrutura

`PrismaPendingOverviewReadModel` (`$queryRaw`, como os demais; DATE não depende de fuso):

```sql
SELECT
  (SELECT to_char(MIN(e.reference_month), 'YYYY-MM')
     FROM entries e
    WHERE e.user_id = $1::uuid AND e.reference_month >= $2::date
      AND e.type = 'EXPENSE' AND e.status = 'PENDING') AS first_pending_month,
  EXISTS (SELECT 1 FROM cards c WHERE c.user_id = $1::uuid) AS has_card
```

`PrismaInvoiceReadModel.listByMonth` acrescenta, depois do `GROUP BY`:
- `PENDING`: `HAVING COUNT(*) FILTER (WHERE e.status = 'PENDING') > 0`
- `PAID`: `HAVING COUNT(*) FILTER (WHERE e.status = 'PENDING') = 0`

Registro: token em `FINANCE_INFRASTRUCTURE_PROVIDERS`; caso de uso em `USE_CASE_PROVIDERS`, com `[PENDING_OVERVIEW_READ_MODEL, BUSINESS_CALENDAR]`.

---

## 6. Contratos HTTP

Erros no formato `{ code, message, details }`. Queries estritas, como as demais.

### 6.1 Novo: mês inicial

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/entries/initial-month` | Autenticado; dono = principal |
| GET | `/api/demo/entries/initial-month` | `@Public()`; dono = `DEMO_USER_ID` |

Sem query. Resposta 200:

```json
{ "currentMonth": "2026-10", "month": "2026-12", "advance": "NEXT_PENDING" }
```

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` (`UNKNOWN_FIELD`) | Parâmetro de query informado |
| 401 | `UNAUTHENTICATED` | Sem sessão válida (rota protegida) |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Troca de senha pendente (rota protegida) |
| 500 | `INTERNAL_ERROR` | Falha inesperada; o web abre em M (RNF02) |

Não há 404: a rota não recebe id, e a ausência de pendência é um resultado válido. Não há conflito de rota, pois `EntriesController` só tem `GET expenses` e `GET incomes`.

### 6.2 Alterado: faturas

`GET /api/invoices?month=YYYY-MM[&status=PENDING|PAID]` e o equivalente em `/api/demo/invoices`.

- Sem `status`: resposta idêntica à atual.
- Corpo: inalterado, com `items` filtrado.
- `status=ALL`, `status=pending` etc.: 400 `VALIDATION_ERROR`, `details.fields[0] = { field: "status", code: "INVALID_VALUE", ... }`. `ALL` é rejeitado de propósito, para expor um vazamento do web.
- `month` inválido: como hoje.

### 6.3 Demo

- `DemoController` ganha `GET entries/initial-month`; `invoices` passa a usar `invoicesQuerySchema`. Mesmo contrato, via `FinanceReadHandlers`.
- As rotas públicas de demo passam de 9 para 10. O inventário de `test/e2e/access-control.e2e-spec.ts` e a seção 6.5 do ADR 0005 precisam refletir isso. Nenhuma rota de escrita é criada.
- **Dataset (`buildDemoDataset`):** o mês-âncora tem pendências (PIX "Internet" e cartão), então CA24 se cumpre sem alterar dados nem `DEMO_TEMPLATE_VERSION`.
- **Âncora defasada:** logo após a virada do mês e antes do `RefreshDemoDataset`, a fatura de âncora+1 mantém a demo em M. Se a manutenção falhar por mais de um mês, a demo avança para M+1 com aviso, o que é correto para os dados que existem.
- `/demo/entries` usa a mesma função de redirecionamento, com o reader demo. Falha resulta em M, sem redirecionar para login.

---

## 7. Impacto no Next.js

### 7.1 Status na URL (T3)

| URL | Estado | Enviado à API |
|---|---|---|
| ausente, `PENDING` ou inválido | `PENDING` | `status=PENDING` |
| `PAID` | `PAID` | `status=PAID` |
| `ALL` | `ALL` | sem `status` |

Vale igualmente para `d_status` e `f_status` (RF13, CA35, CA50).

Mudanças em `entries-search-params.ts`:

```ts
export type StatusFilter = 'ALL' | 'PENDING' | 'PAID';
export const DEFAULT_STATUS_FILTER: StatusFilter = 'PENDING';

export interface ExpenseFilters { status: StatusFilter; category?: string; card?: string }
export interface InvoiceFilters { status: StatusFilter }
// EntriesState ganha: invoices: InvoiceFilters
// FilterPatch: d_status e f_status passam a StatusFilter (sem undefined)
```

- **Forma canônica:** `serialize` omite `PENDING`. Existe um único caminho para o padrão, e o redirecionamento não polui a URL. Um `d_status=PENDING` já presente em link antigo continua válido e só some na próxima navegação.
- **R8:** com `status` obrigatório, `{}`, `apply({})`, `setDraft({})` e `expenses: {}` deixam de compilar. Esse é o principal mitigador.
- **"Limpar filtros":** uma só função (`clearExpenseFilters`, `clearInvoiceFilters`), que define `ALL`. Substitui `CLEAR_EXPENSE_FILTERS`.
- **`hasExpenseFilters` e contador:** contam `status !== 'ALL'` (RF11, CA37).
- **`toApiQuery`:** aba Faturas passa a enviar `status`; `ALL` nunca é enviado; aba Receitas segue sem status (CA44).

### 7.2 Mês inicial e redirecionamento (T1, T2, RF07)

Novo módulo puro `web/lib/filters/initial-month.ts` e novo `features/entries/redirect-to-initial-month.ts` (`server-only`), chamado no início de `(protected)/entries/page.tsx` e `(public)/demo/entries/page.tsx`, antes de renderizar `EntriesScreen`:

1. `month` presente na URL, válido ou não: não faz nada (RF06, RF08).
2. `settle(reader.getInitialMonth())`. O `settle` já repassa redirect de 401 e 403 (ADR 0005 9.4).
3. Sucesso: `redirect` para a URL com `month`, mantendo os demais parâmetros (P05) e acrescentando o sinal de aviso se `advance !== 'NONE'`.
4. Falha ou timeout: `redirect` para `?month=<M do web>`, sem aviso (RNF02, CA22).

**Por que redirecionar também na falha.** Sem `month` na URL, a revalidação após pagar rodaria a regra de novo e poderia trocar o mês, violando RF07. Custo: recarregar não tenta de novo; a próxima abertura pelo menu, sim.

**Comportamento real por causa do `loading.tsx`.** As duas rotas têm `loading.tsx`, então a página renderiza em contexto de streaming. A documentação do `redirect` e o código do Next indicam que, nesse caso, a resposta é HTTP 200 com `<meta http-equiv="refresh" content="1;url=...">`, e o redirect acontece no cliente com `replace`. Sem JavaScript, o usuário espera cerca de 1 s. É o mesmo mecanismo já usado pelo `guarded` para a sessão expirada. **CA29 precisa ser provado por e2e**, em carga completa e em navegação no cliente.

**Plano B, se CA29 falhar:** mover a resolução para `proxy.ts` (alternativa A3, seção 9), com `prefetch={false}` nos links sem `month`.

**Efeitos:** R9 fica resolvido, pois o skeleton aparece enquanto a leitura corre e nenhum cabeçalho é mostrado com mês errado. Prefetch não executa a página, pois para no `loading.tsx`. Isso depende do `prefetch` padrão: nenhum componente de produção usa `prefetch={true}`.

`FinanceReader` e `endpoints.ts` ganham `getInitialMonth`. `request()` ganha a opção `timeoutMs`, usada só nessa leitura, com `AbortSignal.timeout(1500)`. Hoje `request()` não tem timeout, e uma API travada prenderia o usuário no skeleton, contrariando RNF02. `listInvoices` passa a receber `{ month, status? }`.

### 7.3 Aviso de avanço (RF05)

Sinal na URL de redirecionamento: `adv=NEXT_PENDING|NO_PENDING_AHEAD` e `adv_from=YYYY-MM`.

- **Validação:** `adv` na lista fechada, `adv_from` no formato correto e `adv_from < month`. Caso contrário, é ignorado sem erro. O texto vem só de modelos fixos, com nomes de meses formatados, nunca de texto da URL.
- **Consumo:** `MonthAdvanceNotice` (cliente), renderizado por `EntriesScreen`, guarda o sinal em estado local e, na montagem, remove os dois parâmetros com `window.history.replaceState`, API que a documentação do Next diz integrar ao roteador.
- **Efeito:** recarregar, Voltar e copiar o link não repetem o aviso. Revalidar após pagar também não.
- **Duração:** visível enquanto o mês da tela for o mesmo do aviso. Sai ao trocar de mês (CA25). Forma, texto e dispensa ficam com o ui-designer.
- **Isolamento:** `adv` e `adv_from` não entram em `EntriesState`, então `serializeEntriesState` nunca os propaga.
- **Janela residual aceita:** entre o carregamento e a hidratação, o sinal fica na URL. Um link copiado nesse intervalo mostra o aviso uma vez. Sem JavaScript, o sinal permanece.

### 7.4 Aba Faturas

- `InvoicesPanel` chama `reader.listInvoices({ month, status })` e renderiza o novo `InvoiceStatusFilter`, com o mesmo `SegmentedControl` e a folha mobile de Despesas (RF16).
- Vazios (RF20), avaliados com `items = []`:
  1. `listCards` com sucesso e vazio: "Nenhuma fatura neste mês" + "Cadastrar cartão" (CA54).
  2. `status !== 'ALL'`, inclusive se `listCards` falhar: vazio com filtros + "Limpar filtros" (CA52, CA53).
  3. `status === 'ALL'`: "Nenhuma fatura neste mês" (CA53).
- `InvoiceBlock` segue sem filtrar conteúdo (RF18).
- Atalho para Despesas:
  - fatura paga (`pendingCount === 0`): abre com `d_status=ALL`, substituindo o status vigente, para que as despesas pagas apareçam;
  - fatura com pendência, inclusive parcial: continua preservando o `d_status` vigente (RF19, CA58);
  - nos dois casos, mantém o mês da fatura e o filtro pelo cartão. Divergência registrada em C9.

### 7.5 Pagamento sob filtro (RF21)

Função pura `focusTargetAfterPay(status: StatusFilter): 'panel' | 'block'`: `ALL` resulta em `block`; os demais, em `panel`. O foco usa `document.getElementById(PANEL_TITLE_ID)?.focus()`.

A decisão vem do filtro, não da existência do ref, porque a revalidação pode já ter desmontado o bloco quando a action retorna. O título do painel fica em `EntriesScreen`, fora do bloco. O toast é global e sobrevive à desmontagem.

### 7.6 Toasts e links (RF12, RF22)

- `withMonthAndTab` passa a usar `status: 'ALL'` em Despesas, para que despesa paga apareça (CA40, CA41).
- Em Faturas, com compra de cartão no mesmo mês e `f_status=PAID`: mensagem "não aparece" + "Limpar filtros", levando a `f_status=ALL` (CA57).
- `matchesFilters` passa a tratar a aba Faturas.

Sem Server Action nova. `payInvoice` segue com `revalidatePath`.

### 7.7 Arquivos afetados

| Área | Arquivos |
|---|---|
| Páginas | `(protected)/entries/page.tsx`, `(public)/demo/entries/page.tsx` |
| Filtros | `lib/filters/entries-search-params.ts`, novo `lib/filters/initial-month.ts` |
| API client | `lib/api/http.ts`, `endpoints.ts`, `finance-reader.ts`, `types.ts` |
| Tela | `entries-screen.tsx`, `expense-filters.tsx`, `expenses-panel.tsx`, `invoices-panel.tsx`, `invoice-block.tsx`; novos `month-advance-notice.tsx`, `invoice-status-filter.tsx`, `panel-ids.ts` |
| Toasts | `lib/entries/feedback.ts` |
| Testes | ver seção 10 |

`proxy.ts` e `route-policy.ts` não mudam.

---

## 8. Prisma, índices e migração (T4)

**Decisão: nenhuma mudança em `schema.prisma`, nenhuma migração e nenhum dado alterado (P07).** A decisão é por análise e fica **condicionada à medição abaixo**.

| Leitura | Índice esperado | Análise |
|---|---|---|
| `MIN(reference_month)` | `entries_owner_month_type_status_idx (user_id, reference_month, type, status)` | Igualdade em `user_id`, faixa em `reference_month`, `type` e `status` avaliados no próprio índice. Para na primeira pendência. |
| `EXISTS` de cartão | `cards_owner_name_key_uq (user_id, name_key)` | Prefixo por dono. |
| `listByMonth` com `HAVING` | O mesmo do plano atual | `HAVING` atua após a agregação. O custo fica limitado a um mês. |

**Pior caso.** A faixa começa em M e percorre as linhas não pendentes do dono até a primeira pendência, ou até o fim. O número de consultas é constante, mas as entradas de índice lidas crescem com o que existe entre M e a próxima pendência (conflito C2, resolvido na seção 0).

**A linha de base existente não serve.** O arquivo em `api/test/perf/results` mais recente (commit `7d8e57e`) usa índices sem dono (`entries_month_type_status_idx`), anteriores à migração `20261029000002`. Além disso, `seed-volume.ts` tem cerca de 50% das despesas pendentes, então a primeira pendência aparece quase de imediato e o pior caso não seria exercitado.

**Medição obrigatória** em `test/perf/rnf06.perf-spec.ts`, que já captura `EXPLAIN (ANALYZE)` da última amostra:

| Cenário | Configuração |
|---|---|
| `IM1 mes inicial, pendencia em M` | Massa atual |
| `IM2 mes inicial, pior caso` | M no primeiro mês da massa, com todas as despesas `PAID` exceto as do último mês. Requer expor o relógio em `startFinanceE2e` (hoje não exposto). Rodar por último, pois altera a massa. |
| `I1 faturas status=PENDING` e `status=PAID` | Massa atual |

**Critério de migração:** só se `IM2` tiver p95 >= 300 ms ou Seq Scan em `entries`.

**Contingência, só nesse caso:**

```prisma
@@index([userId, type, status, referenceMonth], map: "entries_owner_type_status_month_idx")
```

Igualdade nas três primeiras colunas leva direto à primeira pendência, de forma independente da distância. Preferido ao índice parcial por ser representável no `schema.prisma`, sem SQL manual nem risco de divergência. Custo: mais um índice nas escritas de `entries`. Migração aditiva, apenas `CREATE INDEX`, com rollback por `DROP INDEX`.

**Carregamento (RNF01, R9):** medir na tarefa 20 da spec o tempo entre a navegação e o cabeçalho com o mês final, nos cenários com e sem `month`.

---

## 9. Decisões, alternativas e trade-offs

| # | Alternativa descartada | Motivo |
|---|---|---|
| A1 | Compor o mês no web com leituras atuais | Exige varrer meses, contraria RNF01 e duplica regra. |
| A2 | Filtrar faturas no web por `pendingCount` | Sem mudança de contrato, mas os consumidores repetiriam a semântica, e a API perderia o teste de integração da regra. A spec indica o filtro na API como sugestão. |
| A3 | Resolver o mês em `proxy.ts` | Daria 307 real. Porém a documentação informa que `next-router-prefetch` é removido do `request` no Proxy, então prefetch dispararia consulta e poderia guardar um redirecionamento defasado no cliente. Duplicaria também o tratamento de 401 e 403, já resolvido em `guarded`. **Mantida como plano B.** |
| A4 | Remover `loading.tsx` para obter 307 na página | Perde o skeleton nas navegações por mês, filtro e aba. |
| A5 | Renderizar sem redirecionar e usar `replaceState` para gravar o mês | Antes da hidratação, o mês não está fixado, e RF07 passa a depender do cliente. |
| A6 | Cookie flash para o aviso | Componente de servidor não grava cookie, exigiria Proxy ou Route Handler, e há corrida entre abas. |
| A7 | `sessionStorage` (`lib/flash.ts`) para o aviso | O servidor não escreve nele. O resultado do redirecionamento precisaria de outro canal de qualquer forma. |
| A8 | `adv` permanente na URL | Reaparece ao recarregar e ao copiar o link, o que a spec proíbe. |
| A9 | Sempre escrever `d_status=PENDING` | Duas formas para o mesmo estado, e URLs mais longas sem ganho funcional. |
| A10 | `status=ALL` na API | O contrato atual já expressa "todos" pela ausência, e a spec o mantém. |
| A11 | Regra recebendo `Clock` | Domínio passaria a depender de conceito de tempo e fuso. M como dado é mais simples de testar. |

**Trade-offs aceitos:**
- Na abertura sem `month`, há uma leitura e um redirecionamento a mais. Nas demais navegações, custo zero.
- HTTP 200 com redirect no cliente em vez de 307 (7.2).
- Falha transitória fixa M até a próxima abertura.
- `listByMonth` muda de assinatura, com ajuste em specs de integração e fakes.

---

## 10. Plano de testes

Red antes da implementação, conforme o fluxo do `CLAUDE.md`.

| Camada | Ferramenta | Conteúdo | CA |
|---|---|---|---|
| Domain | Unitário, sem I/O | `resolveInitialMonth`: tabela do RF01, invariantes, virada de ano. `ReferenceMonth.next()` | CA01-CA17, CA21 (pela regra, com dados) |
| Application | Unitário, fakes | `GetInitialEntriesMonth` com `FixedBusinessCalendar`: propagação de M, dono, sem leitura extra. `ListInvoices`: `status` válido, ausente e inválido (sem chamar o read model) | CA23, CA45, CA47 |
| Shared | Unitário | `SaoPauloBusinessCalendar` com `FixedClock` nos instantes exatos | CA18, CA19, CA20 |
| Infra (read models) | Integração com testcontainers | `overviewFrom`: cartão e PIX, `PAID` e `PENDING`, antes e depois de M, `INCOME` ignorada, com e sem cartão, dois donos. `listByMonth`: filtros, fatura parcial com totais inteiros, sem `status` igual ao anterior | CA03, CA09, CA10, CA14, CA21, CA23, CA45-CA47 |
| Presentation | e2e com supertest | Rotas protegida e demo, 401, 403, 400 `UNKNOWN_FIELD`, `status` inválido e `ALL`, isolamento, `FixedClock`. Atualizar `access-control.e2e-spec.ts` e `demo.e2e-spec.ts` | CA23, CA24, CA59 |
| Arquitetura | `test/architecture.spec.ts` existente | Domínio segue sem dependência externa | RNF07 |
| Perf | `rnf06.perf-spec.ts` | Seção 8 | RNF01 |
| Web, puro | Vitest | Parse e serialize de `d_status` e `f_status`, `toApiQuery`, limpeza, `hasExpenseFilters`, `initial-month.ts` (preserva parâmetros, valida sinal), `feedback`, `focusTargetAfterPay` | CA33-CA36, CA40, CA41, CA44, CA48-CA50, CA57 |
| Web, componentes | Vitest + Testing Library | Filtros, folha mobile, vazios, painel, foco, aviso remove parâmetros; atalho do bloco (fatura paga com `d_status=ALL`, mesmo com outro status vigente; fatura com pendência preserva o vigente); `redirect-to-initial-month` (sucesso, falha, 401 repassado, `month` presente) | CA22, CA25, CA26, CA27, CA31, CA37-CA39, CA45, CA51-CA56, CA58 (C9) |
| Web, e2e | Playwright + stub | Fluxos completos, Voltar em carga completa e no cliente, menu sem `month`, pagamento, demo, axe nos dois temas | CA25, CA28-CA30, CA37, CA51, CA59, RNF06 |

**Relógio (T5):**
- **API:** `FixedClock` já existe em `e2e-app`.
- **Stub:** `POST /__scenario { name, now? }`, com padrão no relógio real. Corrigir também `buildDemo`, que usa o mês em UTC (`server.mjs`, linha 226), incoerente com RNF03 na virada do mês.
- **Web:** `parseEntriesSearchParams(raw, now)` já recebe `now`, e o mesmo padrão vale para `initial-month.ts`. Sem variável de ambiente nem gancho de relógio em produção.
- **Limitação assumida:** `page.clock` do Playwright não altera o Node do Next. As fronteiras de fuso (CA18-CA20) ficam garantidas em unitários e nos cenários do stub. O e2e valida mês vindo da API, não o relógio do servidor web.

**Stub:**
- rota `/entries/initial-month` em `READS` (cobre protegido e demo);
- `/invoices` com `status`, rejeitando `ALL` e valores inválidos com 400;
- cenários com pendências configuráveis;
- nova fixture `api/test/fixtures/initial-month.cases.json`, consumida pelo teste de domínio e por um `initial-month.spec.ts` do stub, para detectar divergência entre as cópias.

**Testes existentes a ajustar (R10):** `entries-search-params.spec.ts`, `feedback.spec.ts`, `panels.spec.tsx`, `invoice-block.spec.tsx`, `demo-mode.spec.tsx`, `finance-reader.spec.ts`, `entries.pw.ts`, `demo-shell.pw.ts`, `read-models.int-spec.ts`, `owner-isolation.int-spec.ts`, `invoices-queries.spec.ts`.

Atenção a e2e que usam `goto('/entries')` sem `month`, pois passam a ser redirecionados, e a cenários com `delayMs` ou `holdQueries`, que podem atingir o timeout de 1,5 s e cair em M.

---

## 11. Premissas validadas e alternativas descartadas

**O usuário confirmou o padrão da spec nas três premissas (seção 0).** As alternativas abaixo não serão implementadas; o impacto fica como registro. Em todos os casos, o contrato HTTP permaneceria compatível.

| Premissa | Decisão | Alternativa descartada | Impacto que a alternativa teria |
|---|---|---|---|
| **PV1** | Pendência futura inclui PIX | Só faturas nos meses futuros | **Regra:** recebe `pendingInCurrentMonth` e `firstFutureInvoiceMonth`. **SQL:** duas condições, e `payment_method` não está no índice, exigindo leitura do heap; reavaliar índice. **CA:** CA10 e CA13 mudam. **Negócio:** quem tem só PIX futuro abre em M+1 (com cartão) ou em M (sem cartão), e o PIX futuro não atrai a abertura. |
| **PV2 (refinada pelo ADR 0009)** | Decisão original: pendência anterior a M não interfere | Abrir no mês mais antigo com pendência | Aplicada somente a faturas de cartão antigas: busca histórica restrita a `payment_method = CARD`; PIX antigo continua ignorado. O mês pode ser menor que M e `advance = NONE` evita o aviso de avanço. CA14/CA19 especificam PIX antigo; RFH01 cobre fatura antiga. A demo usa o mesmo fluxo e seu histórico anterior à âncora já está pago. |
| **PV3** | Sem cartão e sem pendência: fica em M | M+1 também sem cartão | **Regra:** `hasCard` deixa de existir; port e SQL simplificam (sai o `EXISTS`). **CA:** CA11 muda, e RF01 perde a condição 4. **Negócio:** usuário novo ou só de PIX nunca abre no mês corrente e cai em mês vazio, agravando R2. |

Rever qualquer uma delas após a implementação afetaria principalmente `resolveInitialMonth`, sua fixture e os CA citados. PV1 é a única que poderia afetar índice.

---

## 12. Risco R3: avanço sem limite por data digitada errada

**Situação.** A API aceita datas de 1900 a 9998. Uma única pendência com ano errado, como 2036, passa a definir a abertura até ser paga. Como não há edição nem exclusão, pagar é a única saída, o que falseia os dados. RF05 e "Mês atual" apenas mitigam.

**O usuário escolheu a opção A (seção 0): o risco é aceito e o avanço não tem limite (P08).** As demais opções não fazem parte desta feature e ficam como registro.

| Opção | O que muda | Prós | Contras |
|---|---|---|---|
| **A. Manter sem limite** (escolhida) | Nada | Regra e CA como estão | R3 permanece |
| **B. Janela máxima de N meses na regra** | `resolveInitialMonth` recebe N. Além dela, a pendência é tratada como inexistente ou sinalizada. SQL inalterado. | Elimina o salto longo | Exige definir N e o comportamento além da janela; pendência legítima distante deixa de atrair a abertura; altera P08 e pode afetar CA16 |
| **C. Aviso reforçado para salto longo** | Só web: limiar sobre `month` e `currentMonth`, já presentes no DTO | Sem mudança de API; custo baixo | Não evita o salto; depende de ui-designer |
| **D. Validação ou confirmação na criação** | Drawer (confirmação) ou `NewEntryInput` (limite rígido) | Ataca a origem | Fora da spec; altera a spec de origem; não corrige dados existentes; limite rígido pode barrar uso legítimo |
| **E. Cancelamento do ADR 0006** | Nada aqui: já aprovado, ainda não implementado | Dá uma saída sem falsear pagamento; `status = 'PENDING'` já exclui `CANCELED` | Depende da ordem de entrega; não evita o salto até o cancelamento |

As opções não são exclusivas. A arquitetura acomoda B e C sem mudar o contrato atual. D e E não dependem desta feature.

---

## 13. Conflitos e tensões

Nenhum altera a spec, conforme solicitado.

| # | Item | Situação | Registro neste ADR |
|---|---|---|---|
| **C1** | T2 sugere redirecionar "no servidor" | Com `loading.tsx`, o `redirect()` na página vira HTTP 200 + redirect no cliente, não 307 | Intenção atendida (sem entrada no histórico), a confirmar por e2e. Plano B: A3. |
| **C2** | RNF01: "o custo não cresce com a distância" | A consulta é única, mas as entradas de índice lidas crescem com as linhas entre M e a próxima pendência. P07 e a tarefa 1 pedem índice só se a medição exigir | **Resolvido pelo usuário:** vale número constante de consultas e p95 abaixo de 300 ms. O índice de contingência continua condicionado à medição (seção 8). |
| **C3** | T5 sugere "relógio injetado na regra" | Regra recebe M como dado; o relógio fica em `BusinessCalendar` | Refinamento compatível com `CLAUDE.md` e com a tarefa 2 da spec. |
| **C4** | R3 e `docs/api/finance.md` afirmam que não há exclusão | Verdadeiro hoje, mas ADR 0006 está aprovado com cancelamento | Ver seção 12, opção E. |
| **C5** | ADR 0006 e esta feature tocam o mesmo SQL | ADR 0006 filtra `listByMonth` por lançamento efetivo. Fatura só com cancelados precisa continuar fora da lista, não virar "paga" | Coordenar a ordem de merge. `status = 'PENDING'` no mês inicial já é compatível. **A resolver na implementação do ADR 0006, sem efeito nesta feature:** cartão inativo conta em `hasCard`? Nem a spec nem o usuário definiram. |
| **C6** | ADR 0005 9.3: "o proxy só olha a presença do cookie" | O `proxy.ts` atual já chama `GET /auth/me` em `/login` | Documentação defasada; esta feature não muda o proxy. Doc-writer pode corrigir. |
| **C7** | ADR 0005 6.5: "9 rotas" de demo | Passam a 10 | Atualizar documentação e inventário de teste. |
| **C8** | `docs/api/finance.md`, linha 8: "Não há autenticação" | Desatualizado desde o ADR 0005 | Corrigir junto com a documentação das rotas novas. |
| **C9** | RF19 e CA58: o atalho do bloco mantém o status vigente em Despesas | Por decisão do usuário, o atalho de fatura paga abre com `d_status=ALL` | Vale a decisão do usuário para fatura paga (7.4); fatura com pendência segue RF19 e CA58. A spec não foi alterada e precisa de ajuste por quem a mantém, inclusive um caso de CA para fatura paga. |

---

## 14. Riscos residuais

| Risco | Mitigação |
|---|---|
| R3: data errada define a abertura | Risco aceito pelo usuário (opção A); RF05 e "Mês atual" mitigam |
| R8: ponto esquecido de "ausente = Todos" | `status` obrigatório no tipo + testes de CA36-CA41 |
| CA29 falhar por causa do redirect em streaming | e2e nos dois modos de navegação; plano B definido |
| IM2 acima do limite | Índice de contingência já especificado |
| Linha de base de performance defasada | Nova execução obrigatória antes do fechamento |
| Divergência do stub | Fixture compartilhada e rejeição de `ALL` no stub |
| Redirecionamento quebrar e2e existentes | Levantamento na seção 10 |
| R1, R2, R5 (produto) | Inalterados; RF05 mitiga R2 |
| R4 (produto) | Mitigado para faturas de cartão pendentes antigas; PIX antigo continua sem definir o mês inicial. |

---

## 15. Divergências da implementação (registro pós-implementação)

Conferido contra o código da árvore de trabalho em 2026-10-30. O restante do ADR foi implementado como escrito; as linhas abaixo são o que difere ou o que fechou pendências deste documento.

### 15.1 Divergências

| # | ADR | Código | Efeito |
|---|---|---|---|
| **V1** | S6 (seção 4): renomear `parseExpenseStatus` para `parsePaymentStatusFilter`. | Não houve renomeação. `parseExpenseStatus` mantém o nome e continua sendo usado por `ListExpenses`. `ListInvoices` usa `parseInvoiceStatus`, um alias que apenas delega a `parseExpenseStatus` (`api/src/modules/finance/application/queries/query-params.ts`). Comportamento igual: só `PENDING` e `PAID`; qualquer outro valor, inclusive `ALL`, gera `status: INVALID_VALUE`. | Nenhum no contrato HTTP. O nome preso a Despesas (S6) permanece. Decisão: registrar, sem alterar código. |
| **V2** | Seção 7.2: o redirecionamento usa `settle(reader.getInitialMonth())`. | `redirectToInitialMonth` (`web/features/entries/redirect-to-initial-month.ts`) usa `try/catch` e `unstable_rethrow(error)`: redirects de sessão e not-found são repassados, e qualquer outra falha (inclusive timeout) cai em `fallbackMonthHref` (`month=<M do web>`, sem aviso). | Mesmo comportamento descrito (RNF02, CA22). |
| **V3** | Seção 10: sem variáveis de ambiente novas de teste. | `web/playwright.config.ts` lê `PW_WEB_PORT` (padrão 3100) e `PW_STUB_PORT` (padrão 4010), usadas também por `web/e2e/support.ts` e `web/e2e/auth-login.pw.ts`. Só afetam a execução do Playwright, nunca o código de produção. | Documentado em `web/README.md` e `README.md`. |

### 15.2 Pendências deste ADR que foram fechadas

| # | Situação |
|---|---|
| **C7** | ADR 0005 recebeu notas de atualização (seção 6.5 e decisão D3): 10 rotas públicas de demo. O inventário de `api/test/e2e/access-control.e2e-spec.ts` lista as 10. |
| **C8** | `docs/api/finance.md` descreve a autenticação e a rota demo. |
| **C6** | Nota de atualização na seção 9.3 do ADR 0005. |
| **C9** | A spec foi revista (rev. 3) e RF19 e CA58 já tratam o atalho de fatura paga com `d_status=ALL`. O código segue isso: o `href` de `InvoiceBlock` acrescenta `d_status: "ALL"` quando a fatura está totalmente paga, e o rótulo vira "Ver despesas do cartão na aba Despesas". |

### 15.3 Confirmado no código

- **Sem migração.** A última migration continua `20261029000002_finance_ownership`; não há índice de contingência (seção 8). Os cenários de medição `IM1`, `IM2` e `I1 status=PENDING|PAID` existem em `api/test/perf/rnf06.perf-spec.ts`. Os resultados das medições (p95 e `EXPLAIN`) não estão registrados neste ADR.
- **Consulta única.** `PrismaPendingOverviewReadModel.overviewFrom` executa o SQL da seção 5.4. O filtro de faturas usa `HAVING COUNT(*) FILTER (WHERE e.status = 'PENDING')` (`> 0` para `PENDING`, `= 0` para `PAID`).
- **Timeout de 1,5 s.** `INITIAL_MONTH_TIMEOUT_MS = 1500` em `web/lib/api/endpoints.ts`, aplicado por `request()` com `AbortSignal.timeout` nas duas leituras (protegida e demo).
- **Sinal de aviso.** `adv` e `adv_from` são validados em `parseAdvanceSignal` (`adv_from < month`) e removidos da URL por `MonthAdvanceNotice` com `history.replaceState`.
- **Redirect em streaming (C1/CA29).** Os testes `CA29` de `web/e2e/initial-month.pw.ts` cobrem Voltar em navegação no cliente e depois de carga completa. O resultado da execução não está registrado aqui.

## 16. Adendo pelo ADR 0009 — fatura de cartão pendente mais antiga

O ADR 0009, aprovado em 2026-11-01, altera a regra histórica de PV2 sem tornar PIX antigo elegível. `PendingOverviewReadModel` retorna, em uma consulta, tanto `firstPendingMonth` (todas as despesas pendentes a partir de M) quanto `oldestPendingCardMonth` (faturas de cartão pendentes em qualquer mês). `resolveInitialMonth` escolhe a fatura antiga se `oldestPendingCardMonth < M`; caso contrário, aplica a tabela original.

Para o mês histórico, `advance = NONE` significa que não há aviso de avanço futuro; o redirecionamento fixa o mês na URL sem `adv`. A referência gravada continua sendo a autoridade, mês explícito e fallback permanecem iguais, e os endpoints protegido e demo compartilham a decisão. O PIX antigo não entra na consulta histórica.
