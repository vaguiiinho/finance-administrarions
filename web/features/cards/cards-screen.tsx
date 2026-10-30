import { Suspense } from "react";
import { type AppMode } from "@/lib/app-mode";
import { AppModeProvider } from "@/components/app-mode";
import { UpdatingRegion } from "@/components/navigation";
import { BlockErrorBoundary } from "@/components/ui/block-error-boundary";
import { EmptyState } from "@/components/ui/states";
import type { FinanceReader } from "@/lib/api/finance-reader";
import { currentYearMonthSP } from "@/lib/dates/format";
import { CardDrawerProvider, NewCardButton } from "./_components/card-drawer";
import { CardsList } from "./_components/cards-list";
import { CardsSkeleton } from "./_components/cards-states";

async function Cards({ reader }: { reader: FinanceReader }) {
  const { items } = await reader.listCards();
  if (items.length === 0) {
    return (
      <EmptyState title="Nenhum cartão cadastrado" description="Cadastre um cartão para registrar compras no crédito.">
        <NewCardButton variant="primary" />
      </EmptyState>
    );
  }
  return <CardsList cards={items} currentMonth={currentYearMonthSP()} />;
}

/** Tela de cartoes (ADR 0005 9.6): a mesma no protegido e na demo; "+ Novo cartao" e "Editar" so existem fora da demo. */
export function CardsScreen({ mode, reader }: { mode: AppMode; reader: FinanceReader }) {
  return (
    <AppModeProvider mode={mode}>
      <CardDrawerProvider>
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Cartões</h1>
            <NewCardButton className="w-full md:w-auto" />
          </div>
          <p className="text-sm text-muted">Compras até o dia de fechamento entram na fatura que vence logo depois. A fatura aparece no mês do vencimento.</p>
          <UpdatingRegion scope="panel">
            <BlockErrorBoundary message="Não foi possível carregar os cartões.">
              <Suspense fallback={<CardsSkeleton />}>
                <Cards reader={reader} />
              </Suspense>
            </BlockErrorBoundary>
          </UpdatingRegion>
        </div>
      </CardDrawerProvider>
    </AppModeProvider>
  );
}
