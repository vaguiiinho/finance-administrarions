"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { reactivateUserAction } from "@/app/(protected)/admin/users/actions";
import { useAuthRedirect } from "@/components/session-expired";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatInstantDate } from "@/lib/dates/format";
import { settleAction } from "@/lib/api/safe-action";
import type { ActionError, AdminUserDto } from "@/lib/api/types";
import { staleListCodes, userActionErrorText } from "./action-feedback";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { UserFormDrawer } from "./user-form-drawer";
import { PasswordPendingLabel, UserRoleLabel, UserStatusLabel } from "./user-labels";

type Drawer = { mode: "new" } | { mode: "edit"; user: AdminUserDto } | null;
const HIGHLIGHT_MS = 2500;

/** Gatilho visivel com nome acessivel "<acao> <usuario>": comeca pelo texto visivel (WCAG 2.5.3). */
function RowAction({ label, busyLabel, user, kind, busy, inert, onClick }: { label: string; busyLabel?: string; user: AdminUserDto; kind: string; busy?: boolean; inert: boolean; onClick: () => void }) {
  return (
    <Button variant="tertiary" data-user-action={kind} data-user-id={user.id} loading={busy} disabled={inert && !busy} onClick={onClick} className="max-md:flex-1 max-md:border">
      {busy ? busyLabel : label}{" "}
      <span className="sr-only">{user.name}</span>
    </Button>
  );
}

/**
 * Gestao de usuarios (design 6, RF10-RF19, RF44): grupos "Ativos"/"Inativos", tabela a partir de `md` e itens abaixo.
 * Acoes na propria linha ("Inativar" e "Redefinir senha" nao existem para si mesmo, DA15); `LAST_ADMIN` nao e antecipado (DA16).
 * Nenhum dado financeiro aparece aqui (CA25).
 */
export function UsersList({ users, currentUserId }: { users: AdminUserDto[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [resetting, setResetting] = useState<AdminUserDto | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUserDto | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [expired, setExpired] = useState<ActionError | null>(null);
  const focusAfterRefresh = useRef<{ id: string; kind: string } | null>(null);
  useAuthRedirect(expired);

  const active = users.filter((u) => u.status === "ACTIVE");
  const inactive = users.filter((u) => u.status === "INACTIVE");
  const alone = users.length === 1 && users[0].id === currentUserId;

  // Depois de recarregar a lista, o foco vai para onde a acao levou a linha (o gatilho antigo nao existe mais)
  useEffect(() => {
    const pending = focusAfterRefresh.current;
    if (!pending) return;
    focusAfterRefresh.current = null;
    const nodes = document.querySelectorAll<HTMLElement>(`[data-user-action="${pending.kind}"][data-user-id="${pending.id}"]`);
    Array.from(nodes).find((node) => node.offsetParent !== null)?.focus();
  }, [users]);

  // Linha recem-criada: destaque estatico ~2,5 s e foco no nome
  useEffect(() => {
    if (!highlightId) return;
    const nodes = document.querySelectorAll<HTMLElement>(`[data-user-name="${highlightId}"]`);
    Array.from(nodes).find((node) => node.offsetParent !== null)?.focus();
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId, users]);

  const reactivate = async (user: AdminUserDto) => {
    if (reactivatingId) return;
    setReactivatingId(user.id);
    const result = await settleAction(() => reactivateUserAction(user.id));
    setReactivatingId(null);
    if (result.ok) {
      toast.push({ kind: "success", message: `${user.name} foi reativado.` });
      focusAfterRefresh.current = { id: user.id, kind: "deactivate" };
      router.refresh();
      return;
    }
    const { error } = result;
    toast.push({ kind: "error", message: userActionErrorText(error) });
    if (staleListCodes.has(error.code)) router.refresh();
    else if (error.code === "SESSION_EXPIRED") setExpired(error);
  };

  const openEdit = (user: AdminUserDto) => setDrawer({ mode: "edit", user });
  const actions = (user: AdminUserDto) => {
    const self = user.id === currentUserId;
    const busy = reactivatingId === user.id;
    const inert = reactivatingId !== null;
    return (
      <div className="flex flex-wrap gap-2">
        <RowAction label="Editar" user={user} kind="edit" inert={inert} onClick={() => openEdit(user)} />
        {self ? null : <RowAction label="Redefinir senha" user={user} kind="reset" inert={inert} onClick={() => setResetting(user)} />}
        {self || user.status !== "ACTIVE" ? null : <RowAction label="Inativar" user={user} kind="deactivate" inert={inert} onClick={() => setDeactivating(user)} />}
        {user.status === "INACTIVE" ? <RowAction label="Reativar" busyLabel="Reativando…" user={user} kind="reactivate" busy={busy} inert={inert} onClick={() => void reactivate(user)} /> : null}
      </div>
    );
  };

  const nameOf = (user: AdminUserDto) => (
    <>
      <span data-user-name={user.id} tabIndex={-1} className={`rounded font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${user.status === "INACTIVE" ? "text-muted" : "text-text"}`}>
        {user.name}
      </span>
      {user.id === currentUserId ? <span className="text-sm text-muted"> (você)</span> : null}
    </>
  );
  const highlight = (user: AdminUserDto) => (highlightId === user.id ? "row-highlight" : "");

  const summary = `${users.length} ${users.length === 1 ? "usuário" : "usuários"}${inactive.length > 0 ? ` · ${inactive.length} ${inactive.length === 1 ? "inativo" : "inativos"}` : ""}`;
  const groups = [
    { title: `Ativos (${active.length})`, items: active },
    ...(inactive.length > 0 ? [{ title: `Inativos (${inactive.length})`, items: inactive }] : []),
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Usuários</h1>
          <p className="text-muted">{summary}</p>
        </div>
        <Button variant="primary" className="min-h-12 w-full sm:min-h-11 sm:w-auto" onClick={() => setDrawer({ mode: "new" })}>
          Novo usuário
        </Button>
      </header>
      <p className="text-sm text-muted">Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas.</p>

      {/* Tabela (>= md) */}
      <div className="glass-flat hidden overflow-clip rounded-xl md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Usuários</caption>
          <thead className="sticky top-[var(--navbar-h)] z-10 glass-bar text-left text-muted">
            <tr className="border-b border-border-strong">
              <th scope="col" className="px-4 py-3 font-medium">Usuário</th>
              <th scope="col" className="px-2 py-3 font-medium">Nível</th>
              <th scope="col" className="px-2 py-3 font-medium">Situação</th>
              <th scope="col" className="px-2 py-3 font-medium">Senha</th>
              <th scope="col" className="px-2 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th scope="rowgroup" colSpan={5} className="bg-card-2 px-4 py-2 text-left text-sm font-semibold text-text">
                  {group.title}
                </th>
              </tr>
              {group.items.map((user) => (
                <tr key={user.id} className={`border-b border-border align-top ${highlight(user)}`}>
                  <td className="px-4 py-3">
                    <p>{nameOf(user)}</p>
                    <p className="[overflow-wrap:anywhere] text-muted">{user.email}</p>
                    <p className="text-xs text-muted">Criado em {formatInstantDate(user.createdAt)}</p>
                  </td>
                  <td className="px-2 py-3"><UserRoleLabel role={user.role} /></td>
                  <td className="px-2 py-3"><UserStatusLabel status={user.status} /></td>
                  <td className="px-2 py-3"><PasswordPendingLabel pending={user.mustChangePassword} /></td>
                  <td className="px-2 py-3">{actions(user)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Itens (< md) */}
      <div className="flex flex-col gap-4 md:hidden">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-text">{group.title}</h2>
            <ul className="flex flex-col gap-3">
              {group.items.map((user) => (
                <li key={user.id} className={`glass-flat flex flex-col gap-2 rounded-xl p-4 ${highlight(user)}`}>
                  <p>{nameOf(user)}</p>
                  <p className="[overflow-wrap:anywhere] text-muted">{user.email}</p>
                  <UserRoleLabel role={user.role} />
                  <UserStatusLabel status={user.status} />
                  <PasswordPendingLabel pending={user.mustChangePassword} />
                  <p className="text-xs text-muted">Criado em {formatInstantDate(user.createdAt)}</p>
                  {actions(user)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {alone ? (
        <EmptyState title="Você é o único usuário." description="Use “Novo usuário” para dar acesso a outras pessoas.">
          <Button variant="primary" onClick={() => setDrawer({ mode: "new" })}>
            Novo usuário
          </Button>
        </EmptyState>
      ) : null}

      {drawer ? (
        <UserFormDrawer
          user={drawer.mode === "edit" ? drawer.user : undefined}
          currentUserId={currentUserId}
          onClose={() => setDrawer(null)}
          onSaved={(saved) => {
            if (drawer.mode === "new") setHighlightId(saved.id);
          }}
        />
      ) : null}
      {resetting ? <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} /> : null}
      {deactivating ? (
        <DeactivateUserDialog
          user={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={() => {
            focusAfterRefresh.current = { id: deactivating.id, kind: "reactivate" };
          }}
        />
      ) : null}
    </div>
  );
}
