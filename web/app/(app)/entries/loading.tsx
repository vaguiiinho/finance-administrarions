import { MonthSummarySkeleton } from "@/components/month-summary";
import { Skeleton } from "@/components/ui/states";
import { ListPanelSkeleton } from "./_components/panel-skeletons";

/** Carregamento inicial da rota: skeleton com a geometria final (cabecalho, resumo, abas, painel). */
export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Carregando lançamentos</span>
      <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
        <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Lançamentos</h1>
        <Skeleton className="h-12 w-full max-w-md" />
        <MonthSummarySkeleton />
      </div>
      <div className="mb-4 flex min-h-[var(--tabsbar-h)] items-center border-b border-border">
        <Skeleton className="h-11 w-full max-w-md" />
      </div>
      <ListPanelSkeleton />
    </div>
  );
}
