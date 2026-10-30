"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deactivateUserAction } from "@/app/(protected)/admin/users/actions";
import { EnterAgainLink, SESSION_EXPIRED_TEXT, useAuthRedirect } from "@/components/session-expired";
import { AlertDialog } from "@/components/ui/dialogs";
import { useToast } from "@/components/ui/toast";
import { settleAction } from "@/lib/api/safe-action";
import type { ActionError, AdminUserDto } from "@/lib/api/types";
import { staleListCodes, userActionErrorText } from "./action-feedback";

/**
 * Inativar (design 6.7, RF14, CA20, CA24): `AlertDialog` sem a linha de "irreversivel" (e reversivel). `LAST_ADMIN` e
 * `CANNOT_TARGET_SELF` ficam no dialogo, que continua aberto; `onDone` avisa a lista (foco vai para "Reativar").
 */
export function DeactivateUserDialog({ user, onClose, onDone }: { user: AdminUserDto; onClose: () => void; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  useAuthRedirect(error);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await settleAction(() => deactivateUserAction(user.id));
    setBusy(false);
    if (result.ok) {
      toast.push({ kind: "success", message: `${user.name} foi inativado.` });
      router.refresh();
      onDone?.();
      onClose();
      return;
    }
    if (staleListCodes.has(result.error.code)) {
      toast.push({ kind: "error", message: userActionErrorText(result.error) });
      router.refresh();
      onClose();
      return;
    }
    setError(result.error);
  };

  const expired = error?.code === "SESSION_EXPIRED";
  const text = error ? (
    <>
      {expired ? SESSION_EXPIRED_TEXT : userActionErrorText(error)}
      {expired && error.redirectUrl ? (
        <>
          {" "}
          <EnterAgainLink redirectUrl={error.redirectUrl} />
        </>
      ) : null}
    </>
  ) : null;
  return (
    <AlertDialog title={`Inativar ${user.name}?`} confirmLabel="Inativar" busyLabel="Inativando…" busy={busy} irreversible={false} error={text} onConfirm={() => void confirm()} onCancel={onClose}>
      <p>
        {user.name} não conseguirá mais entrar, e todas as sessões abertas serão encerradas agora. Os dados financeiros são mantidos. Você pode reativar a conta depois.
      </p>
    </AlertDialog>
  );
}
