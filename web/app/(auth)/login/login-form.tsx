"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/states";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/fields";
import { SESSION_EXPIRED_TEXT } from "@/components/session-expired";
import { fieldMessage } from "@/lib/auth/field-messages";
import { useFormAction } from "@/lib/auth/use-form-action";
import { useRetryAfter } from "@/lib/auth/use-retry-after";
import { loginAction } from "../actions";

type Field = "email" | "password";
const FIELDS: Field[] = ["email", "password"];
const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";
const NETWORK_TEXT = "Não foi possível entrar agora. Verifique sua conexão e tente novamente.";

/** Validacao so de presenca (D13): o formato do e-mail e da API, e a senha nunca tem regra de composicao no login. */
function validate(email: string, password: string): Partial<Record<Field, string>> {
  return {
    ...(email === "" ? { email: fieldMessage("login", "email", "REQUIRED") } : {}),
    ...(password === "" ? { password: fieldMessage("login", "password", "REQUIRED") } : {}),
  };
}

/**
 * Formulario de login (design 3, RF41): `useActionState`, erro de credenciais em banner (senha limpa, foco nela), 429 com
 * horario e botao indisponivel ate o prazo, `?reason=expired` como banner informativo. `next` vai bruto; o servidor valida.
 */
export function LoginForm({ next, reason }: { next?: string; reason?: "expired" }) {
  const [state, formAction, pending] = useFormAction(loginAction);
  const bannerId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showClientErrors, setShowClientErrors] = useState(false);
  const [serverFields, setServerFields] = useState<Partial<Record<Field, string>>>({});
  const [seen, setSeen] = useState(state);
  const [focusRequest, setFocusRequest] = useState<{ field: Field; n: number } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Resposta nova do servidor: aplica (ajuste durante a renderizacao, sem efeito)
  if (state !== seen) {
    setSeen(state);
    const fields = (state.fields ?? {}) as Partial<Record<Field, string>>;
    setServerFields(fields);
    if (state.code === "INVALID_CREDENTIALS") {
      setPassword("");
      setFocusRequest({ field: "password", n: (state.at ?? 0) + 1 });
    } else if (state.status === "error" && Object.keys(fields).length > 0) {
      setFocusRequest({ field: FIELDS.find((f) => fields[f]) ?? "email", n: (state.at ?? 0) + 1 });
    }
  }
  useEffect(() => {
    if (focusRequest) (focusRequest.field === "email" ? emailRef : passwordRef).current?.focus();
  }, [focusRequest]);

  const rateLimited = state.code === "TOO_MANY_ATTEMPTS" && state.status === "error";
  const retry = useRetryAfter(rateLimited ? state.retryAfterSeconds : undefined, state.at ? new Date(state.at) : undefined);
  const blocked = rateLimited && !retry.expired;

  const clientErrors = showClientErrors ? validate(email, password) : {};
  const errors: Partial<Record<Field, string>> = { ...serverFields, ...clientErrors };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (pending || blocked) {
      event.preventDefault();
      return;
    }
    const found = validate(email, password);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      event.preventDefault();
      setShowClientErrors(true);
      setServerFields({});
      setFocusRequest({ field: first, n: Date.now() });
      return;
    }
    setShowClientErrors(false);
  };

  let banner = null;
  if (state.status === "error" && state.code === "INVALID_CREDENTIALS") banner = <InlineAlert>{INVALID_CREDENTIALS}</InlineAlert>;
  else if (rateLimited) {
    banner = retry.expired ? (
      <InlineAlert tone="warning" role="status" id={bannerId}>
        Você já pode tentar novamente.
      </InlineAlert>
    ) : (
      <InlineAlert tone="warning" id={bannerId}>
        Muitas tentativas. Tente novamente {retry.text}.
      </InlineAlert>
    );
  } else if (state.status === "error" && !state.fields) banner = <InlineAlert>{NETWORK_TEXT}</InlineAlert>;
  else if (reason === "expired") banner = <InlineAlert tone="info" role="status">{SESSION_EXPIRED_TEXT}</InlineAlert>;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {banner}
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        aria-required="true"
        readOnly={pending}
        value={email}
        error={errors.email}
        inputRef={emailRef}
        onChange={(e) => {
          setEmail(e.target.value);
          setServerFields((f) => ({ ...f, email: undefined }));
        }}
      />
      <PasswordField
        label="Senha"
        name="password"
        autoComplete="current-password"
        required
        readOnly={pending}
        value={password}
        error={errors.password}
        inputRef={passwordRef}
        onChange={(e) => {
          setPassword(e.target.value);
          setServerFields((f) => ({ ...f, password: undefined }));
        }}
      />
      <Button type="submit" variant="primary" loading={pending} disabled={blocked} aria-describedby={blocked ? bannerId : undefined} className="min-h-12 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
