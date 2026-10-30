"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { updateProfileAction } from "@/app/(protected)/account/actions";
import { SessionExpiredAlert, useAuthRedirect } from "@/components/session-expired";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { CurrentUserDto } from "@/lib/api/types";
import { fieldMessage } from "@/lib/auth/field-messages";
import { useFormAction } from "@/lib/auth/use-form-action";
import { UserRoleLabel } from "../admin-users/user-labels";

const NAME_LIMIT = 60;
const COUNTER_FROM = 50;

/**
 * Meu perfil (design 5, RF09, RF43, CA11): so o nome e editavel; e-mail e nivel em <dl> de texto. O nome devolvido pela
 * API (ja normalizado) volta ao campo; a navbar atualiza com `router.refresh()` + revalidacao do layout.
 */
export function ProfileForm({ user }: { user: CurrentUserDto }) {
  const [state, formAction, pending] = useFormAction(updateProfileAction);
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | undefined>();
  const [seen, setSeen] = useState(state);
  const inputRef = useRef<HTMLInputElement>(null);

  if (state !== seen) {
    setSeen(state);
    setServerError(state.fields?.name);
    if (state.status === "success" && state.values?.name !== undefined) setName(state.values.name);
  }

  useEffect(() => {
    if (state.status === "success") {
      toast.push({ kind: "success", message: state.message ?? "Perfil atualizado." });
      router.refresh();
    } else if (state.fields?.name) {
      inputRef.current?.focus();
    }
    // so quando chega uma resposta nova
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useAuthRedirect(state.status === "error" ? state : null);

  const size = [...name].length;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (name.trim() === "") {
      event.preventDefault();
      setClientError(fieldMessage("profile", "name", "REQUIRED"));
      inputRef.current?.focus();
      return;
    }
    setClientError(null);
  };

  const error = clientError ?? serverError;
  let banner = null;
  if (state.status === "error") {
    if (state.code === "SESSION_EXPIRED") banner = <SessionExpiredAlert redirectUrl={state.redirectUrl} />;
    else if (!state.fields && state.code !== "PASSWORD_CHANGE_REQUIRED") banner = <InlineAlert>Não foi possível salvar agora. Verifique sua conexão e tente novamente.</InlineAlert>;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section aria-labelledby="profile-title" className="card flex flex-col gap-4 p-5 md:p-8">
        <h2 id="profile-title" className="font-display text-xl font-semibold text-text">
          Dados da conta
        </h2>
        <form action={formAction} onSubmit={onSubmit} noValidate data-surface="opaque" className="flex flex-col gap-4">
          {banner}
          <TextField
            label="Nome"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            aria-required="true"
            readOnly={pending}
            value={name}
            error={error}
            inputRef={inputRef}
            counter={size >= COUNTER_FROM ? <span className={`text-sm ${size > NAME_LIMIT ? "text-danger-text" : "text-muted"}`}>{`${size}/${NAME_LIMIT}`}</span> : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setClientError(null);
              setServerError(undefined);
            }}
          />
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[140px_1fr]">
            <dt className="text-sm font-medium text-muted">E-mail</dt>
            <dd className="break-words text-text [overflow-wrap:anywhere]">{user.email}</dd>
            <dt className="text-sm font-medium text-muted">Nível</dt>
            <dd className="text-text">
              <UserRoleLabel role={user.role} />
            </dd>
          </dl>
          <p className="text-sm text-muted">Para alterar, fale com um administrador.</p>
          <div className="flex sm:justify-end">
            <Button type="submit" variant="primary" loading={pending} className="min-h-12 w-full sm:min-h-11 sm:w-auto">
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </section>
      <section aria-labelledby="password-card-title" className="card flex flex-col gap-3 p-5 md:p-8">
        <h2 id="password-card-title" className="font-display text-xl font-semibold text-text">
          Senha
        </h2>
        <p className="text-muted">Troque sua senha quando quiser.</p>
        <div className="flex sm:justify-end">
          <Link href="/account/password" className="btn min-h-12 w-full sm:min-h-11 sm:w-auto">
            Trocar senha
          </Link>
        </div>
      </section>
    </div>
  );
}
