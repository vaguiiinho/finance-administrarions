import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordPendingLabel, UserRoleLabel, UserStatusLabel } from "./user-labels";

describe("indicadores com icone e texto (RNF09, DA14)", () => {
  it.each([
    [<UserRoleLabel key="a" role="ADMIN" />, "Administrador"],
    [<UserRoleLabel key="b" role="USER" />, "Usuário comum"],
    [<UserStatusLabel key="c" status="ACTIVE" />, "Ativo"],
    [<UserStatusLabel key="d" status="INACTIVE" />, "Inativo"],
    [<PasswordPendingLabel key="e" pending />, "Troca de senha pendente"],
    [<PasswordPendingLabel key="f" pending={false} />, "Em dia"],
  ])("texto visivel e icone decorativo (%#)", (ui, text) => {
    const { container } = render(ui);
    expect(screen.getByText(text)).toBeVisible();
    expect(container.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });
});
