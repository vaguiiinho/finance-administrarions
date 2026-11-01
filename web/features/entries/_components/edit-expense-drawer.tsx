"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/combobox";
import { Drawer } from "@/components/ui/drawer";
import { TextField } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/states";
import { SessionExpiredAlert, useAuthRedirect } from "@/components/session-expired";
import { useToast } from "@/components/ui/toast";
import { maskMoneyInput, parseMoneyInput } from "@/lib/money/decimal";
import { mapApiFieldIssues, validateEntryForm, type EntryFormErrors, type EntryFormValues } from "@/lib/entries/form";
import type { ActionError, EntryDto } from "@/lib/api/types";
import { updateExpenseEntry } from "@/app/(protected)/entries/actions";
import { settleAction } from "@/lib/api/safe-action";

interface EditExpenseDrawerProps {
  entry: EntryDto;
  categories: string[];
  onClose: () => void;
}

export function EditExpenseDrawer({ entry, categories, onClose }: EditExpenseDrawerProps) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const formId = `${uid}-form`;
  const bannerRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState(entry.description);
  const [category, setCategory] = useState(entry.category);
  const [date, setDate] = useState(entry.date);
  const [amount, setAmount] = useState(maskMoneyInput(entry.amount.replace(/\D/g, "")));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<EntryFormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [authError, setAuthError] = useState<ActionError | null>(null);
  const [busy, setBusy] = useState(false);
  useAuthRedirect(authError);

  const values: EntryFormValues = {
    type: "EXPENSE",
    description,
    category,
    date,
    amount,
    paymentMethod: entry.paymentMethod,
    cardId: entry.card?.id ?? "",
    notPaid: false,
  };
  const localErrors = validateEntryForm(values);
  const errors = Object.fromEntries(
    (["description", "category", "date", "amount"] as const)
      .map((field) => [field, serverErrors[field] ?? (submitted ? localErrors[field] : undefined)])
      .filter(([, error]) => error),
  ) as EntryFormErrors;
  const dateLocked = entry.paymentMethod === "CARD" && entry.status === "PAID";

  const clearError = (field: keyof EntryFormErrors) => {
    setServerErrors((current) => {
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
    setSubmitted(true);
    setBanner(null);
    setAuthError(null);
    const invalid = validateEntryForm(values);
    if (Object.keys(invalid).length > 0) {
      const first = (["description", "category", "date", "amount"] as const).find((field) => invalid[field]);
      if (first) document.querySelector<HTMLElement>(`#${formId} [name="${first}"]`)?.focus();
      return;
    }

    const decimalAmount = parseMoneyInput(amount);
    if (!decimalAmount) return;
    setBusy(true);
    const result = await settleAction(() =>
      updateExpenseEntry(entry.id, { description: description.trim(), category: category.trim(), date, amount: decimalAmount }),
    );
    setBusy(false);

    if (result.ok) {
      onClose();
      toast.push({ kind: "success", message: "Despesa atualizada." });
      router.refresh();
      return;
    }

    const { error } = result;
    if (error.code === "SESSION_EXPIRED" || error.code === "PASSWORD_CHANGE_REQUIRED") {
      setAuthError(error);
      return;
    }
    if (error.status === 400) {
      const mapped = mapApiFieldIssues(error.fields);
      setServerErrors(mapped.fields);
      setBanner(mapped.unmapped[0] ?? (Object.keys(mapped.fields).length === 0 ? error.message : null));
    } else {
      setBanner(error.message || "Não foi possível atualizar a despesa. Tente novamente.");
    }
    queueMicrotask(() => bannerRef.current?.focus());
  };

  return (
    <Drawer
      title="Editar despesa"
      titleId={`${uid}-title`}
      onClose={onClose}
      busy={busy}
      initialFocus={`#${formId} [name="description"]`}
      footer={
        <div className="flex justify-between gap-3">
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              const form = document.getElementById(formId);
              if (form instanceof HTMLFormElement) form.requestSubmit();
            }}
          >
            Salvar alterações
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
      <form id={formId} onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <TextField
          label="Descrição"
          required
          name="description"
          value={description}
          error={errors.description}
          readOnly={busy}
          maxLength={120}
          onChange={(event) => {
            setDescription(event.target.value);
            clearError("description");
          }}
        />
        <CategoryCombobox
          label="Categoria"
          required
          name="category"
          value={category}
          options={categories}
          error={errors.category}
          readOnly={busy}
          onValueChange={(value) => {
            setCategory(value);
            clearError("category");
          }}
        />
        <TextField
          label="Data"
          required
          name="date"
          type="date"
          value={date}
          error={errors.date}
          disabled={dateLocked || busy}
          help={dateLocked ? "A data de uma despesa paga no cartão não pode ser alterada." : "A data de compra pode alterar a fatura do cartão."}
          onChange={(event) => {
            setDate(event.target.value);
            clearError("date");
          }}
        />
        <TextField
          label="Valor"
          required
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          error={errors.amount}
          readOnly={busy}
          autoComplete="off"
          onChange={(event) => {
            setAmount(maskMoneyInput(event.target.value));
            clearError("amount");
          }}
        />
      </form>
    </Drawer>
  );
}
