"use client";

import Link from "next/link";
import { MonthPicker } from "@/components/month-picker";
import { useNav } from "@/components/navigation";

/** Titulo, seletor de mes unico (padrao: mes atual em SP) e atalho para os lancamentos do mes (5.3). */
export function DashboardHeader({ month, currentMonth }: { month: string; currentMonth: string }) {
  const { navigate } = useNav();
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Dashboard</h1>
      <div className="flex flex-col gap-2 md:items-end">
        <MonthPicker month={month} currentMonth={currentMonth} onSelect={(next) => navigate(`/dashboard?month=${next}`, { scope: "all" })} />
        <Link href={`/entries?month=${month}`} className="btn btn-tertiary self-start md:self-end">
          Ver lançamentos do mês
        </Link>
      </div>
    </header>
  );
}
