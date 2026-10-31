"use client";

import { settleAction } from "@/lib/api/safe-action";
import { useId, useMemo, useRef, useState } from "react";
import { useAppMode } from "@/components/app-mode";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SessionExpiredInline, useAuthRedirect } from "@/components/session-expired";
import { InlineAlert } from "@/components/ui/states";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { formatCivilDate, formatInstant, formatInstantDate, monthLabelPtBR, monthLongPtBR } from "@/lib/dates/format";
import { formatBRL, sumDecimals } from "@/lib/money/decimal";
import { countLabel, paidFeedback } from "@/lib/entries/feedback";
import type { ActionError, EntryDto, PayEntriesResult } from "@/lib/api/types";
import { payEntries, payEntry } from "@/app/(protected)/entries/actions";
import { EntryItem, EntryRow, RecentBadge } from "./entry-drawer-context";
import { PayConfirmDialog } from "./pay-confirm-dialog";
import { useFocusAfterClose } from "./use-focus-after-close";
import { focusTargetAfterPay } from "@/lib/entries/focus-target";
import type { StatusFilter } from "@/lib/filters/entries-search-params";

interface ExpensesListProps {
  items: EntryDto[];
  /** Id do h2 do painel (foco apos pagar) */
  panelTitleId: string;
  /** Filtro de status vigente: sob "Todos" a linha paga permanece (foco na propria linha/card); nos demais ela sai (foco no h2). */
  statusFilter?: StatusFilter;
}

type Banner = { kind: "missing" | "income"; labels: string[] } | null;

const showInvoiceChip = (e: EntryDto) => e.paymentMethod === "CARD" && e.referenceMonth !== e.date.slice(0, 7);

function InvoiceChip({ entry }: { entry: EntryDto }) {
  if (!showInvoiceChip(entry)) return null;
  return (
    <span className="chip">
      <span aria-hidden="true">Fatura {monthLabelPtBR(entry.referenceMonth)}</span>
      <span className="sr-only">Fatura de {monthLongPtBR(entry.referenceMonth)}</span>
    </span>
  );
}

/** Linha da tabela (>= md) ou card (< md) da despesa: o que estiver visivel; no DOM os dois coexistem. */
function visibleEntryTarget(id: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>("[data-entry-id]")].filter((el) => el.dataset.entryId === id);
  return all.find((el) => el.offsetParent !== null) ?? all[0] ?? null;
}

const checkboxLabel = (e: EntryDto) => (e.status === "PENDING" ? `Selecionar ${e.description}, ${formatBRL(e.amount)}, ${formatCivilDate(e.date)}` : `${e.description} já pago`);

/**
 * Lista da aba Despesas (RF20): tabela em >= md e cards em < md (mesmo estado de selecao), selecao so de pendentes
 * (P12), pagamento individual/lote com confirmacao (D2) e banners de 404/422 do lote (3.10).
 */
export function ExpensesList({ items, panelTitleId, statusFilter = "ALL" }: ExpensesListProps) {
  // Na demo (so visualizacao) nada de escrita existe no DOM: sem checkbox, sem "Pagar", sem barra de lote (RF31, CA38)
  const { readOnly } = useAppMode();
  const uid = useId();
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<EntryDto[] | null>(null);
  const [confirmMode, setConfirmMode] = useState<"single" | "batch">("batch");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<ActionError | null>(null);
  useAuthRedirect(authError);
  const [banner, setBanner] = useState<Banner>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const focusAfterClose = useFocusAfterClose(confirm !== null);

  const pending = useMemo(() => items.filter((e) => e.status === "PENDING"), [items]);
  // derivado: o que foi pago por fora (revalidacao) sai da selecao sozinho
  const selected = useMemo(() => pending.filter((e) => selectedIds.has(e.id)), [pending, selectedIds]);
  const selectedTotal = useMemo(() => sumDecimals(selected.map((e) => e.amount)), [selected]);
  const allSelected = pending.length > 0 && selected.length === pending.length;

  const toggle = (id: string, on: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (on: boolean) => setSelectedIds(on ? new Set(pending.map((e) => e.id)) : new Set());

  const requestPay = (list: EntryDto[], mode: "single" | "batch") => {
    lastTrigger.current = document.activeElement as HTMLElement | null;
    setError(null);
    setConfirmMode(mode);
    setConfirm(list);
  };

  const confirmPay = async () => {
    if (!confirm || busy) return;
    const single = confirmMode === "single";
    setBusy(true);
    setError(null);
    setAuthError(null);
    const result = await settleAction<EntryDto | PayEntriesResult>(() => (single ? payEntry(confirm[0].id) : payEntries(confirm.map((e) => e.id))));
    setBusy(false);
    const labelOf = (id: string) => items.find((e) => e.id === id)?.description ?? id;

    if (result.ok) {
      const data = result.data;
      const counts = "paidIds" in data ? { paidCount: data.paidIds.length, alreadyPaidCount: data.alreadyPaidIds.length } : { paidCount: 1, alreadyPaidCount: 0 };
      setConfirm(null);
      setSelectedIds(new Set());
      setBanner(null);
      toast.push({ kind: "success", message: paidFeedback(counts, single ? confirm[0].description : undefined) });
      // so depois de o AlertDialog fechar (design 6.1/6.2, C3); em lote o foco segue no h2 do painel (RF24)
      const toPanel = !single || focusTargetAfterPay(statusFilter) === "panel";
      // Sob "Todos" a linha permanece como paga, mas o gatilho "Marcar como pago" some: o foco vai para a propria linha/card
      // (alvo estavel, tabIndex -1), localizado pelo id depois do fechamento do dialogo (design 6.2)
      const paidId = confirm[0].id;
      // se a linha ja nao existe quando o dialogo fecha (ex.: revalidacao a removeu), o foco cai no h2 do painel
      focusAfterClose(() => {
        const target = toPanel ? null : visibleEntryTarget(paidId);
        (target ?? document.getElementById(panelTitleId))?.focus();
      });
      return;
    }
    const { error: apiError } = result;
    if (apiError.code === "SESSION_EXPIRED" || apiError.code === "PASSWORD_CHANGE_REQUIRED") {
      setAuthError(apiError); // aviso no proprio dialogo e ida ao login/troca (design 8); nada foi pago
      return;
    }
    if (apiError.status === 404) {
      setConfirm(null);
      if (single) {
        toast.push({ kind: "error", message: "Esta despesa não foi encontrada. A lista foi atualizada." });
      } else {
        const missing = apiError.missingIds ?? [];
        setBanner({ kind: "missing", labels: missing.map(labelOf) });
        setSelectedIds((prev) => new Set([...prev].filter((id) => !missing.includes(id))));
      }
      return;
    }
    if (apiError.status === 422) {
      setConfirm(null);
      if (single) toast.push({ kind: "error", message: "Receitas não podem ser marcadas como pagas. Nada foi alterado." });
      else setBanner({ kind: "income", labels: (apiError.incomeIds ?? []).map(labelOf) });
      return;
    }
    setError("Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente.");
  };

  const batchButton = (
    <Button variant="primary" disabled={selected.length === 0} onClick={() => requestPay(selected, "batch")}>
      {selected.length > 0 ? `Marcar como pago (${selected.length})` : "Marcar como pago"}
    </Button>
  );

  const selectAll = (
    <Checkbox
      aria-label="Selecionar todas as despesas pendentes desta página"
      checked={allSelected}
      indeterminate={selected.length > 0 && !allSelected}
      disabled={pending.length === 0}
      onChange={(e) => toggleAll(e.target.checked)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {banner ? (
        <InlineAlert
          actions={
            <Button variant="tertiary" aria-label="Fechar aviso" onClick={() => setBanner(null)}>
              Fechar
            </Button>
          }
        >
          <p>
            Nenhuma despesa foi alterada.{" "}
            {banner.kind === "missing"
              ? `${countLabel(banner.labels.length, "despesa selecionada não foi encontrada", "despesas selecionadas não foram encontradas")}:`
              : "Receitas não podem ser marcadas como pagas:"}
          </p>
          <ul className="list-disc pl-5">
            {banner.labels.map((label, i) => (
              <li key={`${label}-${i}`}>{label}</li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}

      {/* Toolbar de selecao (>= md) */}
      {readOnly ? null : (
      <div className="hidden min-h-12 items-center justify-between gap-3 glass rounded-lg px-4 py-2 md:flex">
        {selected.length > 0 ? (
          <>
            <p className="text-sm text-text" aria-live="polite">
              {countLabel(selected.length, "selecionado", "selecionados")} · <Money value={selectedTotal} />
            </p>
            <div className="flex items-center gap-2">
              <Button variant="tertiary" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
              {batchButton}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Selecione despesas pendentes para pagar em lote</p>
            {batchButton}
          </>
        )}
      </div>
      )}

      {/* Tabela (>= md) */}
      <div className="glass-flat hidden overflow-clip rounded-xl md:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Despesas do mês, mais recentes primeiro</caption>
        <thead className="sticky top-[calc(var(--navbar-h)+var(--tabsbar-h))] z-10 glass-bar text-left text-muted">
          <tr className="border-b border-border-strong">
            {readOnly ? null : (
              <th scope="col" className="w-12 p-0 font-medium">
                {selectAll}
              </th>
            )}
            <th scope="col" className="px-2 py-3 font-medium">
              Descrição
            </th>
            <th scope="col" className="hidden px-2 py-3 font-medium xl:table-cell">
              Categoria
            </th>
            <th scope="col" className="hidden px-2 py-3 font-medium lg:table-cell">
              Forma
            </th>
            <th scope="col" className="px-2 py-3 font-medium">
              Data
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Valor
            </th>
            <th scope="col" className="px-2 py-3 font-medium">
              Status
            </th>
            {readOnly ? null : (
              <th scope="col" className="px-2 py-3 font-medium">
                Ação
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const isSelected = selectedIds.has(entry.id) && entry.status === "PENDING";
            return (
              <EntryRow key={entry.id} id={entry.id} className={`min-h-14 border-b border-border hover:bg-card-2 ${isSelected ? "row-selected" : ""}`}>
                {readOnly ? null : (
                  <td className="w-12 p-0">
                    <Checkbox aria-label={checkboxLabel(entry)} checked={isSelected} disabled={entry.status !== "PENDING"} onChange={(e) => toggle(entry.id, e.target.checked)} />
                  </td>
                )}
                <td className="max-w-[22rem] px-2 py-2">
                  <p className="flex min-w-0 items-center gap-2 font-medium text-text">
                    <span className="truncate" title={entry.description}>
                      {entry.description}
                    </span>
                    <span className="shrink-0">
                      <RecentBadge id={entry.id} />
                    </span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="xl:hidden">{entry.category}</span>
                    <span className="lg:hidden">{entry.card ? entry.card.name : "PIX"}</span>
                    <InvoiceChip entry={entry} />
                  </p>
                </td>
                <td className="hidden px-2 py-2 text-muted xl:table-cell">{entry.category}</td>
                <td className="hidden px-2 py-2 text-muted lg:table-cell">{entry.card ? entry.card.name : "PIX"}</td>
                <td className="px-2 py-2 text-text">{formatCivilDate(entry.date)}</td>
                <td className="px-2 py-2 text-right text-text">
                  <Money value={entry.amount} />
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={entry.status} />
                  {/* sem a coluna de acao, a data do pagamento acompanha o status */}
                  {readOnly && entry.paidAt ? <p className="text-xs text-muted">Pago em {formatInstantDate(entry.paidAt)}</p> : null}
                </td>
                {readOnly ? null : (
                  <td className="px-2 py-2">
                    {entry.status === "PENDING" ? (
                      <Button aria-label={`Marcar ${entry.description} como pago`} onClick={() => requestPay([entry], "single")}>
                        <span className="hidden lg:inline">Marcar como pago</span>
                        <span className="lg:hidden">Pagar</span>
                      </Button>
                    ) : entry.paidAt ? (
                      <span className="text-muted">Pago em {formatInstantDate(entry.paidAt)}</span>
                    ) : null}
                  </td>
                )}
              </EntryRow>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Cards (< md) */}
      <div className="flex flex-col gap-3 md:hidden">
        {readOnly ? null : (
          <label className="flex items-center gap-1 text-sm text-text">
            {selectAll}
            Selecionar pendentes ({pending.length})
          </label>
        )}
        <ul className="flex flex-col gap-3">
          {items.map((entry) => {
            const titleId = `${uid}-card-${entry.id}`;
            const isSelected = selectedIds.has(entry.id) && entry.status === "PENDING";
            return (
              <EntryItem key={entry.id} id={entry.id} aria-labelledby={titleId} className={`glass-flat rounded-xl p-4 ${isSelected ? "border-accent bg-card-2" : ""}`}>
                <div className="flex items-start gap-1">
                  {readOnly ? null : <Checkbox aria-label={checkboxLabel(entry)} checked={isSelected} disabled={entry.status !== "PENDING"} onChange={(e) => toggle(entry.id, e.target.checked)} className="-ml-3 -mt-2" />}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p id={titleId} className="flex min-w-0 items-center gap-2 font-medium text-text">
                        <span className="truncate">{entry.description}</span>
                        <span className="shrink-0">
                          <RecentBadge id={entry.id} />
                        </span>
                      </p>
                      <StatusBadge status={entry.status} />
                    </div>
                    <p className="text-sm text-muted">
                      {entry.category} · {formatCivilDate(entry.date)}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      {entry.card ? entry.card.name : "PIX"}
                      <InvoiceChip entry={entry} />
                    </p>
                    <p className="mt-1 text-right text-base font-semibold text-text">
                      <Money value={entry.amount} />
                    </p>
                  </div>
                </div>
                {entry.status === "PENDING" ? (
                  readOnly ? null : (
                    <Button className="mt-3 w-full" aria-label={`Marcar ${entry.description} como pago`} onClick={() => requestPay([entry], "single")}>
                      Marcar como pago
                    </Button>
                  )
                ) : entry.paidAt ? (
                  <p className="mt-2 text-sm text-muted">Pago em {formatInstant(entry.paidAt)}</p>
                ) : null}
              </EntryItem>
            );
          })}
        </ul>
      </div>

      {/* Barra de selecao fixa (< md) + espaco reservado para a ultima linha nao ficar coberta */}
      {!readOnly && selected.length > 0 ? (
        <>
          <div aria-hidden="true" className="h-24 md:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 glass-bar border-t border-border-strong px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:hidden">
            <p className="text-sm text-text" aria-live="polite">
              {countLabel(selected.length, "selecionado", "selecionados")} · <Money value={selectedTotal} />
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setSelectedIds(new Set())}>Limpar</Button>
              <Button variant="primary" className="flex-1" onClick={() => requestPay(selected, "batch")}>
                Marcar como pago ({selected.length})
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {confirm ? (
        <PayConfirmDialog
          items={confirm}
          mode={confirmMode}
          busy={busy}
          error={authError?.code === "SESSION_EXPIRED" ? <SessionExpiredInline redirectUrl={authError.redirectUrl} /> : error}
          onConfirm={() => void confirmPay()}
          onCancel={() => {
            setConfirm(null);
            setError(null);
            lastTrigger.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
