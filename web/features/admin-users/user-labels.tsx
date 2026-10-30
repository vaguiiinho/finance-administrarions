import type { AdminUserDto } from "@/lib/api/types";
import { Icon } from "@/components/ui/status";

/** Indicadores da lista de usuarios e do perfil (design 1): sempre icone + texto, nunca so cor (RNF09, DA14). */
export function UserRoleLabel({ role }: { role: AdminUserDto["role"] }) {
  const admin = role === "ADMIN";
  return (
    <span className={`inline-flex items-center gap-1.5 ${admin ? "text-text" : "text-muted"}`}>
      <Icon name={admin ? "shield" : "person"} />
      {admin ? "Administrador" : "Usuário comum"}
    </span>
  );
}

export function UserStatusLabel({ status }: { status: AdminUserDto["status"] }) {
  const active = status === "ACTIVE";
  return (
    <span className={`inline-flex items-center gap-1.5 ${active ? "text-success-text" : "text-muted"}`}>
      <Icon name={active ? "check" : "slashCircle"} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function PasswordPendingLabel({ pending }: { pending: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${pending ? "text-warning-text" : "text-muted"}`}>
      <Icon name={pending ? "keyClock" : "dash"} />
      {pending ? "Troca de senha pendente" : "Em dia"}
    </span>
  );
}
