"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { changePasswordAction } from "@/app/(protected)/account/password/actions";
import { SessionExpiredAlert, useAuthRedirect } from "@/components/session-expired";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { InlineAlert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { fieldMessage } from "@/lib/auth/field-messages";
import { useFormAction } from "@/lib/auth/use-form-action";
import { useRetryAfter } from "@/lib/auth/use-retry-after";
import { clearFlash, setFlash } from "@/lib/flash";

type Field = "currentPassword" | "newPassword" | "confirmPassword";
const FIELDS: Field[] = ["currentPassword", "newPassword", "confirmPassword"];
const NETWORK_TEXT = "Não foi possível salvar agora. Verifique sua conexão e tente novamente.";

/** Ordem do design 4.3: presenca e tamanho da nova senha e igualdade da confirmacao; so entao a action chama a API. */
function validate(current: string, next: string, confirm: string): Partial<Record<Field, string>> {
  const size = [...next].length;
  const errors: Partial<Record<Field, string>> = {};
  if (current === "") errors.currentPassword = fieldMessage("password", "currentPassword", "REQUIRED");
  if (next === "") errors.newPassword = fieldMessage("password", "newPassword", "REQUIRED");
  else if (size < 8) errors.newPassword = fieldMessage("password", "newPassword", "TOO_SHORT");
  else if (size > 72) errors.newPassword = fieldMessage("password", "newPassword", "TOO_LONG");
  if (confirm === "") errors.confirmPassword = fieldMessage("password", "confirmPassword", "REQUIRED");
  else if (next !== "" && confirm !== next) errors.confirmPassword = "As senhas não conferem.";
  return errors;
}

/**
 * Trocar senha (design 4, RF07, RF08, RF42). `mode="required"` = troca obrigatoria apos senha temporaria (sem "Cancelar",
 * `next` preservado); `optional` = pelo menu da conta. A confirmacao so existe aqui: diferente -> erro de campo, sem API.
 */
export function ChangePasswordForm({ mode, next, nextLabel }: { mode: "required" | "optional"; next?: string; nextLabel?: string | null }) {
  const [state, formAction, pending] = useFormAction(changePasswordAction);
  const toast = useToast();
  const bannerId = useId();
  const [current, setCurrent] = useState("");
  const [fresh, setFresh] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showClientErrors, setShowClientErrors] = useState(false);
  const [serverFields, setServerFields] = useState<Partial<Record<Field, string>>>({});
  const [seen, setSeen] = useState(state);
  const [focusRequest, setFocusRequest] = useState<{ field: Field; n: number } | null>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  if (state !== seen) {
    setSeen(state);
    const fields = (state.fields ?? {}) as Partial<Record<Field, string>>;
    setServerFields(fields);
    if (state.status === "success") {
      setCurrent("");
      setFresh("");
      setConfirm("");
    } else if (state.status === "error" && Object.keys(fields).length > 0) {
      if (fields.currentPassword) setCurrent(""); // senha atual incorreta: limpa e foca nela; nova e confirmacao ficam
      setFocusRequest({ field: FIELDS.find((f) => fields[f]) ?? "currentPassword", n: state.at ?? 0 });
    }
  }
  useEffect(() => {
    if (!focusRequest) return;
    const target = { currentPassword: currentRef, newPassword: newRef, confirmPassword: confirmRef }[focusRequest.field];
    target.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (state.status === "error") clearFlash(); // a troca falhou: nao ha o que anunciar no destino
    if (state.status !== "success") return;
    toast.push({ kind: "success", message: state.message ?? "Senha alterada." });
    const heading = document.querySelector<HTMLElement>("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    // so quando chega uma resposta nova
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useAuthRedirect(state.status === "error" ? state : null);

  const rateLimited = state.status === "error" && state.code === "TOO_MANY_ATTEMPTS";
  const retry = useRetryAfter(rateLimited ? state.retryAfterSeconds : undefined, state.at ? new Date(state.at) : undefined);
  const blocked = rateLimited && !retry.expired;

  const errors: Partial<Record<Field, string>> = { ...serverFields, ...(showClientErrors ? validate(current, fresh, confirm) : {}) };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (pending || blocked) {
      event.preventDefault();
      return;
    }
    const found = validate(current, fresh, confirm);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      event.preventDefault();
      setShowClientErrors(true);
      setServerFields({});
      setFocusRequest({ field: first, n: Date.now() });
      return;
    }
    setShowClientErrors(false);
    // troca obrigatoria: a action redireciona no servidor; o toast "Senha alterada." aparece no destino (design 4.4)
    if (mode === "required") setFlash("Senha alterada.");
  };

  let banner = null;
  if (state.status === "error") {
    if (state.code === "SESSION_EXPIRED") banner = <SessionExpiredAlert redirectUrl={state.redirectUrl} />;
    else if (rateLimited)
      banner = retry.expired ? (
        <InlineAlert tone="warning" role="status" id={bannerId}>
          Você já pode tentar novamente.
        </InlineAlert>
      ) : (
        <InlineAlert tone="warning" id={bannerId}>
          Muitas tentativas. Tente novamente {retry.text}.
        </InlineAlert>
      );
    else if (!state.fields && state.code !== "PASSWORD_CHANGE_REQUIRED") banner = <InlineAlert>{NETWORK_TEXT}</InlineAlert>;
  }

  const edit = (field: Field, set: (value: string) => void) => (event: { target: { value: string } }) => {
    set(event.target.value);
    setServerFields((f) => ({ ...f, [field]: undefined }));
  };

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {mode === "required" ? (
        <InlineAlert tone="info" role="status">
          <p className="font-semibold">Defina uma nova senha para continuar.</p>
          {nextLabel ? <p className="text-muted">Você entrou com uma senha temporária. Depois de salvar, você segue para {nextLabel}.</p> : null}
        </InlineAlert>
      ) : (
        <p className="text-sm text-muted">Depois de salvar, as outras sessões abertas são encerradas.</p>
      )}
      {banner}
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next ?? ""} />
      <PasswordField label="Senha atual" name="currentPassword" autoComplete="current-password" required readOnly={pending} value={current} error={errors.currentPassword} inputRef={currentRef} onChange={edit("currentPassword", setCurrent)} />
      <PasswordField label="Nova senha" name="newPassword" autoComplete="new-password" lengthHint required readOnly={pending} value={fresh} error={errors.newPassword} inputRef={newRef} onChange={edit("newPassword", setFresh)} />
      <PasswordField label="Confirmar nova senha" name="confirmPassword" autoComplete="new-password" required readOnly={pending} value={confirm} error={errors.confirmPassword} inputRef={confirmRef} onChange={edit("confirmPassword", setConfirm)} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {mode === "optional" ? (
          <Link href="/account" className="btn btn-tertiary min-h-12 sm:min-h-11">
            Cancelar
          </Link>
        ) : null}
        <Button type="submit" variant="primary" loading={pending} disabled={blocked} aria-describedby={blocked ? bannerId : undefined} className="min-h-12 sm:min-h-11">
          {pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </div>
    </form>
  );
}
