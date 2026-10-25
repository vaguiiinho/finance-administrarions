import type { Metadata } from "next";
import { Suspense } from "react";
import { UpdatingRegion } from "@/components/navigation";
import { MonthSummarySkeleton } from "@/components/month-summary";
import { BlockErrorBoundary } from "@/components/ui/block-error-boundary";
import { currentYearMonthSP } from "@/lib/dates/format";
import { isYearMonth } from "@/lib/dates/format";
import { CategoryDonutBlock, MonthlyChartBlock, SummaryCards } from "./_components/dashboard-blocks";
import { DashboardHeader } from "./_components/dashboard-header";
import { ChartSkeleton, DonutSkeleton } from "./_components/dashboard-skeletons";
import { MonthNotice } from "../entries/_components/month-notice";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const raw = (await props.searchParams).month;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const currentMonth = currentYearMonthSP();
  const invalid = requested !== undefined && !isYearMonth(requested);
  const month = requested !== undefined && isYearMonth(requested) ? requested : currentMonth;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {invalid ? <MonthNotice /> : null}
      <DashboardHeader month={month} currentMonth={currentMonth} />
      <UpdatingRegion scope="summary" className="pt-1">
        <BlockErrorBoundary message="Não foi possível carregar o resumo." compact>
          <Suspense fallback={<MonthSummarySkeleton />}>
            <SummaryCards month={month} />
          </Suspense>
        </BlockErrorBoundary>
      </UpdatingRegion>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-8">
          <UpdatingRegion scope="panel" className="h-full pt-1">
            <BlockErrorBoundary message="Não foi possível carregar a evolução mensal.">
              <Suspense fallback={<ChartSkeleton label="Carregando evolução mensal" />}>
                <MonthlyChartBlock month={month} />
              </Suspense>
            </BlockErrorBoundary>
          </UpdatingRegion>
        </div>
        <div className="min-w-0 lg:col-span-4">
          <UpdatingRegion scope="panel" className="h-full pt-1">
            <BlockErrorBoundary message="Não foi possível carregar as despesas por categoria.">
              <Suspense fallback={<DonutSkeleton />}>
                <CategoryDonutBlock month={month} />
              </Suspense>
            </BlockErrorBoundary>
          </UpdatingRegion>
        </div>
      </div>
    </div>
  );
}
