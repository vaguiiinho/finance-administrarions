"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppMode } from "@/components/app-mode";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useNav } from "@/components/navigation";
import { changeFilter, entriesHref, type EntriesState, type ExpenseFilters as Filters, type ExpenseStatusFilter } from "@/lib/filters/entries-search-params";
import type { CardDto } from "@/lib/api/types";

type StatusValue = "ALL" | ExpenseStatusFilter;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendente" },
  { value: "PAID", label: "Pago" },
] as const;

interface FilterControlsProps {
  idPrefix: string;
  values: Filters;
  onChange: (patch: Partial<Filters>) => void;
  categories: string[];
  categoriesError: boolean;
  cards: CardDto[];
  cardsError: boolean;
  onRetry: () => void;
}

function FilterControls({ idPrefix, values, onChange, categories, categoriesError, cards, cardsError, onRetry }: FilterControlsProps) {
  const category = values.category ?? "";
  const categoryList = category && !categories.some((c) => c.toLowerCase() === category.toLowerCase()) ? [category, ...categories] : categories;
  const card = values.card ?? "";
  const cardMissing = card !== "" && card !== "pix" && !cards.some((c) => c.id === card);
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span id={`${idPrefix}-status`} className="text-sm font-medium text-text">
          Status
        </span>
        <SegmentedControl<StatusValue>
          aria-labelledby={`${idPrefix}-status`}
          options={STATUS_OPTIONS}
          value={values.status ?? "ALL"}
          onChange={(v) => onChange({ status: v === "ALL" ? undefined : v })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-category`} className="text-sm font-medium text-text">
          Categoria
        </label>
        <select id={`${idPrefix}-category`} className="field" value={category} onChange={(e) => onChange({ category: e.target.value || undefined })}>
          <option value="">Todas as categorias</option>
          {categoryList.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {categoriesError ? (
          <p className="text-sm text-muted">
            Não foi possível carregar as categorias.{" "}
            <button type="button" className="text-accent underline" onClick={onRetry}>
              Tentar novamente
            </button>
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-card`} className="text-sm font-medium text-text">
          Cartão
        </label>
        <select id={`${idPrefix}-card`} className="field" value={card} onChange={(e) => onChange({ card: e.target.value || undefined })}>
          <option value="">Todos</option>
          <option value="pix">PIX</option>
          {cards.length > 0 ? <option disabled>──────────</option> : null}
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {cardMissing ? <option value={card}>Cartão não encontrado</option> : null}
        </select>
        {cardsError ? (
          <p className="text-sm text-muted">
            Não foi possível carregar os cartões.{" "}
            <button type="button" className="text-accent underline" onClick={onRetry}>
              Tentar novamente
            </button>
          </p>
        ) : null}
      </div>
    </>
  );
}

interface ExpenseFiltersProps {
  state: EntriesState;
  categories: string[];
  categoriesError: boolean;
  cards: CardDto[];
  cardsError: boolean;
}

/** Filtros da aba Despesas (RF20): inline em >= md (aplicam ao mudar); folha com "Aplicar" em < md (D6). */
export function ExpenseFilters({ state, categories, categoriesError, cards, cardsError }: ExpenseFiltersProps) {
  const { navigate } = useNav();
  const { basePath } = useAppMode();
  const router = useRouter();
  const uid = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(state.expenses);
  const active = state.expenses;
  const count = [active.status, active.category, active.card].filter(Boolean).length;

  const apply = (filters: Filters) =>
    navigate(entriesHref(changeFilter(state, { d_status: filters.status, d_category: filters.category, d_card: filters.card }), basePath), { scope: "panel" });
  const retry = () => router.refresh();
  const common = { categories, categoriesError, cards, cardsError, onRetry: retry };

  return (
    <div className="flex flex-col gap-3">
      {/* >= md: inline */}
      <div className="hidden items-end gap-4 md:flex">
        <FilterControls idPrefix={`${uid}-inline`} values={active} onChange={(patch) => apply({ ...active, ...patch })} {...common} />
        {count > 0 ? (
          <Button variant="tertiary" onClick={() => apply({})}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {/* < md: botao que abre a folha */}
      <div className="flex items-center gap-3 md:hidden">
        <Button
          aria-haspopup="dialog"
          onClick={() => {
            setDraft(active);
            setSheetOpen(true);
          }}
        >
          Filtros{count > 0 ? ` (${count})` : ""}
        </Button>
        {count > 0 ? (
          <Button variant="tertiary" onClick={() => apply({})}>
            Limpar
          </Button>
        ) : null}
      </div>

      {sheetOpen ? (
        <BottomSheet
          title="Filtros"
          titleId={`${uid}-sheet-title`}
          onClose={() => setSheetOpen(false)}
          onClear={() => setDraft({})}
          onApply={() => {
            setSheetOpen(false);
            apply(draft);
          }}
        >
          <div className="flex flex-col gap-4">
            <FilterControls idPrefix={`${uid}-sheet`} values={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} {...common} />
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

/** Filtro de categoria da aba Receitas (aplica ao mudar em todas as larguras). */
export function IncomeFilter({ state, categories, categoriesError }: { state: EntriesState; categories: string[]; categoriesError: boolean }) {
  const { navigate } = useNav();
  const { basePath } = useAppMode();
  const router = useRouter();
  const id = useId();
  const category = state.incomes.category ?? "";
  const list = category && !categories.some((c) => c.toLowerCase() === category.toLowerCase()) ? [category, ...categories] : categories;
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-[14rem] flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-text">
          Categoria
        </label>
        <select
          id={id}
          className="field"
          value={category}
          onChange={(e) => navigate(entriesHref(changeFilter(state, { r_category: e.target.value || undefined }), basePath), { scope: "panel" })}
        >
          <option value="">Todas as categorias</option>
          {list.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {categoriesError ? (
          <p className="text-sm text-muted">
            Não foi possível carregar as categorias.{" "}
            <button type="button" className="text-accent underline" onClick={() => router.refresh()}>
              Tentar novamente
            </button>
          </p>
        ) : null}
      </div>
      {category ? (
        <Button variant="tertiary" onClick={() => navigate(entriesHref(changeFilter(state, { r_category: undefined }), basePath), { scope: "panel" })}>
          Limpar filtro
        </Button>
      ) : null}
    </div>
  );
}
