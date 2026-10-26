import { todaySP } from "@/lib/dates/format";
import { listCardsCached, listCategoriesCached, settle } from "@/lib/api/queries";
import type { EntriesState } from "@/lib/filters/entries-search-params";
import { NewEntryDrawer } from "./new-entry-drawer";

/** Busca cartoes (C2) e categorias (E6) em paralelo, fora do caminho critico da pagina (dentro de <Suspense>). */
export async function EntryDrawerHost({ state }: { state: EntriesState }) {
  const [cards, categories] = await Promise.all([settle(listCardsCached()), settle(listCategoriesCached())]);
  return <NewEntryDrawer today={todaySP()} state={state} cards={cards.ok ? cards.data.items : []} cardsError={!cards.ok} categories={categories.ok ? categories.data.items : []} />;
}
