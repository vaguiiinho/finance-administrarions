"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { resetUserPasswordAction } from "@/app/(protected)/admin/users/actions";
import { EnterAgainLink, SESSION_EXPIRED_TEXT, useAuthRedirect } from "@/components/session-expired";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { PasswordField } from "@/components/ui/password-field";
import { useToast } from "@/components/ui/toast";
import { settleAction } from "@/lib/api/safe-action";
import type { ActionError, AdminUserDto } from "@/lib/api/types";
import { fieldMessage } from "@/lib/auth/field-messages";
import { staleListCodes, userActionErrorText } from "./action-feedback";

/**
 * Redefinir senha (design 6.6, RF16, CA22): modal de formulario, senha temporaria VISIVEL por padrao (PA6, `autocomplete=off`).
 * Clique no scrim nao fecha (ha dado digitado); durante o envio Esc e ignorado (`busy`).
 */
export function ResetPasswordDialog({ user, onClose }: { user: AdminUserDto; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const titleId = `${uid}-title`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<ActionError | null>(null);
  useAuthRedirect(error);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password === "") {
      setFieldError(fieldMessage("user", "password", "REQUIRED"));
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    const result = await settleAction(() => resetUserPasswordAction(user.id, { password }));
    setBusy(false);
    if (result.ok) {
      toast.push({ kind: "success", message: `Senha de ${user.name} redefinida. Informe a nova senha temporária a essa pessoa.` });
      router.refresh();
      onClose();
      return;
    }
    const { error: failure } = result;
    const issue = failure.fields?.find((f) => f.field === "password");
    if (issue) {
      setFieldError(fieldMessage("user", "password", issue.code));
      inputRef.current?.focus();
      return;
    }
    if (staleListCodes.has(failure.code)) {
      toast.push({ kind: "error", message: userActionErrorText(failure) });
      router.refresh();
      onClose();
      return;
    }
    setError(failure);
  };

  const message = error ? (error.code === "SESSION_EXPIRED" ? SESSION_EXPIRED_TEXT : userActionErrorText(error)) : null;
  return (
    <ModalDialog variant="modal" labelledBy={titleId} onClose={onClose} busy={busy} initialFocus="input[name='password']">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <h2 id={titleId} className="font-display text-xl font-semibold text-text">
          Redefinir senha de {user.name}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-text">
          <li>A senha atual de {user.name} deixa de valer.</li>
          <li>Todas as sessões abertas serão encerradas agora.</li>
          <li>No próximo acesso, será preciso definir uma nova senha.</li>
        </ul>
        {user.status === "INACTIVE" ? <p className="text-sm text-muted">A nova senha passa a valer quando a conta for reativada.</p> : null}
        <PasswordField
          label="Nova senha temporária"
          name="password"
          autoComplete="off"
          initiallyVisible
          lengthHint
          help="Informe-a a essa pessoa fora do sistema."
          readOnly={busy}
          value={password}
          error={fieldError}
          inputRef={inputRef}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldError(undefined);
          }}
        />
        {message ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger-text">
            {message}
            {error?.redirectUrl && error.code === "SESSION_EXPIRED" ? <EnterAgainLink redirectUrl={error.redirectUrl} /> : null}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {busy ? "Redefinindo…" : "Redefinir senha"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
