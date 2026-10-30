import { Skeleton } from "@/components/ui/states";

/** Carregando Meu perfil / Trocar senha: skeleton dos cards. */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex max-w-[560px] flex-col gap-4 md:gap-6">
      <span className="sr-only">Carregando</span>
      <Skeleton className="h-9 w-48" />
      <div className="card flex flex-col gap-4 p-5 md:p-8">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-40" />
      </div>
    </div>
  );
}
