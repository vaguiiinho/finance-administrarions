import { Skeleton } from "@/components/ui/states";

export function CardsSkeleton() {
  return (
    <ul aria-busy="true" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <li className="sr-only">Carregando cartões</li>
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Skeleton className="h-32 w-full rounded-xl" />
        </li>
      ))}
    </ul>
  );
}
