import { Skeleton } from "@/components/ui/states";

export function ListPanelSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Carregando lançamentos</span>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="hidden flex-col gap-2 md:flex">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function InvoicesPanelSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Carregando faturas</span>
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}
