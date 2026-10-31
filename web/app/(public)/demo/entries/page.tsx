import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { redirectToInitialMonth } from "@/features/entries/redirect-to-initial-month";
import { EntriesScreen } from "@/features/entries/entries-screen";

export const metadata: Metadata = { title: "Lançamentos (demonstração)" };

export default async function DemoEntriesPage(props: PageProps<"/demo/entries">) {
  const searchParams = await props.searchParams;
  const reader = createFinanceReader("demo");
  // Sem `month` na URL resolve o mes inicial e redireciona (replace); com `month` nao faz nada (ADR 0007 7.2)
  await redirectToInitialMonth(searchParams, DEMO_MODE, reader);
  return <EntriesScreen searchParams={searchParams} mode={DEMO_MODE} reader={reader} />;
}
