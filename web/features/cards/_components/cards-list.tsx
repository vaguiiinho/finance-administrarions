"use client";

import Link from "next/link";
import { useAppMode } from "@/components/app-mode";
import { monthLongPtBR } from "@/lib/dates/format";
import { changeFilter, changeTab, entriesHref, parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { CardDto } from "@/lib/api/types";
import { EditCardButton } from "./card-drawer";

/** Atalho "Ver despesas do mes" (DR8, CA77): aba Despesas, mes atual (SP), filtro de cartao = este cartao. */
function expensesHref(cardId: string, currentMonth: string, basePath: "" | "/demo"): string {
  const base = parseEntriesSearchParams({ month: currentMonth });
  return entriesHref(changeFilter(changeTab(base, "expenses"), { d_card: cardId }), basePath);
}

export function CardsList({ cards, currentMonth }: { cards: CardDto[]; currentMonth: string }) {
  const { basePath } = useAppMode();
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const titleId = `card-${card.id}`;
        return (
          <li key={card.id} aria-labelledby={titleId} className="card flex flex-col gap-3 p-4">
            <div>
              <h2 id={titleId} className="font-display text-base font-semibold text-text">
                {card.name}
              </h2>
              <p aria-hidden="true" className="text-sm text-muted">
                Fecha dia {card.closingDay} · Vence dia {card.dueDay}
              </p>
              <span className="sr-only">
                {card.name} · Fecha dia {card.closingDay} · Vence dia {card.dueDay}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <EditCardButton card={card} />
              <Link href={expensesHref(card.id, currentMonth, basePath)} aria-label={`Ver despesas de ${card.name} em ${monthLongPtBR(currentMonth)}`} className="btn btn-tertiary">
                Ver despesas
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
