import { Skeleton } from "@/components/ui/states";
import { CHART_HEADER_SKELETON, DONUT_ARRANGEMENT, DONUT_CONTAINER, DONUT_LEGEND, DONUT_RING, MONTHLY_CHART_HEIGHT } from "./chart-layout";

/** Placeholder do figcaption do ChartCard: titulo (28px) + subtitulo (20px) sem gap = 48px a esquerda, alternador (44px + 2px de borda do .segmented = 46px) a direita. */
function ChartHeaderSkeleton() {
  return (
    <div data-testid="chart-header-skeleton" className={CHART_HEADER_SKELETON}>
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-[46px] w-44" />
    </div>
  );
}

export function ChartSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="card flex flex-col gap-4 p-4 md:p-5">
      <span className="sr-only">{label}</span>
      <ChartHeaderSkeleton />
      <Skeleton className={`w-full ${MONTHLY_CHART_HEIGHT}`} />
    </div>
  );
}

export function DonutSkeleton() {
  return (
    <div aria-busy="true" className="card flex flex-col gap-4 p-4 md:p-5">
      <span className="sr-only">Carregando despesas por categoria</span>
      <ChartHeaderSkeleton />
      <div className={DONUT_CONTAINER}>
        <div className={DONUT_ARRANGEMENT}>
          <Skeleton className={`${DONUT_RING} rounded-full`} />
          <div className={DONUT_LEGEND}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
