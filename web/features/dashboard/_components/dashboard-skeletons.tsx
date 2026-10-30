import { Skeleton } from "@/components/ui/states";

export function ChartSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="card flex flex-col gap-4 p-5">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-[260px] w-full lg:h-[320px]" />
    </div>
  );
}

export function DonutSkeleton() {
  return (
    <div aria-busy="true" className="card flex flex-col items-center gap-4 p-5">
      <span className="sr-only">Carregando despesas por categoria</span>
      <Skeleton className="h-6 w-48 self-start" />
      <Skeleton className="h-[200px] w-[200px] rounded-full" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}
