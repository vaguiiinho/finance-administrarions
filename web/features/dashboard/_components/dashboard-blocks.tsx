import { MonthSummary } from "@/components/month-summary";
import { getFinanceReader, type FinanceReader } from "@/lib/api/finance-reader";
import { CategoryDonut } from "./category-donut";
import { MonthlyChart } from "./monthly-chart";

/** Cards do mes: a MESMA fonte (S1) do topo de /entries (CA59). */
export async function SummaryCards({ month, reader = getFinanceReader() }: { month: string; reader?: FinanceReader }) {
  const { totals } = await reader.getSummary(month);
  return <MonthSummary month={month} totals={totals} headingId="dashboard-summary-heading" />;
}

export async function MonthlyChartBlock({ month, reader = getFinanceReader() }: { month: string; reader?: FinanceReader }) {
  const series = await reader.getMonthlySeries(month);
  return <MonthlyChart series={series} selectedMonth={month} />;
}

export async function CategoryDonutBlock({ month, reader = getFinanceReader() }: { month: string; reader?: FinanceReader }) {
  const distribution = await reader.getCategoryDistribution(month);
  return <CategoryDonut distribution={distribution} />;
}
