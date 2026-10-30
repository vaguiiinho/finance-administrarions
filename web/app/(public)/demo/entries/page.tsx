import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { EntriesScreen } from "@/features/entries/entries-screen";

export const metadata: Metadata = { title: "Lançamentos (demonstração)" };

export default async function DemoEntriesPage(props: PageProps<"/demo/entries">) {
  return <EntriesScreen searchParams={await props.searchParams} mode={DEMO_MODE} reader={createFinanceReader("demo")} />;
}
