import { CardsSkeleton } from "./_components/cards-states";

export function CardsLoading() {
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-text md:text-[32px]">Cartões</h1>
      <CardsSkeleton />
    </div>
  );
}
