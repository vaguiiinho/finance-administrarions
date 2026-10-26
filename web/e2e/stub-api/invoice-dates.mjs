// Espelho de `calculateInvoiceDates` do dominio da api (RF05). Paridade garantida por
// `api/test/fixtures/invoice-dates.cases.json` (ADR 0002 T5): o spec ao lado e o da api leem a mesma tabela.

const pad = (n) => String(n).padStart(2, "0");
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const addMonths = (year, month, n) => {
  const idx = year * 12 + (month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};
const effectiveDay = (day, year, month) => Math.min(day, daysInMonth(year, month));
const iso = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/** @returns {{ closingDate: string, dueDate: string, referenceMonth: string }} */
export function calculateInvoiceDates(date, closingDay, dueDay) {
  const [year, month, day] = date.split("-").map(Number);

  // Etapa 1: fechamento no mes da compra se o dia da compra <= fechamento efetivo; senao no mes seguinte.
  const closing = day <= effectiveDay(closingDay, year, month) ? { year, month } : addMonths(year, month, 1);
  const closingEffective = effectiveDay(closingDay, closing.year, closing.month);

  // Etapa 2: vencimento no mes do fechamento se o dia efetivo for maior que o do fechamento; senao no seguinte.
  const dueMonthBase = (() => {
    const dueSame = effectiveDay(dueDay, closing.year, closing.month);
    return dueSame > closingEffective ? closing : addMonths(closing.year, closing.month, 1);
  })();
  const dueEffective = effectiveDay(dueDay, dueMonthBase.year, dueMonthBase.month);

  const dueDate = iso(dueMonthBase.year, dueMonthBase.month, dueEffective);
  return {
    closingDate: iso(closing.year, closing.month, closingEffective),
    dueDate,
    referenceMonth: dueDate.slice(0, 7),
  };
}
