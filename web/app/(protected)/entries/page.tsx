import type { Metadata } from "next";
import { PROTECTED_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { redirectToInitialMonth } from "@/features/entries/redirect-to-initial-month";
import { EntriesScreen } from "@/features/entries/entries-screen";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function EntriesPage(props: PageProps<"/entries">) {
  const searchParams = await props.searchParams;
  const reader = createFinanceReader("protected");
  // Sem `month` na URL resolve o mes inicial e redireciona (replace); com `month` nao faz nada (ADR 0007 7.2)
  await redirectToInitialMonth(searchParams, PROTECTED_MODE, reader);
  const user = await getCurrentUser();
  return <EntriesScreen searchParams={searchParams} mode={PROTECTED_MODE} reader={reader} canEditExpenses={user?.role === "ADMIN"} />;
}
