import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { NavLink } from "@/components/navigation";
import { monthLongPtBR } from "@/lib/dates/format";
import { countLabel } from "@/lib/entries/feedback";
import { PROTECTED_MODE, type AppMode } from "@/lib/app-mode";
import { createFinanceReader, type FinanceReader } from "@/lib/api/finance-reader";
import { settle } from "@/lib/api/queries";
import { clearInvoiceFilters, entriesHref, type EntriesState } from "@/lib/filters/entries-search-params";
import { InvoiceBlock } from "./invoice-block";
import { InvoiceStatusFilter } from "./invoice-status-filter";
import { NewEntryButton } from "./entry-drawer-context";
import { PANEL_TITLE_ID } from "./panel-ids";

const QUALIFIER = { PENDING: ", pendentes", PAID: ", pagas", ALL: "" } as const;

/**
 * Painel da aba Faturas (RF21, ADR 0007 7.4): filtro de status, um bloco por fatura em ordem de vencimento (vem da API) e
 * vazios por condicao (design 5.2). O filtro e a regiao viva ficam na mesma posicao nos ramos com lista e vazio; sem cartao
 * o filtro nao existe (DL9).
 */
export async function InvoicesPanel({ state, reader = createFinanceReader("protected"), mode = PROTECTED_MODE }: { state: EntriesState; reader?: FinanceReader; mode?: AppMode }) {
  const { status } = state.invoices;
  const { items } = await reader.listInvoices({ month: state.month, ...(status === "ALL" ? {} : { status }) });
  const monthLabel = monthLongPtBR(state.month);

  let noCards = false;
  if (items.length === 0) {
    const cards = await settle(reader.listCards());
    noCards = cards.ok && cards.data.items.length === 0;
  }

  const announcement =
    items.length > 0 ? `Mostrando ${countLabel(items.length, "fatura", "faturas")} de ${monthLabel}${QUALIFIER[status]}` : `Nenhuma fatura de ${monthLabel}${QUALIFIER[status]}`;

  let body;
  if (items.length > 0) {
    body = (
      <>
        <p className="text-sm text-muted">
          <span className="font-medium">{countLabel(items.length, "fatura", "faturas")}.</span> Cada fatura aparece no mês em que vence.
        </p>
        <div className="flex flex-col gap-4">
          {items.map((invoice) => (
            <InvoiceBlock key={`${invoice.card.id}-${invoice.referenceMonth}`} invoice={invoice} state={state} />
          ))}
        </div>
      </>
    );
  } else if (noCards || status === "ALL") {
    body = (
      <EmptyState title="Nenhuma fatura neste mês" description="Compras no cartão aparecem na fatura do mês em que vencem.">
        <NewEntryButton variant="primary" />
        {noCards ? (
          <Link href={`${mode.basePath}/cards`} className="btn btn-tertiary">
            Cadastrar cartão
          </Link>
        ) : null}
      </EmptyState>
    );
  } else {
    body = (
      <EmptyState
        title={`Nenhuma fatura para os filtros selecionados em ${monthLabel}`}
        description={`Não há faturas ${status === "PAID" ? "pagas" : "pendentes"} neste mês. "Limpar filtros" mostra todo o mês.`}
      >
        <NavLink href={entriesHref(clearInvoiceFilters(state), mode.basePath)} className="btn" focusId={PANEL_TITLE_ID}>
          Limpar filtros
        </NavLink>
        <NewEntryButton variant="primary" />
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {noCards ? null : <InvoiceStatusFilter state={state} />}
      {body}
    </div>
  );
}
