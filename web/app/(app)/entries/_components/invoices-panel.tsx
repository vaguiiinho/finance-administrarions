import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { countLabel } from "@/lib/entries/feedback";
import { listInvoices } from "@/lib/api/endpoints";
import { listCardsCached, settle } from "@/lib/api/queries";
import { InvoiceBlock } from "./invoice-block";
import { NewEntryButton } from "./entry-drawer-context";
import type { EntriesState } from "@/lib/filters/entries-search-params";

/** Painel da aba Faturas (RF21): um bloco por cartao com despesa no mes, em ordem de vencimento (vem da API). */
export async function InvoicesPanel({ state }: { state: EntriesState }) {
  const { items } = await listInvoices(state.month);

  if (items.length === 0) {
    const cards = await settle(listCardsCached());
    const noCards = cards.ok && cards.data.items.length === 0;
    return (
      <EmptyState title="Nenhuma fatura neste mês" description="Compras no cartão aparecem na fatura do mês em que vencem.">
        <NewEntryButton variant="primary" />
        {noCards ? (
          <Link href="/cards" className="btn btn-tertiary">
            Cadastrar cartão
          </Link>
        ) : null}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite">
        Mostrando {countLabel(items.length, "fatura", "faturas")}
      </p>
      <p className="text-sm text-muted">
        <span className="font-medium">{countLabel(items.length, "fatura", "faturas")}.</span> Cada fatura aparece no mês em que vence.
      </p>
      <div className="flex flex-col gap-4">
        {items.map((invoice) => (
          <InvoiceBlock key={`${invoice.card.id}-${invoice.referenceMonth}`} invoice={invoice} state={state} />
        ))}
      </div>
    </div>
  );
}
