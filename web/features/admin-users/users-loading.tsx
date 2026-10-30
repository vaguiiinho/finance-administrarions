import { Skeleton } from "@/components/ui/states";

/** Carregando a lista: titulo, botao "Novo usuario" como skeleton e 4 linhas (tabela a partir de `md`, itens abaixo). */
export function UsersLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 md:gap-6">
      <span className="sr-only">Carregando usuários</span>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Usuários</h1>
        <Skeleton className="h-11 w-full sm:w-36" />
      </header>
      <div className="glass-flat hidden flex-col gap-0 overflow-clip rounded-xl md:flex">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="m-3 h-12" />
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
