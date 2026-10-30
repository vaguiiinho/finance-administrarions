import { ChartSkeleton, DonutSkeleton } from "./_components/dashboard-skeletons";
import { MonthSummarySkeleton } from "@/components/month-summary";

export function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Dashboard</h1>
      <MonthSummarySkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <ChartSkeleton label="Carregando evolução mensal" />
        </div>
        <div className="lg:col-span-4">
          <DonutSkeleton />
        </div>
      </div>
    </div>
  );
}
