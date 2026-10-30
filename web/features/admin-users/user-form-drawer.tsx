"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { createUserAction, updateUserAction } from "@/app/(protected)/admin/users/actions";
import { SessionExpiredAlert, useAuthRedirect } from "@/components/session-expired";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { TextField } from "@/components/ui/fields";
import { PasswordField } from "@/components/ui/password-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { InlineAlert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { settleAction } from "@/lib/api/safe-action";
import type { ActionError, AdminUserDto, Role } from "@/lib/api/types";
import { fieldMessage } from "@/lib/auth/field-messages";
import { NETWORK_TEXT, staleListCodes, userActionErrorText } from "./action-feedback";

type Field = "name" | "email" | "role" | "password";
type Errors = Partial<Record<Field, string>>;
const NAME_LIMIT = 60;
const ROLE_HELP = "Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas.";
const ROLE_OPTIONS = [
  { value: "USER", label: "Usuário comum" },
  { value: "ADMIN", label: "Administrador" },
] as const;

/** So presenca (a API valida formato e tamanhos e responde todos os campos de uma vez, CA18). */
function validate(values: { name: string; email: string; role: string; password: string }, creating: boolean): Errors {
  return {
    ...(values.name === "" ? { name: fieldMessage("user", "name", "REQUIRED") } : {}),
    ...(values.email === "" ? { email: fieldMessage("user", "email", "REQUIRED") } : {}),
    ...(values.role === "" ? { role: fieldMessage("user", "role", "REQUIRED") } : {}),
    ...(creating && values.password === "" ? { password: fieldMessage("user", "password", "REQUIRED") } : {}),
  };
}

/**
 * Criar e editar usuario (design 6.4-6.5, RF12, RF13): `Drawer` existente. Senha temporaria so ao criar, VISIVEL por padrao
 * (PA6). `EMAIL_TAKEN` vai ao campo E-mail, `LAST_ADMIN` ao Nivel. Editar a si mesmo para "Usuario comum" avisa, nao bloqueia (PA7).
 */
export function UserFormDrawer({ user, currentUserId, onClose, onSaved }: { user?: AdminUserDto; currentUserId: string; onClose: () => void; onSaved?: (user: AdminUserDto) => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const creating = user === undefined;
  const titleId = `${uid}-title`;
  const formId = `${uid}-form`;
  const roleLabelId = `${uid}-role-label`;
  const roleHelpId = `${uid}-role-help`;
  const roleErrorId = `${uid}-role-error`;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role | "">(user?.role ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ActionError | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const roleGroup = useRef<HTMLDivElement>(null);
  useAuthRedirect(failure);

  const focusField = (field: Field) => {
    if (field === "role") roleGroup.current?.querySelector<HTMLElement>("[role='radio'][tabindex='0']")?.focus();
    else ({ name: nameRef, email: emailRef, password: passwordRef })[field].current?.focus();
  };
  const clear = (field: Field) => setErrors((current) => ({ ...current, [field]: undefined }));
  const ORDER: Field[] = ["name", "email", "role", "password"];
  const showErrors = (next: Errors) => {
    setErrors(next);
    const first = ORDER.find((field) => next[field]);
    if (first) focusField(first);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const values = { name, email, role, password };
    const found = validate(values, creating);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setBusy(true);
    setFailure(null);
    setErrors({});
    const result = creating
      ? await settleAction(() => createUserAction({ name, email, role, password }))
      : await settleAction(() => updateUserAction(user.id, { name, email, role }));
    setBusy(false);

    if (result.ok) {
      const saved = "user" in result.data ? result.data.user : result.data;
      if ("selfDemoted" in result.data && result.data.selfDemoted) {
        // PA7: sem acesso a gestao, a pagina viraria not-found; leva para /entries (a action ja revalidou o layout)
        toast.push({ kind: "success", message: "Alterações salvas. Você não tem mais acesso à gestão de usuários." });
        onClose();
        router.replace("/entries");
        return;
      }
      toast.push({ kind: "success", message: creating ? `Usuário criado: ${saved.name}. Informe a senha temporária a essa pessoa.` : "Alterações salvas." });
      onSaved?.(saved);
      router.refresh();
      onClose();
      return;
    }

    const { error } = result;
    if (staleListCodes.has(error.code)) {
      toast.push({ kind: "error", message: userActionErrorText(error) });
      router.refresh();
      onClose();
      return;
    }
    const issues = (error.fields ?? []).filter((issue) => ORDER.includes(issue.field as Field));
    if (issues.length > 0) {
      const mapped: Errors = {};
      for (const issue of issues) mapped[issue.field as Field] ??= fieldMessage("user", issue.field, issue.code);
      showErrors(mapped);
      return;
    }
    if (error.code === "LAST_ADMIN") {
      showErrors({ role: userActionErrorText(error) });
      return;
    }
    setFailure(error);
  };

  const warnSelfDemotion = user !== undefined && user.id === currentUserId && user.role === "ADMIN" && role === "USER";
  const nameSize = [...name].length;
  let banner = null;
  if (failure) {
    banner = failure.code === "SESSION_EXPIRED" ? <SessionExpiredAlert redirectUrl={failure.redirectUrl} /> : <InlineAlert>{failure.status === 0 || failure.code === "NETWORK_ERROR" ? NETWORK_TEXT : userActionErrorText(failure)}</InlineAlert>;
  }

  return (
    <Drawer
      title={creating ? "Novo usuário" : `Editar ${user.name}`}
      titleId={titleId}
      onClose={onClose}
      busy={busy}
      initialFocus="input[name='name']"
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {creating ? (busy ? "Criando…" : "Criar usuário") : busy ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate data-surface="opaque" className="flex flex-col gap-4">
        {banner}
        <TextField
          label="Nome"
          name="name"
          autoComplete="off"
          aria-required="true"
          readOnly={busy}
          value={name}
          error={errors.name}
          inputRef={nameRef}
          counter={nameSize >= 50 ? <span className={`text-sm ${nameSize > NAME_LIMIT ? "text-danger-text" : "text-muted"}`}>{`${nameSize}/${NAME_LIMIT}`}</span> : undefined}
          onChange={(event) => {
            setName(event.target.value);
            clear("name");
          }}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-required="true"
          readOnly={busy}
          value={email}
          error={errors.email}
          inputRef={emailRef}
          onChange={(event) => {
            setEmail(event.target.value);
            clear("email");
          }}
        />
        <div className="flex flex-col gap-1.5">
          <p id={roleLabelId} className="text-sm font-medium text-text">
            Nível
          </p>
          <div ref={roleGroup}>
            <SegmentedControl
              options={ROLE_OPTIONS}
              value={role as Role}
              disabled={busy}
              aria-labelledby={roleLabelId}
              aria-describedby={[errors.role ? roleErrorId : null, roleHelpId].filter(Boolean).join(" ")}
              onChange={(next) => {
                setRole(next);
                clear("role");
              }}
            />
          </div>
          {errors.role ? (
            <p id={roleErrorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
              </svg>
              {errors.role}
            </p>
          ) : null}
          <p id={roleHelpId} className="text-sm text-muted">
            {ROLE_HELP}
          </p>
          {warnSelfDemotion ? (
            <InlineAlert tone="warning" role="status">
              Você deixará de ter acesso à gestão de usuários.
            </InlineAlert>
          ) : null}
        </div>
        {creating ? (
          <PasswordField
            label="Senha temporária"
            name="password"
            autoComplete="off"
            initiallyVisible
            lengthHint
            help="A pessoa precisará trocá-la no primeiro acesso. Informe-a fora do sistema."
            readOnly={busy}
            value={password}
            error={errors.password}
            inputRef={passwordRef}
            onChange={(event) => {
              setPassword(event.target.value);
              clear("password");
            }}
          />
        ) : null}
      </form>
    </Drawer>
  );
}
