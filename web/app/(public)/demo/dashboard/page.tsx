import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";

export const metadata: Metadata = { title: "Dashboard (demonstração)" };

export default async function DemoDashboardPage(props: PageProps<"/demo/dashboard">) {
  return <DashboardScreen searchParams={await props.searchParams} mode={DEMO_MODE} reader={createFinanceReader("demo")} />;
}
