import type { Metadata } from "next";
import { PROTECTED_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  return <DashboardScreen searchParams={await props.searchParams} mode={PROTECTED_MODE} reader={createFinanceReader("protected")} />;
}
