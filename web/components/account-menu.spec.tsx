import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders } from "@/test/helpers/providers";
import type { CurrentUserDto } from "@/lib/api/types";

const nav = vi.hoisted(() => ({ pathname: "/entries" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));
const logout = vi.hoisted(() => ({ logoutAction: vi.fn() }));
vi.mock("@/app/(auth)/actions", () => logout);

import { AccountMenu } from "./account-menu";

const ANA: CurrentUserDto = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false };
const VAGNER: CurrentUserDto = { id: "u0", name: "Vagner", email: "vagner@exemplo.com", role: "ADMIN", mustChangePassword: false };
const CARLA: CurrentUserDto = { id: "u3", name: "Carla Dias", email: "carla@exemplo.com", role: "USER", mustChangePassword: true };

const tree = (user: CurrentUserDto) => (
  <AllProviders>
    <button>antes</button>
    <AccountMenu user={user} />
    <button>depois</button>
  </AllProviders>
);
const setup = (user: CurrentUserDto) => render(tree(user));
const avatar = (name: string) => screen.getByRole("button", { name: `Conta de ${name}` });
const itemNames = () => screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());

beforeEach(() => {
  nav.pathname = "/entries";
  logout.logoutAction.mockReset().mockResolvedValue(undefined);
});

describe("AccountMenu: botao (CA44, RF38, design 2.3)", () => {
  it("fechado: botao com inicial, nome acessivel, aria-haspopup=menu, aria-expanded=false; sem menu no DOM", () => {
    setup(ANA);
    const b = avatar("Ana Souza");
    expect(b).toHaveTextContent("A");
    expect(b).toHaveAttribute("aria-haspopup", "menu");
    expect(b).toHaveAttribute("aria-expanded", "false");
    expect(b).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("nao existe 'Entrar' para quem tem sessao", () => {
    setup(ANA);
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("CA45: nome com acento e espacos -> inicial maiuscula", () => {
    setup({ ...ANA, name: "  álvaro lima" });
    expect(screen.getByRole("button", { name: /Conta de/ })).toHaveTextContent("Á");
  });
});

describe("AccountMenu: itens por nivel (CA44, CA15, RF38)", () => {
  it("USER: cabecalho (nome, e-mail), Meu perfil, Trocar senha, Sair - sem Usuarios", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    expect(itemNames()).toEqual(["Meu perfil", "Trocar senha", "Sair"]);
    expect(screen.getByRole("menuitem", { name: "Meu perfil" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("menuitem", { name: "Trocar senha" })).toHaveAttribute("href", "/account/password");
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
  });

  it("ADMIN: tem Usuarios -> /admin/users, antes de Sair", async () => {
    setup(VAGNER);
    await userEvent.click(avatar("Vagner"));
    expect(itemNames()).toEqual(["Meu perfil", "Trocar senha", "Usuários", "Sair"]);
    expect(screen.getByRole("menuitem", { name: "Usuários" })).toHaveAttribute("href", "/admin/users");
  });

  it("modo restrito (troca obrigatoria): so o cabecalho e Sair (CA08)", async () => {
    setup(CARLA);
    await userEvent.click(avatar("Carla Dias"));
    expect(itemNames()).toEqual(["Sair"]);
    expect(screen.getByText("carla@exemplo.com")).toBeInTheDocument();
  });

  it("o cabecalho fica FORA do role=menu e o menu o descreve (DA4); itens em li role=none", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("aria-labelledby", avatar("Ana Souza").id);
    const header = document.getElementById(menu.getAttribute("aria-describedby") ?? "");
    expect(header).not.toBeNull();
    expect(menu.contains(header)).toBe(false);
    expect(header).toHaveTextContent("ana@exemplo.com");
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
  });

  it("o item da pagina atual leva aria-current=page", async () => {
    nav.pathname = "/account";
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    expect(screen.getByRole("menuitem", { name: "Meu perfil" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("menuitem", { name: "Trocar senha" })).not.toHaveAttribute("aria-current");
  });
});

describe("AccountMenu: teclado e foco (CA44, RF39, APG menu button)", () => {
  it("clique abre, aria-expanded=true, primeiro item focado", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    expect(avatar("Ana Souza")).toHaveAttribute("aria-expanded", "true");
    expect(avatar("Ana Souza")).toHaveAttribute("aria-controls");
    expect(screen.getByRole("menuitem", { name: "Meu perfil" })).toHaveFocus();
  });

  it.each(["{Enter}", " ", "{ArrowDown}"])("%j no botao abre e foca o primeiro item", async (key) => {
    setup(ANA);
    avatar("Ana Souza").focus();
    await userEvent.keyboard(key);
    expect(screen.getByRole("menuitem", { name: "Meu perfil" })).toHaveFocus();
  });

  it("ArrowUp no botao abre e foca o ultimo item (Sair)", async () => {
    setup(ANA);
    avatar("Ana Souza").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toHaveFocus();
  });

  it("setas movem com volta circular; Home e End vao aos extremos", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Trocar senha" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Meu perfil" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Meu perfil" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toHaveFocus();
  });

  it("type-ahead: 'T' foca Trocar senha", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.keyboard("t");
    expect(screen.getByRole("menuitem", { name: "Trocar senha" })).toHaveFocus();
  });

  it("Esc fecha e devolve o foco ao botao", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(avatar("Ana Souza")).toHaveFocus();
    expect(avatar("Ana Souza")).toHaveAttribute("aria-expanded", "false");
  });

  it("clicar de novo no botao fecha; foco fica no botao", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.click(avatar("Ana Souza"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(avatar("Ana Souza")).toHaveFocus();
  });

  it("clique fora fecha sem roubar o foco do alvo", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.click(screen.getByRole("button", { name: "depois" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "depois" })).toHaveFocus();
  });

  it("Tab fecha o menu (sem prender o foco; a ordem natural e conferida no Playwright)", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.tab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("mudar o pathname (navegar) fecha o menu", async () => {
    const { rerender } = setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    nav.pathname = "/account";
    rerender(tree(ANA));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("AccountMenu: Sair (RF02, RNF08, CA05)", () => {
  it("Sair e um botao submit dentro de um <form>, nunca um link GET", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    const sair = screen.getByRole("menuitem", { name: "Sair" });
    expect(sair.tagName).toBe("BUTTON");
    expect(sair).toHaveAttribute("type", "submit");
    expect(sair.closest("form")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("acionar Sair chama a logoutAction uma vez", async () => {
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sair" }));
    await waitFor(() => expect(logout.logoutAction).toHaveBeenCalledTimes(1));
  });

  it("modo restrito tambem sai", async () => {
    setup(CARLA);
    await userEvent.click(avatar("Carla Dias"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sair" }));
    await waitFor(() => expect(logout.logoutAction).toHaveBeenCalledTimes(1));
  });

  it("se a action nao responde (rede): o menu continua aberto e sai o toast de erro", async () => {
    logout.logoutAction.mockRejectedValue(new Error("network"));
    setup(ANA);
    await userEvent.click(avatar("Ana Souza"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sair" }));
    expect(await screen.findByText("Não foi possível sair. Verifique sua conexão e tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sair" })).not.toHaveAttribute("aria-busy", "true");
  });
});
