import { ChartSkeleton, DonutSkeleton } from "./_components/dashboard-skeletons";
import { DashboardLayout } from "./_components/dashboard-layout";
import { MonthSummarySkeleton } from "@/components/month-summary";

export function DashboardLoading() {
  return (
    <DashboardLayout
      header={<h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Dashboard</h1>}
      summary={<MonthSummarySkeleton />}
      monthly={<ChartSkeleton label="Carregando evolução mensal" />}
      categories={<DonutSkeleton />}
    />
  );
}
