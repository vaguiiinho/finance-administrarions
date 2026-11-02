import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders } from "@/test/helpers/providers";
import type { CurrentUserDto } from "@/lib/api/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/entries", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));
vi.mock("@/app/(auth)/actions", () => ({ logoutAction: vi.fn() }));

import { AccountMenu } from "./account-menu";

// ADR 0011 9 (B6, B8, S10): o menu decide pelo que a API informa em `me.capabilities`, nao por `role` nem por e-mail.
const user = (over: Partial<CurrentUserDto> & Record<string, unknown>): CurrentUserDto =>
  ({ id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false, accountKind: "REGULAR", capabilities: [], ...over }) as CurrentUserDto;

const SHOWCASE = user({ id: "d2", name: "Conta de demonstração", email: "demo@showcase.invalid", accountKind: "SHOWCASE", capabilities: ["MANAGE_EXPENSES"] });

const open = async (u: CurrentUserDto) => {
  render(
    <AllProviders>
      <AccountMenu user={u} />
    </AllProviders>,
  );
  await userEvent.click(screen.getByRole("button", { name: `Conta de ${u.name}` }));
};
const itemNames = () => screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());

beforeEach(() => vi.clearAllMocks());

describe("AccountMenu: me sem `capabilities` (S5)", () => {
  it("nao lanca e mostra so 'Sair'", async () => {
    const legacy = user({});
    delete (legacy as unknown as Record<string, unknown>).capabilities;
    await open(legacy);
    expect(itemNames()).toEqual(["Sair"]);
  });
});

describe("AccountMenu: conta demo (B8, P19)", () => {
  it("esconde 'Trocar senha' e 'Meu perfil' (sem CHANGE_OWN_PASSWORD nem UPDATE_OWN_PROFILE); sobra so 'Sair'", async () => {
    await open(SHOWCASE);
    expect(screen.queryByRole("menuitem", { name: /trocar senha|alterar senha/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Meu perfil" })).not.toBeInTheDocument();
    expect(itemNames()).toEqual(["Sair"]);
  });

  it("mostra o e-mail da conta no cabecalho, como qualquer e-mail", async () => {
    await open(SHOWCASE);
    expect(screen.getByText("demo@showcase.invalid")).toBeInTheDocument();
  });
});

describe("AccountMenu: decide por capacidades, nao por role (S10)", () => {
  it("USER com as capacidades comuns: Meu perfil, Trocar senha, Sair - sem Usuarios", async () => {
    await open(user({ capabilities: ["CHANGE_OWN_PASSWORD", "MANAGE_EXPENSES", "UPDATE_OWN_PROFILE"] }));
    expect(itemNames()).toEqual(["Meu perfil", "Trocar senha", "Sair"]);
  });

  it("'Usuarios' aparece com MANAGE_USERS", async () => {
    await open(user({ name: "Vagner", role: "ADMIN", capabilities: ["CHANGE_OWN_PASSWORD", "MANAGE_EXPENSES", "MANAGE_USERS", "UPDATE_OWN_PROFILE"] }));
    expect(itemNames()).toContain("Usuários");
  });

  it("'Usuarios' NAO aparece sem MANAGE_USERS, mesmo com role ADMIN (caso sintetico)", async () => {
    await open(user({ name: "Vagner", role: "ADMIN", capabilities: ["CHANGE_OWN_PASSWORD", "UPDATE_OWN_PROFILE"] }));
    expect(itemNames()).not.toContain("Usuários");
  });

  it("'Trocar senha' some sem CHANGE_OWN_PASSWORD, mesmo para REGULAR", async () => {
    await open(user({ capabilities: ["UPDATE_OWN_PROFILE"] }));
    expect(itemNames()).not.toContain("Trocar senha");
    expect(itemNames()).toContain("Meu perfil");
  });

  it("'Meu perfil' some sem UPDATE_OWN_PROFILE", async () => {
    await open(user({ capabilities: ["CHANGE_OWN_PASSWORD"] }));
    expect(itemNames()).not.toContain("Meu perfil");
  });

  it("nao compara e-mail: um REGULAR com e-mail demo@showcase.invalid e capacidades comuns ainda ve 'Trocar senha'", async () => {
    await open(user({ email: "demo@showcase.invalid", capabilities: ["CHANGE_OWN_PASSWORD", "UPDATE_OWN_PROFILE"] }));
    expect(itemNames()).toContain("Trocar senha");
  });
});
