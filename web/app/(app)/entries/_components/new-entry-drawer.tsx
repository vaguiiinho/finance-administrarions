"use client";

import { settleAction } from "@/lib/api/safe-action";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer } from "@/components/ui/drawer";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField, TextField } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/status";
import { maskMoneyInput } from "@/lib/money/decimal";
import {
  DESCRIPTION_MAX,
  buildCreateEntryPayload,
  initialEntryForm,
  initialStatusText,
  isCardExpense,
  isPixExpense,
  effectivePaymentMethod,
  mapApiFieldIssues,
  validateEntryForm,
  type EntryFormErrors,
  type EntryFormField,
  type EntryFormValues,
} from "@/lib/entries/form";
import { createdFeedback } from "@/lib/entries/feedback";
import type { EntriesState } from "@/lib/filters/entries-search-params";
import type { CardDto } from "@/lib/api/types";
import { createEntry } from "../actions";
import { InlineNewCardPanel } from "./inline-new-card-panel";
import { useEntryDrawer } from "./entry-drawer-context";

interface NewEntryDrawerProps {
  /** Hoje em America/Sao_Paulo (YYYY-MM-DD): data padrao e referencia do aviso de PIX futuro */
  today: string;
  state: EntriesState;
  cards: CardDto[];
  cardsError: boolean;
  categories: string[];
}

const FIELD_ORDER: EntryFormField[] = ["type", "description", "category", "date", "amount", "paymentMethod", "cardId"];

const TYPE_OPTIONS = [
  { value: "EXPENSE", label: "Despesa" },
  { value: "INCOME", label: "Receita" },
] as const;

/**
 * Drawer "Novo lancamento" (RF23, design 3.9). Montado so quando aberto (reabre limpo). O formulario nunca calcula
 * fatura, vencimento ou mes de referencia (P24): so envia os campos de E1 (ver `buildCreateEntryPayload`).
 */
export function NewEntryDrawer(props: NewEntryDrawerProps) {
  const { open } = useEntryDrawer();
  if (!open) return null;
  return <NewEntryDrawerContent {...props} />;
}

function NewEntryDrawerContent({ today, state, cards: serverCards, cardsError, categories }: NewEntryDrawerProps) {
  const router = useRouter();
  const toast = useToast();
  const { closeDrawer } = useEntryDrawer();
  const uid = useId();
  const titleId = `${uid}-title`;
  const formId = `${uid}-form`;
  const panelId = `${uid}-card-panel`;
  const statusId = `${uid}-status`;
  const datalistId = `${uid}-categories`;

  const [form, setForm] = useState<EntryFormValues>(() => initialEntryForm(today));
  const [touched, setTouched] = useState<Set<EntryFormField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<EntryFormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addedCards, setAddedCards] = useState<CardDto[]>([]);
  const [cardPanelOpen, setCardPanelOpen] = useState(false);
  const [cardPanelBusy, setCardPanelBusy] = useState(false);
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  const cardSelectRef = useRef<HTMLSelectElement>(null);
  const newCardButtonRef = useRef<HTMLButtonElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Cartoes do servidor + criados pelo atalho (preservados mesmo se a pagina for revalidada)
  const cards = useMemo(() => {
    const ids = new Set(serverCards.map((c) => c.id));
    return [...serverCards, ...addedCards.filter((c) => !ids.has(c.id))].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [serverCards, addedCards]);

  const localErrors = validateEntryForm(form);
  const errors: EntryFormErrors = {};
  for (const field of FIELD_ORDER) {
    const message = serverErrors[field] ?? (submitted || touched.has(field) ? localErrors[field] : undefined);
    if (message) errors[field] = message;
  }
  const errorCount = Object.keys(errors).length;

  const update = (patch: Partial<EntryFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setBanner(null);
    const fields = Object.keys(patch) as EntryFormField[];
    if (fields.some((f) => serverErrors[f])) setServerErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !fields.includes(k as EntryFormField))));
  };
  const touch = (field: EntryFormField) => setTouched((prev) => new Set(prev).add(field));

  const method = effectivePaymentMethod(form);
  const showNotPaid = isPixExpense(form);
  const futurePix = isPixExpense(form) && !form.notPaid && form.date > today;

  const closePanel = () => {
    setCardPanelOpen(false);
    // o select volta a ficar habilitado so depois da proxima renderizacao
    setTimeout(() => (cardSelectRef.current ?? newCardButtonRef.current)?.focus(), 0);
  };

  const focusFirstInvalid = (list: EntryFormErrors) => {
    const first = FIELD_ORDER.find((f) => list[f]);
    if (!first) return;
    const root = document.getElementById(formId);
    const target = first === "type" || first === "paymentMethod" ? root?.querySelector<HTMLElement>(`[data-field="${first}"] [role="radio"][aria-checked="true"]`) : root?.querySelector<HTMLElement>(`[name="${first}"]`);
    target?.focus();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || cardPanelOpen) return;
    setSubmitted(true);
    setBanner(null);
    const found = validateEntryForm(form);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(found);
      return;
    }
    setBusy(true);
    const result = await settleAction(() => createEntry(buildCreateEntryPayload(form)));
    setBusy(false);
    if (result.ok) {
      const feedback = createdFeedback(result.data, state);
      closeDrawer();
      toast.push({ kind: "success", message: feedback.message, action: feedback.action });
      return;
    }
    const { error } = result;
    if (error.status === 404 && error.code === "CARD_NOT_FOUND") {
      setServerErrors({ cardId: "Este cartão não existe mais. Escolha outro." });
      update({ cardId: "" });
      router.refresh();
      return;
    }
    if (error.status === 400) {
      const { fields, unmapped } = mapApiFieldIssues(error.fields);
      setServerErrors(fields);
      if (Object.keys(fields).length > 0 && unmapped.length === 0) {
        focusFirstInvalid(fields);
        return;
      }
      setBanner(unmapped[0] ?? error.message);
    } else {
      setBanner("Não foi possível salvar o lançamento. Seus dados foram mantidos. Tente novamente.");
    }
    queueMicrotask(() => bannerRef.current?.focus());
  };

  return (
    <Drawer
      title="Novo lançamento"
      titleId={titleId}
      onClose={closeDrawer}
      onEscape={() => {
        if (!cardPanelOpen) return false;
        if (!cardPanelBusy) closePanel();
        return true;
      }}
      busy={busy}
      initialFocus='[data-field="type"] [role="radio"][aria-checked="true"]'
      footer={
        <div className="flex flex-col gap-2">
          {cardPanelOpen ? <p className="text-xs text-muted">Conclua ou cancele o novo cartão</p> : null}
          <div className="flex justify-between gap-3">
            <Button onClick={closeDrawer} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} variant="primary" loading={busy} disabled={cardPanelOpen}>
              {busy ? "Salvando…" : "Salvar lançamento"}
            </Button>
          </div>
        </div>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {banner ? (
          <div ref={bannerRef} tabIndex={-1}>
            <InlineAlert>{banner}</InlineAlert>
          </div>
        ) : null}
        {errorCount >= 2 && submitted ? (
          <InlineAlert>
            <p className="font-medium">Corrija os {errorCount} campos destacados.</p>
          </InlineAlert>
        ) : null}

        <div className="flex flex-col gap-1.5" data-field="type">
          <span id={`${uid}-type`} className="text-sm font-medium text-text">
            Tipo <span aria-hidden="true">*</span>
          </span>
          <SegmentedControl aria-labelledby={`${uid}-type`} options={TYPE_OPTIONS} value={form.type} onChange={(type) => update({ type })} disabled={busy} />
        </div>

        <TextField
          label="Descrição"
          required
          name="description"
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          onBlur={() => touch("description")}
          error={errors.description}
          readOnly={busy}
          autoComplete="off"
          counter={
            <span className={`shrink-0 text-xs ${form.description.trim().length > DESCRIPTION_MAX ? "text-danger-text" : "text-muted"}`}>
              {form.description.trim().length}/{DESCRIPTION_MAX}
            </span>
          }
        />

        <TextField
          label="Categoria"
          required
          name="category"
          list={datalistId}
          value={form.category}
          onChange={(e) => update({ category: e.target.value })}
          onBlur={() => touch("category")}
          error={errors.category}
          readOnly={busy}
          autoComplete="off"
        />
        <datalist id={datalistId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <TextField
          label="Data"
          required
          name="date"
          type="date"
          value={form.date}
          onChange={(e) => update({ date: e.target.value })}
          onBlur={() => touch("date")}
          error={errors.date}
          help="Data da compra (despesa) ou do recebimento (receita)."
          readOnly={busy}
        />

        <TextField
          label="Valor"
          required
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          value={form.amount}
          onChange={(e) => update({ amount: maskMoneyInput(e.target.value) })}
          onBlur={() => touch("amount")}
          error={errors.amount}
          readOnly={busy}
          autoComplete="off"
        />

        <div className="flex flex-col gap-1.5" data-field="paymentMethod">
          <span id={`${uid}-method`} className="text-sm font-medium text-text">
            Forma de pagamento <span aria-hidden="true">*</span>
          </span>
          <SegmentedControl
            aria-labelledby={`${uid}-method`}
            aria-describedby={statusId}
            options={[
              { value: "PIX", label: "PIX" },
              { value: "CARD", label: "Cartão", disabled: form.type === "INCOME" },
            ]}
            value={method}
            onChange={(paymentMethod) => update({ paymentMethod })}
            disabled={busy}
          />
          {form.type === "INCOME" ? <p className="text-sm text-muted">Receitas são sempre via PIX.</p> : null}
          {errors.paymentMethod ? (
            <p role="alert" className="text-sm text-danger-text">
              {errors.paymentMethod}
            </p>
          ) : null}
        </div>

        {showNotPaid ? (
          <label className="-my-2 flex items-center gap-1 text-text">
            <Checkbox
              name="notPaid"
              checked={form.notPaid}
              disabled={busy}
              aria-describedby={statusId}
              onChange={(e) => update({ notPaid: e.target.checked })}
            />
            Ainda não paguei
          </label>
        ) : null}

        {isCardExpense(form) ? (
          <div className="flex flex-col gap-2">
            {cardsError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm font-medium text-text">Cartão</p>
                <p className="text-sm text-muted">Não foi possível carregar os cartões.</p>
                <Button variant="tertiary" onClick={() => router.refresh()}>
                  Tentar novamente
                </Button>
                <Button ref={newCardButtonRef} aria-expanded={cardPanelOpen} aria-controls={panelId} onClick={() => setCardPanelOpen(true)}>
                  + Novo cartão
                </Button>
              </div>
            ) : cards.length === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm font-medium text-text">Cartão *</p>
                <p className="text-sm text-muted">Nenhum cartão cadastrado.</p>
                <Button ref={newCardButtonRef} aria-expanded={cardPanelOpen} aria-controls={panelId} onClick={() => setCardPanelOpen(true)}>
                  + Novo cartão
                </Button>
              </div>
            ) : (
              <SelectField
                label="Cartão"
                required
                name="cardId"
                selectRef={cardSelectRef}
                value={form.cardId}
                onChange={(e) => {
                  update({ cardId: e.target.value });
                  setCardNotice(null);
                }}
                onBlur={() => touch("cardId")}
                error={errors.cardId}
                disabled={cardPanelOpen || busy}
                aside={
                  <Button variant="tertiary" ref={newCardButtonRef} aria-expanded={cardPanelOpen} aria-controls={panelId} onClick={() => setCardPanelOpen(true)} disabled={cardPanelOpen || busy}>
                    + Novo cartão
                  </Button>
                }
              >
                <option value="">Selecione um cartão</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} · fecha {card.closingDay} · vence {card.dueDay}
                  </option>
                ))}
              </SelectField>
            )}
            {errors.cardId && (cardsError || cards.length === 0) ? (
              <p role="alert" className="text-sm text-danger-text">
                {errors.cardId}
              </p>
            ) : null}
            {cardNotice ? (
              <p role="status" className="flex items-center gap-1.5 text-sm text-success-text">
                <Icon name="check" />
                {cardNotice}
              </p>
            ) : null}
            {cardPanelOpen ? (
              <InlineNewCardPanel
                panelId={panelId}
                onBusyChange={setCardPanelBusy}
                onCancel={closePanel}
                onCreated={(card) => {
                  setAddedCards((prev) => [...prev, card]);
                  update({ cardId: card.id });
                  setCardPanelOpen(false);
                  setCardNotice(`Cartão "${card.name}" criado e selecionado.`);
                  // o select so existe depois da proxima renderizacao
                  setTimeout(() => cardSelectRef.current?.focus(), 0);
                }}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <p id={statusId} className="text-sm text-muted">
            {initialStatusText(form)}
          </p>
          {futurePix ? <p className="text-sm text-muted">Data futura: ela será registrada como paga hoje. Marque &quot;Ainda não paguei&quot; se o PIX ainda não saiu.</p> : null}
        </div>
      </form>
    </Drawer>
  );
}
