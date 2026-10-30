"use client";

import { settleAction } from "@/lib/api/safe-action";
import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { InlineAlert } from "@/components/ui/states";
import { WriteOnly } from "@/components/read-only";
import { SessionExpiredAlert, useAuthRedirect } from "@/components/session-expired";
import { useToast } from "@/components/ui/toast";
import { buildCardPayload, mapCardFieldIssues, validateCardForm, type CardFormErrors, type CardFormValues } from "@/lib/entries/form";
import type { ActionError, CardDto } from "@/lib/api/types";
import { createCard, updateCard } from "@/app/(protected)/cards/actions";
import { CardFields } from "./card-fields";

type Editing = { mode: "new" } | { mode: "edit"; card: CardDto } | null;

const CardDrawerContext = createContext<{ openNew: () => void; openEdit: (card: CardDto) => void } | null>(null);

function useCardDrawer() {
  const ctx = useContext(CardDrawerContext);
  if (!ctx) throw new Error("useCardDrawer fora de <CardDrawerProvider>");
  return ctx;
}

/** Drawer de cartao (D1): "Novo cartao" e "Editar cartao" compartilham os campos de `CardFields`. */
export function CardDrawerProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Editing>(null);
  return (
    <CardDrawerContext.Provider value={{ openNew: () => setEditing({ mode: "new" }), openEdit: (card) => setEditing({ mode: "edit", card }) }}>
      {children}
      {editing ? <CardDrawer editing={editing} onClose={() => setEditing(null)} /> : null}
    </CardDrawerContext.Provider>
  );
}

function NewCardButtonImpl({ variant, className }: { variant: "primary" | "secondary"; className: string }) {
  const { openNew } = useCardDrawer();
  return (
    <Button variant={variant} className={className} onClick={openNew}>
      Novo cartão
    </Button>
  );
}

/** Na demo (so visualizacao) o botao nao existe (RF31, CA38). */
export function NewCardButton({ variant = "primary", className = "" }: { variant?: "primary" | "secondary"; className?: string }) {
  return (
    <WriteOnly>
      <NewCardButtonImpl variant={variant} className={className} />
    </WriteOnly>
  );
}

function EditCardButtonImpl({ card }: { card: CardDto }) {
  const { openEdit } = useCardDrawer();
  return (
    <Button aria-label={`Editar ${card.name}`} onClick={() => openEdit(card)}>
      Editar
    </Button>
  );
}

export function EditCardButton({ card }: { card: CardDto }) {
  return (
    <WriteOnly>
      <EditCardButtonImpl card={card} />
    </WriteOnly>
  );
}

function CardDrawer({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const toast = useToast();
  const uid = useId();
  const titleId = `${uid}-title`;
  const formId = `${uid}-form`;
  const original = editing.mode === "edit" ? editing.card : null;
  const [values, setValues] = useState<CardFormValues>({
    name: original?.name ?? "",
    closingDay: original ? String(original.closingDay) : "",
    dueDay: original ? String(original.dueDay) : "",
  });
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [banner, setBanner] = useState<{ text: string; closable?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<ActionError | null>(null);
  useAuthRedirect(authError);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const local = validateCardForm(values);
    setErrors(local);
    setBanner(null);
    setAuthError(null);
    if (Object.keys(local).length > 0) {
      const first = local.name ? "name" : local.closingDay ? "closingDay" : "dueDay";
      document.getElementById(formId)?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const payload = buildCardPayload(values);
    if (original && payload.name === original.name && payload.closingDay === original.closingDay && payload.dueDay === original.dueDay) {
      onClose();
      toast.push({ kind: "info", message: "Nenhuma alteração." });
      return;
    }
    setBusy(true);
    const result = await settleAction(() => (original ? updateCard(original.id, payload) : createCard(payload)));
    setBusy(false);
    if (result.ok) {
      onClose();
      toast.push({ kind: "success", message: `Cartão "${result.data.name}" ${original ? "atualizado" : "criado"}.` });
      return;
    }
    const { error } = result;
    if (error.code === "SESSION_EXPIRED" || error.code === "PASSWORD_CHANGE_REQUIRED") {
      setAuthError(error);
      return;
    }
    if (error.status === 404) {
      setBanner({ text: "Este cartão não existe mais.", closable: true });
      return;
    }
    const { fields, unmapped } = mapCardFieldIssues(error.fields);
    if (error.status === 409 && !fields.name) fields.name = "Já existe um cartão com esse nome.";
    if (error.status === 400 || error.status === 409) {
      setErrors(fields);
      if (unmapped.length > 0 || Object.keys(fields).length === 0) setBanner({ text: unmapped[0] ?? error.message });
      else (fields.name ? nameRef.current : document.getElementById(formId)?.querySelector<HTMLElement>("[aria-invalid=true]"))?.focus();
      return;
    }
    setBanner({ text: "Não foi possível salvar o cartão. Seus dados foram mantidos. Tente novamente." });
  };

  return (
    <Drawer
      title={original ? "Editar cartão" : "Novo cartão"}
      titleId={titleId}
      onClose={onClose}
      busy={busy}
      initialFocus="[name=name]"
      footer={
        <div className="flex justify-between gap-3">
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {busy ? "Salvando…" : original ? "Salvar alterações" : "Criar cartão"}
          </Button>
        </div>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        {original ? (
          <InlineAlert tone="info" role="status">
            <p>Alterações valem só para novos lançamentos. Os já registrados continuam na fatura em que foram lançados.</p>
          </InlineAlert>
        ) : null}
        {authError?.code === "SESSION_EXPIRED" ? <SessionExpiredAlert redirectUrl={authError.redirectUrl} /> : null}
        {banner ? <InlineAlert>{banner.text}</InlineAlert> : null}
        <CardFields values={values} errors={errors} onChange={setValues} readOnly={busy} nameRef={nameRef} />
      </form>
    </Drawer>
  );
}
