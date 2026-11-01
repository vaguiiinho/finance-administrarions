import { todaySP } from "@/lib/dates/format";
import { createFinanceReader, type FinanceReader } from "@/lib/api/finance-reader";
import { settle } from "@/lib/api/queries";
import type { EntriesState } from "@/lib/filters/entries-search-params";
import { NewEntryDrawer } from "./new-entry-drawer";
import { InstallmentExpenseDrawer } from "./installment-expense-drawer";

/** Busca cartoes (C2) e categorias (E6) em paralelo, fora do caminho critico da pagina (dentro de <Suspense>). */
export async function EntryDrawerHost({ state, reader = createFinanceReader("protected") }: { state: EntriesState; reader?: FinanceReader }) {
  const [cards, categories] = await Promise.all([settle(reader.listCards()), settle(reader.listCategories())]);
  const shared = { cards: cards.ok ? cards.data.items : [], cardsError: !cards.ok, categories: categories.ok ? categories.data.items : [] };
  return (
    <>
      <NewEntryDrawer today={todaySP()} state={state} {...shared} />
      <InstallmentExpenseDrawer today={todaySP()} {...shared} />
    </>
  );
}
