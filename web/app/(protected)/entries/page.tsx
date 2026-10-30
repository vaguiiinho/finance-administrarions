import type { Metadata } from "next";
import { PROTECTED_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { EntriesScreen } from "@/features/entries/entries-screen";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function EntriesPage(props: PageProps<"/entries">) {
  return <EntriesScreen searchParams={await props.searchParams} mode={PROTECTED_MODE} reader={createFinanceReader("protected")} />;
}
