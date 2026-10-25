import { MonthSummary } from "@/components/month-summary";
import { getCategoryDistribution, getMonthlySeries } from "@/lib/api/endpoints";
import { getSummaryCached } from "@/lib/api/queries";
import { CategoryDonut } from "./category-donut";
import { MonthlyChart } from "./monthly-chart";

/** Cards do mes: a MESMA fonte (S1) do topo de /entries (CA59). */
export async function SummaryCards({ month }: { month: string }) {
  const { totals } = await getSummaryCached(month);
  return <MonthSummary month={month} totals={totals} headingId="dashboard-summary-heading" />;
}

export async function MonthlyChartBlock({ month }: { month: string }) {
  const series = await getMonthlySeries(month);
  return <MonthlyChart series={series} selectedMonth={month} />;
}

export async function CategoryDonutBlock({ month }: { month: string }) {
  const distribution = await getCategoryDistribution(month);
  return <CategoryDonut distribution={distribution} />;
}
