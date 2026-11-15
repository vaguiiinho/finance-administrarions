import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserDto } from "@/lib/api/types";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/cards", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));
vi.mock("@/app/(auth)/actions", () => ({ logoutAction: vi.fn() }));

import { AppHeader } from "./app-header";

const ANA: CurrentUserDto = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false, accountKind: "REGULAR", capabilities: ["CHANGE_OWN_PASSWORD", "MANAGE_EXPENSES", "UPDATE_OWN_PROFILE"] };
const CARLA: CurrentUserDto = { ...ANA, id: "u3", name: "Carla Dias", email: "carla@exemplo.com", mustChangePassword: true };

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

const renderHeader = async (props: Parameters<typeof AppHeader>[0]) => render(await AppHeader(props));
const banner = () => screen.getByRole("banner");

describe("AppHeader: navbar com marca, tema e conta (design 17.4, ADR 9.7)", () => {
  it("nao tem mais a navegacao principal (ela foi para o menu lateral/drawer)", async () => {
    await renderHeader({ user: ANA });
    expect(within(banner()).queryByRole("navigation", { name: /Principal/ })).not.toBeInTheDocument();
    expect(within(banner()).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("protegido com usuario: botao de menu, marca -> /entries, tema e avatar 'Conta de Ana Souza'", async () => {
    await renderHeader({ user: ANA });
    expect(within(banner()).getByRole("button", { name: "Abrir menu de navegação" })).toBeInTheDocument();
    expect(within(banner()).getByRole("link", { name: "Finanças" })).toHaveAttribute("href", "/entries");
    expect(within(banner()).getByRole("button", { name: "Tema escuro" })).toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: "Conta de Ana Souza" })).toBeInTheDocument();
    expect(within(banner()).queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    expect(within(banner()).queryByText("Demonstração")).not.toBeInTheDocument();
  });

  it("RF03: o cabecalho nunca mostra 'Entrar', selo 'Demonstração' nem marca apontando para /demo (usuario logado)", async () => {
    await renderHeader({ user: ANA });
    expect(within(banner()).queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    expect(within(banner()).queryByText("Demonstração")).not.toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: "Conta de Ana Souza" })).toBeInTheDocument();
    expect(within(banner()).queryByText(/Criar conta/)).not.toBeInTheDocument();
    for (const l of within(banner()).getAllByRole("link")) expect(l.getAttribute("href")).not.toMatch(/\/demo/);
  });

  it("conta demo (SHOWCASE) logada: avatar da conta e o mesmo cabecalho, sem selo de demonstracao", async () => {
    await renderHeader({ user: { ...ANA, id: "d2", name: "Conta de demonstração", email: "demo@showcase.invalid", accountKind: "SHOWCASE", capabilities: ["MANAGE_EXPENSES"] } });
    expect(within(banner()).getByRole("button", { name: "Conta de Conta de demonstração" })).toBeInTheDocument();
    expect(within(banner()).queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("modo restrito (troca obrigatoria): sem botao de menu, marca como texto (sem link), tema e avatar (DA11)", async () => {
    await renderHeader({ user: CARLA });
    expect(within(banner()).queryByRole("button", { name: "Abrir menu de navegação" })).not.toBeInTheDocument();
    expect(within(banner()).getByText("Finanças")).toBeInTheDocument();
    expect(within(banner()).queryByRole("link", { name: "Finanças" })).not.toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: "Tema escuro" })).toBeInTheDocument();
    expect(within(banner()).getByRole("button", { name: "Conta de Carla Dias" })).toBeInTheDocument();
  });

  it("shell de autenticacao (login): marca -> /, tema, sem menu, sem conta, sem Entrar", async () => {
    await renderHeader({ user: null, shell: "auth" });
    expect(within(banner()).getByRole("link", { name: "Finanças" })).toHaveAttribute("href", "/");
    expect(within(banner()).getByRole("button", { name: "Tema escuro" })).toBeInTheDocument();
    expect(within(banner()).queryByRole("button", { name: /menu de navegação/ })).not.toBeInTheDocument();
    expect(within(banner()).queryByRole("button", { name: /Conta de/ })).not.toBeInTheDocument();
    expect(within(banner()).queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("'Pular para o conteudo' continua o primeiro focavel e aponta para #conteudo", async () => {
    await renderHeader({ user: ANA });
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip).toHaveAttribute("href", "#conteudo");
    expect(document.body.querySelector("a, button")).toBe(skip);
  });

  it("a navbar tem uma unica linha: nenhuma segunda <nav> no mobile", async () => {
    const { container } = await renderHeader({ user: ANA });
    expect(container.querySelectorAll("nav")).toHaveLength(0);
  });
});
