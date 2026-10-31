// Espelho da regra do mes inicial (ADR 0007 secao 3, RF01) para o stub. A fonte da verdade e `resolveInitialMonth` da api;
// a paridade e travada por `initial-month.spec.ts`, que le a MESMA fixture (`api/test/fixtures/initial-month.cases.json`).
const next = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** facts: { currentMonth, firstPendingMonth | null, hasCard } -> { month, advance } */
export function resolveInitialMonth({ currentMonth, firstPendingMonth, hasCard }) {
  if (firstPendingMonth !== null && firstPendingMonth < currentMonth) throw new Error("firstPendingMonth anterior a M (o read model filtra a partir de M)");
  if (firstPendingMonth === currentMonth) return { month: currentMonth, advance: "NONE" };
  if (firstPendingMonth !== null) return { month: firstPendingMonth, advance: "NEXT_PENDING" };
  if (hasCard) return { month: next(currentMonth), advance: "NO_PENDING_AHEAD" };
  return { month: currentMonth, advance: "NONE" };
}
