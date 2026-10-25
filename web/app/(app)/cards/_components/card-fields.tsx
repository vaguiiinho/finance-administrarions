"use client";

import type { Dispatch, Ref, SetStateAction } from "react";
import { TextField } from "@/components/ui/fields";
import type { CardFormErrors, CardFormValues } from "@/lib/entries/form";

interface CardFieldsProps {
  values: CardFormValues;
  errors: CardFormErrors;
  onChange: Dispatch<SetStateAction<CardFormValues>>;
  readOnly?: boolean;
  nameRef?: Ref<HTMLInputElement>;
  /** Painel embutido: dias lado a lado; ajuda do vencimento omitida no painel curto. */
  compact?: boolean;
}

/** Campos nome/fechamento/vencimento compartilhados por `CardDrawer` e `InlineNewCardPanel` (RF01). */
export function CardFields({ values, errors, onChange, readOnly = false, nameRef, compact = false }: CardFieldsProps) {
  const set = (key: keyof CardFormValues) => (event: { target: { value: string } }) => onChange((prev) => ({ ...prev, [key]: event.target.value }));
  const digits = (key: "closingDay" | "dueDay") => (event: { target: { value: string } }) => onChange((prev) => ({ ...prev, [key]: event.target.value.replace(/\D/g, "").slice(0, 2) }));
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Nome do cartão" required name="name" value={values.name} onChange={set("name")} error={errors.name} readOnly={readOnly} inputRef={nameRef} autoComplete="off" />
      <div className={compact ? "grid grid-cols-1 gap-3 min-[360px]:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
        <TextField
          label="Dia de fechamento"
          required
          name="closingDay"
          inputMode="numeric"
          value={values.closingDay}
          onChange={digits("closingDay")}
          error={errors.closingDay}
          readOnly={readOnly}
          autoComplete="off"
        />
        <TextField
          label="Dia de vencimento"
          required
          name="dueDay"
          inputMode="numeric"
          value={values.dueDay}
          onChange={digits("dueDay")}
          error={errors.dueDay}
          help={compact ? undefined : "Define o mês em que a fatura aparece."}
          readOnly={readOnly}
          autoComplete="off"
        />
      </div>
      <p className="text-sm text-muted">Em meses mais curtos, vale o último dia do mês.</p>
    </div>
  );
}
