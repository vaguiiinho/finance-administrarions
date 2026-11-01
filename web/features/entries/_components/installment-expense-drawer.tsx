"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/combobox";
import { Drawer } from "@/components/ui/drawer";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField, TextField } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/states";
import { SessionExpiredAlert, useAuthRedirect } from "@/components/session-expired";
import { useToast } from "@/components/ui/toast";
import { maskMoneyInput, parseMoneyInput, toCents } from "@/lib/money/decimal";
import { formatBRL } from "@/lib/money/decimal";
import { previewInstallments } from "@/lib/entries/installments";
import { CATEGORY_MAX, DESCRIPTION_MAX } from "@/lib/entries/form";
import type { ActionError, CardDto, CreateInstallmentExpensesPayload, PaymentMethod } from "@/lib/api/types";
import { createInstallmentExpenses } from "@/app/(protected)/entries/actions";
import { settleAction } from "@/lib/api/safe-action";
import { useEntryDrawer } from "./entry-drawer-context";

interface InstallmentExpenseDrawerProps {
  today: string;
  cards: CardDto[];
  cardsError: boolean;
  categories: string[];
}

type Fields = "description" | "category" | "date" | "amount" | "installments" | "cardId";
type Errors = Partial<Record<Fields, string>>;

const formatDate = (date: string) => {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) ?? [];
  return year ? `${day}/${month}/${year}` : date;
};

export function InstallmentExpenseDrawer({ today, cards, cardsError, categories }: InstallmentExpenseDrawerProps) {
  const { installmentsOpen, closeInstallmentsDrawer } = useEntryDrawer();
  if (!installmentsOpen) return null;
  return (
    <InstallmentExpenseDrawerContent
      today={today}
      cards={cards}
      cardsError={cardsError}
      categories={categories}
      onClose={closeInstallmentsDrawer}
    />
  );
}

function InstallmentExpenseDrawerContent({
  today,
  cards,
  cardsError,
  categories,
  onClose,
}: InstallmentExpenseDrawerProps & { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const formId = `${uid}-form`;
  const bannerRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("6");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [cardId, setCardId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [authError, setAuthError] = useState<ActionError | null>(null);
  const [busy, setBusy] = useState(false);
  useAuthRedirect(authError);

  const count = /^\d+$/.test(installments) ? Number(installments) : Number.NaN;
  const total = parseMoneyInput(amount);
  const preview = useMemo(
    () => (total && Number.isInteger(count) ? previewInstallments(total, count, date) : null),
    [total, count, date],
  );

  const validate = (): Errors => {
    const found: Errors = {};
    if (!description.trim()) found.description = "Informe a descrição.";
    else if (description.trim().length > DESCRIPTION_MAX) found.description = "A descrição deve ter no máximo 120 caracteres.";
    if (!category.trim()) found.category = "Informe a categoria.";
    else if (category.trim().length > CATEGORY_MAX) found.category = "A categoria deve ter no máximo 50 caracteres.";
    if (!date || !previewInstallments("1.00", 2, date)) found.date = "Informe uma data válida entre 1900 e 9998.";
    if (!total || toCents(total) <= 0n) found.amount = "Informe um total maior que zero.";
    else if (toCents(total) > 999_999_999_999n) found.amount = "O valor máximo é R$ 9.999.999.999,99.";
    if (!Number.isInteger(count) || count < 2 || count > 36) found.installments = "Informe entre 2 e 36 parcelas.";
    else if (total && toCents(total) < BigInt(count)) found.installments = "O total deve permitir ao menos R$ 0,01 por parcela.";
    if (paymentMethod === "CARD" && !cardId) found.cardId = "Escolha o cartão.";
    return found;
  };

  const updateField = (field: Fields, update: () => void) => {
    update();
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setBanner(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBanner(null);
    setAuthError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["description", "category", "date", "amount", "installments", "cardId"] as const).find((field) => found[field]);
      if (first) document.querySelector<HTMLElement>(`#${formId} [name="${first}"]`)?.focus();
      return;
    }

    const decimalAmount = parseMoneyInput(amount);
    if (!decimalAmount || !Number.isInteger(count)) return;
    const payload: CreateInstallmentExpensesPayload = {
      description: description.trim(),
      category: category.trim(),
      date,
      amount: decimalAmount,
      installments: count,
      paymentMethod,
      ...(paymentMethod === "CARD" ? { cardId } : {}),
    };
    setBusy(true);
    const result = await settleAction(() => createInstallmentExpenses(payload));
    setBusy(false);
    if (result.ok) {
      onClose();
      toast.push({ kind: "success", message: `${result.data.length} parcelas criadas.` });
      router.refresh();
      return;
    }
    if (result.error.code === "SESSION_EXPIRED" || result.error.code === "PASSWORD_CHANGE_REQUIRED") {
      setAuthError(result.error);
      return;
    }
    if (result.error.status === 404 && result.error.code === "CARD_NOT_FOUND") {
      setErrors((current) => ({ ...current, cardId: "Este cartão não existe mais. Atualize a lista e escolha outro." }));
      router.refresh();
      return;
    }
    if (result.error.status === 400) {
      const mapped: Errors = {};
      const unmapped: string[] = [];
      for (const issue of result.error.fields ?? []) {
        if (issue.field === "description" || issue.field === "category" || issue.field === "date" || issue.field === "amount" || issue.field === "installments" || issue.field === "cardId") {
          mapped[issue.field] ??= issue.message;
        } else {
          unmapped.push(issue.message);
        }
      }
      setErrors(mapped);
      if (unmapped.length > 0 || Object.keys(mapped).length === 0) setBanner(unmapped[0] ?? result.error.message);
    } else {
      setBanner(result.error.message || "Não foi possível criar as parcelas. Seus dados foram mantidos.");
    }
    queueMicrotask(() => bannerRef.current?.focus());
  };

  return (
    <Drawer
      title="Nova despesa parcelada"
      titleId={`${uid}-title`}
      onClose={onClose}
      busy={busy}
      initialFocus={`#${formId} [name="description"]`}
      footer={
        <div className="flex justify-between gap-3">
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {busy ? "Criando…" : `Criar parcelas${Number.isInteger(count) && count >= 2 && count <= 36 ? ` (${count})` : ""}`}
          </Button>
        </div>
      }
    >
      {authError?.code === "SESSION_EXPIRED" || authError?.code === "PASSWORD_CHANGE_REQUIRED" ? (
        <SessionExpiredAlert redirectUrl={authError.redirectUrl} />
      ) : null}
      {banner ? (
        <div ref={bannerRef} tabIndex={-1} className="mb-4 outline-none">
          <InlineAlert>{banner}</InlineAlert>
        </div>
      ) : null}
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <TextField
          label="Descrição"
          required
          name="description"
          maxLength={DESCRIPTION_MAX}
          value={description}
          error={errors.description}
          readOnly={busy}
          onChange={(event) => updateField("description", () => setDescription(event.target.value))}
        />
        <CategoryCombobox
          label="Categoria"
          required
          name="category"
          value={category}
          options={categories}
          error={errors.category}
          readOnly={busy}
          onValueChange={(value) => updateField("category", () => setCategory(value))}
        />
        <TextField
          label="Data da primeira parcela"
          required
          name="date"
          type="date"
          value={date}
          error={errors.date}
          readOnly={busy}
          help="As próximas parcelas usam o mesmo dia nos meses seguintes."
          onChange={(event) => updateField("date", () => setDate(event.target.value))}
        />
        <TextField
          label="Valor total da compra"
          required
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          error={errors.amount}
          readOnly={busy}
          onChange={(event) => updateField("amount", () => setAmount(maskMoneyInput(event.target.value)))}
        />
        <TextField
          label="Quantidade de parcelas"
          required
          name="installments"
          type="number"
          min={2}
          max={36}
          step={1}
          value={installments}
          error={errors.installments}
          readOnly={busy}
          onChange={(event) => updateField("installments", () => setInstallments(event.target.value))}
        />
        <div className="flex flex-col gap-1.5">
          <span id={`${uid}-method`} className="text-sm font-medium text-text">Forma de pagamento *</span>
          <SegmentedControl
            aria-labelledby={`${uid}-method`}
            options={[{ value: "PIX", label: "PIX" }, { value: "CARD", label: "Cartão" }]}
            value={paymentMethod}
            onChange={(value) => {
              setPaymentMethod(value);
              setErrors((current) => ({ ...current, cardId: undefined }));
            }}
            disabled={busy}
          />
        </div>
        {paymentMethod === "CARD" ? (
          cardsError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text">Cartão</p>
              <InlineAlert>Não foi possível carregar os cartões. Atualize a página e tente novamente.</InlineAlert>
              {errors.cardId ? <p role="alert" className="text-sm text-danger">{errors.cardId}</p> : null}
              <Button variant="tertiary" onClick={() => router.refresh()}>Tentar novamente</Button>
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <InlineAlert>Nenhum cartão cadastrado. Cadastre um cartão antes de criar parcelas no cartão.</InlineAlert>
              {errors.cardId ? <p role="alert" className="text-sm text-danger">{errors.cardId}</p> : null}
              <Button variant="tertiary" onClick={() => router.push("/cards")}>+ Novo cartão</Button>
            </div>
          ) : (
            <SelectField
              label="Cartão"
              required
              name="cardId"
              value={cardId}
              error={errors.cardId}
              disabled={busy}
              onChange={(event) => updateField("cardId", () => setCardId(event.target.value))}
            >
              <option value="">Selecione um cartão</option>
              {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
            </SelectField>
          )
        ) : null}
        <p className="text-sm text-muted">Todas as parcelas serão criadas como pendentes. Você poderá pagá-las individualmente ou em lote.</p>
        {preview ? (
          <section aria-label="Prévia das parcelas" className="flex flex-col gap-2 rounded-lg border border-border bg-card-2 p-3">
            <h2 className="text-sm font-semibold text-text">
              {preview.length} parcelas · total {formatBRL(total!)}
            </h2>
            <ol className="flex flex-col gap-1 text-sm text-muted">
              {preview.slice(0, 6).map((part, index) => (
                <li key={`${part.date}-${index}`} className="flex justify-between gap-3">
                  <span>{index + 1}ª parcela · {formatDate(part.date)}</span>
                  <span className="font-medium text-text">{formatBRL(part.amount)}</span>
                </li>
              ))}
              {preview.length > 6 ? <li>e mais {preview.length - 6} parcelas</li> : null}
            </ol>
          </section>
        ) : null}
      </form>
    </Drawer>
  );
}
