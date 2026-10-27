"use client";

import { settleAction } from "@/lib/api/safe-action";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/dialogs";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/states";
import { Icon, StatusBadge, StatusDot } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { NavLink } from "@/components/navigation";
import { formatCivilDate, monthLongPtBR } from "@/lib/dates/format";
import { countLabel, invoicePaidFeedback } from "@/lib/entries/feedback";
import { changeFilter, changeTab, entriesHref, type EntriesState } from "@/lib/filters/entries-search-params";
import type { EntryDto, InvoiceDto } from "@/lib/api/types";
import { loadInvoiceEntries, payInvoice } from "../actions";

type ListState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; items: EntryDto[]; key: string };

/**
 * Bloco de fatura (RF21, D17): datas, totais, "Pagar fatura" e lista sob demanda (I2). O cache da lista usa a chave
 * (cartao, mes, pendente, pago) para ser descartado quando a fatura muda (ex.: apos "Pagar fatura", ADR 9.2).
 */
export function InvoiceBlock({ invoice, state }: { invoice: InvoiceDto; state: EntriesState }) {
  const uid = useId();
  const toast = useToast();
  const headingId = `${uid}-title`;
  const listId = `${uid}-list`;
  const paidNoteId = `${uid}-paid`;
  const dataKey = `${invoice.card.id}|${invoice.referenceMonth}|${invoice.totals.pending}|${invoice.totals.paid}`;

  const [expanded, setExpanded] = useState(false);
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const payButtonRef = useRef<HTMLButtonElement>(null);

  const monthLong = monthLongPtBR(invoice.referenceMonth);
  const fullyPaid = invoice.pendingCount === 0;

  const stale = list.status === "ready" && list.key !== dataKey;
  const view: ListState = stale ? { status: "loading" } : list;

  const fetchList = async () => {
    setList({ status: "loading" });
    const result = await settleAction(() => loadInvoiceEntries(invoice.card.id, invoice.referenceMonth));
    setList(result.ok ? { status: "ready", items: result.data, key: dataKey } : { status: "error" });
  };

  // Fatura mudou (pagamento, nova compra) com a lista aberta: descarta o cache e rebusca (chave do ADR 9.2).
  useEffect(() => {
    if (!stale || !expanded) return;
    let alive = true;
    void settleAction(() => loadInvoiceEntries(invoice.card.id, invoice.referenceMonth)).then((result) => {
      if (alive) setList(result.ok ? { status: "ready", items: result.data, key: dataKey } : { status: "error" });
    });
    return () => {
      alive = false;
    };
  }, [stale, expanded, dataKey, invoice.card.id, invoice.referenceMonth]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && (list.status === "idle" || list.status === "error" || stale)) void fetchList();
  };

  const confirmPay = async () => {
    setBusy(true);
    setError(null);
    const result = await settleAction(() => payInvoice(invoice.card.id, invoice.referenceMonth));
    setBusy(false);
    if (result.ok) {
      setConfirmOpen(false);
      toast.push({ kind: result.data.paidCount === 0 ? "info" : "success", message: invoicePaidFeedback(invoice, result.data) });
      headingRef.current?.focus();
      return;
    }
    if (result.error.status === 404) {
      setConfirmOpen(false);
      toast.push({ kind: "error", message: "Este cartão não foi encontrado. Nada foi alterado." });
      return;
    }
    setError("Não foi possível pagar a fatura. Nenhuma despesa foi alterada. Tente novamente.");
  };

  const expensesHref = entriesHref(changeFilter(changeTab({ ...state, month: invoice.referenceMonth }, "expenses"), { d_card: invoice.card.id }));
  const payLabel = fullyPaid ? (
    <p id={paidNoteId} className="flex items-center gap-1.5 text-sm font-medium text-success-text">
      <Icon name="check" />
      Fatura paga
    </p>
  ) : null;

  return (
    <div role="group" aria-labelledby={headingId} className="glass flex flex-col gap-4 rounded-xl border-border-strong p-4 md:p-5">
      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="flex flex-col gap-1">
          <h3 id={headingId} ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold text-text">
            {invoice.card.name}
          </h3>
          <p className="text-sm text-muted">
            Fecha {formatCivilDate(invoice.closingDate)} · Vence {formatCivilDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          {payLabel}
          <Button
            ref={payButtonRef}
            variant="primary"
            disabled={fullyPaid}
            aria-label={`Pagar fatura ${invoice.card.name} de ${monthLong}`}
            aria-describedby={fullyPaid ? paidNoteId : undefined}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            Pagar fatura
          </Button>
        </div>
      </div>

      <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:border-t-0 md:pt-0">
        <div className="flex items-baseline justify-between gap-3 md:justify-start">
          <dt className="text-muted">Total</dt>
          <dd className="font-semibold text-text">
            <Money value={invoice.totals.total} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 md:justify-start">
          <dt>
            <StatusDot status="PAID">Pago</StatusDot>
          </dt>
          <dd className="font-semibold text-text">
            <Money value={invoice.totals.paid} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 md:justify-start">
          <dt>
            <StatusDot status="PENDING">Pendente</StatusDot>
          </dt>
          <dd className="font-semibold text-text">
            <Money value={invoice.totals.pending} />
          </dd>
        </div>
      </dl>

      <div>
        <Button
          variant="tertiary"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={expanded ? `Ocultar despesas da fatura ${invoice.card.name}` : `Ver ${countLabel(invoice.entryCount, "despesa", "despesas")} da fatura ${invoice.card.name}`}
          onClick={toggle}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={expanded ? "rotate-180" : ""}>
            <path d="m6 9 6 6 6-6" />
          </svg>
          {expanded ? "Ocultar despesas" : `Ver ${countLabel(invoice.entryCount, "despesa", "despesas")}`}
        </Button>
        <div id={listId} hidden={!expanded} className="mt-2">
          {expanded ? <InvoiceEntries list={view} cardName={invoice.card.name} onRetry={() => void fetchList()} expensesHref={expensesHref} /> : null}
        </div>
      </div>

      {confirmOpen ? (
        <AlertDialog
          title={`Pagar a fatura ${invoice.card.name} de ${monthLong}?`}
          confirmLabel="Pagar fatura"
          busyLabel="Pagando…"
          busy={busy}
          error={error}
          onConfirm={() => void confirmPay()}
          onCancel={() => {
            setConfirmOpen(false);
            payButtonRef.current?.focus();
          }}
        >
          <p className="text-sm text-muted">Vence em {formatCivilDate(invoice.dueDate)}</p>
          <p>{countLabel(invoice.pendingCount, "lançamento pendente", "lançamentos pendentes")}</p>
          <p className="font-display text-xl font-semibold">
            Total: <Money value={invoice.totals.pending} />
          </p>
          <p className="text-sm text-muted">Serão pagas as despesas pendentes desta fatura no momento da confirmação.</p>
        </AlertDialog>
      ) : null}
    </div>
  );
}

function InvoiceEntries({ list, cardName, onRetry, expensesHref }: { list: ListState; cardName: string; onRetry: () => void; expensesHref: string }) {
  if (list.status === "loading" || list.status === "idle") {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <p role="status" className="flex items-center gap-2 text-sm text-accent">
          <span className="spinner" aria-hidden="true" /> Carregando despesas…
        </p>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (list.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger p-3 text-sm text-text">
        <p className="flex-1">Não foi possível carregar as despesas desta fatura.</p>
        <Button onClick={onRetry}>Tentar novamente</Button>
      </div>
    );
  }
  const grid = "md:grid md:grid-cols-[minmax(0,1fr)_9rem_7rem_8rem_8rem] md:items-center md:gap-3";
  return (
    <div className="flex flex-col gap-3">
      {/* Um unico markup (lista): colunas a partir de md, duas linhas por item no mobile */}
      <ul aria-label={`Despesas da fatura ${cardName}`} className="flex flex-col">
        <li aria-hidden="true" className={`hidden border-b border-border-strong px-2 py-2 text-sm font-medium text-muted ${grid}`}>
          <span>Descrição</span>
          <span>Categoria</span>
          <span>Data</span>
          <span className="text-right">Valor</span>
          <span>Status</span>
        </li>
        {list.items.map((e) => (
          <li key={e.id} className={`flex flex-col gap-0.5 border-b border-border px-2 py-2 text-sm ${grid}`}>
            <div className="flex items-start justify-between gap-3 md:contents">
              <span className="text-text">{e.description}</span>
              <span className="hidden text-muted md:inline">{e.category}</span>
              <span className="hidden text-text md:inline">{formatCivilDate(e.date)}</span>
              <Money value={e.amount} className="text-text md:text-right" />
            </div>
            <div className="flex items-center justify-between gap-3 text-muted md:contents">
              <span className="md:hidden">
                {e.category} · {formatCivilDate(e.date)}
              </span>
              <StatusBadge status={e.status} />
            </div>
          </li>
        ))}
      </ul>
      <NavLink href={expensesHref} className="btn btn-tertiary self-start">
        Pagar despesas individualmente na aba Despesas
      </NavLink>
    </div>
  );
}
