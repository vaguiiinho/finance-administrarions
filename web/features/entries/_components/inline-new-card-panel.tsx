"use client";

import { settleAction } from "@/lib/api/safe-action";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createCard } from "@/app/(protected)/cards/actions";
import { CardFields } from "../../cards/_components/card-fields";
import { Button } from "@/components/ui/button";
import { buildCardPayload, mapCardFieldIssues, validateCardForm, type CardFormErrors, type CardFormValues } from "@/lib/entries/form";
import type { CardDto } from "@/lib/api/types";

interface InlineNewCardPanelProps {
  panelId: string;
  onCreated: (card: CardDto) => void;
  /** Fecha o painel e devolve o foco ao campo Cartao */
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}

/**
 * Painel embutido "+ Novo cartao" (D22, 3.9.3). NAO e um <form> aninhado: Enter nos campos envia so o painel e
 * Esc fecha so o painel. Validacao identica a /cards (RF01); 409 inline no nome; dados do lancamento intactos.
 */
export function InlineNewCardPanel({ panelId, onCreated, onCancel, onBusyChange }: InlineNewCardPanelProps) {
  const titleId = useId();
  const [values, setValues] = useState<CardFormValues>({ name: "", closingDay: "", dueDay: "" });
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = async () => {
    if (busy) return;
    const local = validateCardForm(values);
    setErrors(local);
    setBanner(null);
    if (Object.keys(local).length > 0) {
      const first = local.name ? "name" : local.closingDay ? "closingDay" : "dueDay";
      document.getElementById(panelId)?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    onBusyChange(true);
    const result = await settleAction(() => createCard(buildCardPayload(values)));
    setBusy(false);
    onBusyChange(false);
    if (result.ok) {
      onCreated(result.data);
      return;
    }
    const { fields, unmapped } = mapCardFieldIssues(result.error.fields);
    if (result.error.status === 409 && !fields.name) fields.name = "Já existe um cartão com esse nome.";
    setErrors(fields);
    if (Object.keys(fields).length === 0 || unmapped.length > 0) setBanner("Não foi possível criar o cartão. Tente novamente.");
    if (fields.name) nameRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onCancel();
    } else if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div
      id={panelId}
      role="group"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-2 p-4"
    >
      <h3 id={titleId} className="font-display text-base font-semibold text-text">
        Novo cartão
      </h3>
      <CardFields values={values} errors={errors} onChange={setValues} readOnly={busy} nameRef={nameRef} compact />
      {banner ? (
        <p role="alert" className="text-sm text-danger-text">
          {banner}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="primary" loading={busy} onClick={() => void submit()}>
          {busy ? "Criando…" : "Criar cartão"}
        </Button>
      </div>
    </div>
  );
}
