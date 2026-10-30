import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { pressEscapeInDialog } from "@/test/helpers/dialog";
import type { ActionResult, AdminUserDto } from "@/lib/api/types";
import { ANA, BRUNO, CARLA, VAGNER, adminUser } from "./test-support";

const actions = vi.hoisted(() => ({ createUserAction: vi.fn(), updateUserAction: vi.fn(), deactivateUserAction: vi.fn(), reactivateUserAction: vi.fn(), resetUserPasswordAction: vi.fn() }));
vi.mock("@/app/(protected)/admin/users/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/admin/users" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { UsersList } from "./users-list";

const USERS = [VAGNER, ANA, CARLA, BRUNO];
const setup = (users: AdminUserDto[] = USERS, currentUserId = VAGNER.id) => render(<AllProviders><UsersList users={users} currentUserId={currentUserId} /></AllProviders>);
// A lista renderiza tabela (>= md) e itens (< md) no mesmo DOM; os testes usam a tabela, como em ExpensesList.
const table = () => within(screen.getByRole("table", { hidden: true }));
const rowOf = (name: string) => within(table().getByRole("row", { name: new RegExp(name), hidden: true }));
const ok = (user: AdminUserDto): ActionResult<AdminUserDto> => ({ ok: true, data: user });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ActionResult<never> => ({ ok: false, error: { status, code, message: code, ...extra } });

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  router.refresh.mockReset();
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("UsersList: estrutura (RF11, RF44, DA14, CA25)", () => {
  it("resumo '4 usuarios · 1 inativo', nota sobre dados financeiros e 'Novo usuario'", () => {
    setup();
    expect(screen.getByText("4 usuários · 1 inativo")).toBeInTheDocument();
    expect(screen.getByText("Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo usuário" })).toBeInTheDocument();
  });

  it("dois grupos com titulo visivel: 'Ativos (3)' antes de 'Inativos (1)'; ordem da API preservada em cada um", () => {
    setup();
    const headers = within(screen.getByRole("table", { hidden: true })).getAllByRole("rowheader", { hidden: true }).map((h) => h.textContent);
    expect(headers).toEqual(["Ativos (3)", "Inativos (1)"]);
    const names = table().getAllByRole("row", { hidden: true }).map((r) => r.textContent ?? "");
    const idx = (n: string) => names.findIndex((t) => t.includes(n));
    expect(idx("Vagner")).toBeLessThan(idx("Ana Souza"));
    expect(idx("Carla Dias")).toBeLessThan(idx("Bruno Lima"));
  });

  it("cada linha mostra nome, e-mail, nivel, situacao, senha e 'Criado em' dd/mm/aaaa em Sao Paulo (UTC 02:30 vira o dia anterior)", () => {
    setup();
    const ana = rowOf("Ana Souza");
    for (const t of ["ana@exemplo.com", "Usuário comum", "Ativo", "Troca de senha pendente", "29/10/2026"]) expect(ana.getByText(new RegExp(t))).toBeInTheDocument();
    expect(rowOf("Vagner").getByText("Administrador")).toBeInTheDocument();
    expect(rowOf("Vagner").getByText("Em dia")).toBeInTheDocument();
    expect(rowOf("Carla Dias").getByText(/29\/10\/2026/)).toBeInTheDocument();
    expect(rowOf("Bruno Lima").getByText("Inativo")).toBeInTheDocument();
  });

  it("nao mostra nenhum dado financeiro (CA25)", () => {
    setup();
    expect(document.body.textContent).not.toMatch(/R\$|lançamento|cartão|fatura/i);
  });

  it("apenas o proprio administrador: EmptyState 'Voce e o unico usuario.'", () => {
    setup([VAGNER]);
    expect(screen.getByText("Você é o único usuário.")).toBeInTheDocument();
    expect(screen.getByText(/Novo usuário/, { selector: "p, div" })).toBeInTheDocument();
  });
});

describe("UsersList: acoes por linha (RF44, DA15, CA23, DA16)", () => {
  it("linha do proprio administrador: '(voce)' e SO 'Editar' (sem Redefinir senha, sem Inativar)", () => {
    setup();
    const v = rowOf("Vagner");
    expect(v.getByText("(você)")).toBeInTheDocument();
    expect(v.getByRole("button", { name: "Editar Vagner", hidden: true })).toBeInTheDocument();
    expect(v.queryByRole("button", { name: /Redefinir senha/, hidden: true })).not.toBeInTheDocument();
    expect(v.queryByRole("button", { name: /Inativar/, hidden: true })).not.toBeInTheDocument();
  });

  it("usuario ativo: Editar, Redefinir senha e Inativar com o nome da pessoa no nome acessivel (comecando pelo texto visivel)", () => {
    setup();
    const a = rowOf("Ana Souza");
    expect(a.getByRole("button", { name: "Editar Ana Souza", hidden: true })).toBeInTheDocument();
    expect(a.getByRole("button", { name: "Redefinir senha Ana Souza", hidden: true })).toBeInTheDocument();
    expect(a.getByRole("button", { name: "Inativar Ana Souza", hidden: true })).toBeInTheDocument();
    expect(a.queryByRole("button", { name: /Reativar/, hidden: true })).not.toBeInTheDocument();
  });

  it("usuario inativo: Editar, Redefinir senha e Reativar (sem Inativar)", () => {
    setup();
    const b = rowOf("Bruno Lima");
    expect(b.getByRole("button", { name: "Reativar Bruno Lima", hidden: true })).toBeInTheDocument();
    expect(b.getByRole("button", { name: "Redefinir senha Bruno Lima", hidden: true })).toBeInTheDocument();
    expect(b.queryByRole("button", { name: /Inativar/, hidden: true })).not.toBeInTheDocument();
  });

  it("o ultimo administrador ativo NAO tem tratamento especial (DA16): se for outra pessoa, Inativar aparece", () => {
    setup([VAGNER, adminUser({ id: "0192f1e2-0000-7000-8000-0000000000b1", name: "Ana Admin", role: "ADMIN" })]);
    expect(rowOf("Ana Admin").getByRole("button", { name: "Inativar Ana Admin", hidden: true })).toBeInTheDocument();
  });
});

describe("UsersList: Inativar (RF14, CA20, CA24)", () => {
  const open = async () => {
    setup();
    await userEvent.click(rowOf("Ana Souza").getByRole("button", { name: "Inativar Ana Souza", hidden: true }));
    return screen.getByRole("alertdialog");
  };

  it("dialogo com consequencias, foco em Cancelar e SEM 'Esta acao nao pode ser desfeita.' (e reversivel)", async () => {
    const dialog = await open();
    expect(within(dialog).getByRole("heading", { name: "Inativar Ana Souza?" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Ana Souza não conseguirá mais entrar, e todas as sessões abertas serão encerradas agora. Os dados financeiros são mantidos. Você pode reativar a conta depois.");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(within(dialog).queryByText("Esta ação não pode ser desfeita.")).not.toBeInTheDocument();
  });

  it("Cancelar nao chama a API", async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.deactivateUserAction).not.toHaveBeenCalled();
  });

  it("confirmar: chama a action com o id, fecha, toast 'Ana Souza foi inativado.' e recarrega a lista", async () => {
    actions.deactivateUserAction.mockResolvedValue(ok({ ...ANA, status: "INACTIVE" }));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    await waitFor(() => expect(actions.deactivateUserAction).toHaveBeenCalledWith(ANA.id));
    expect(await screen.findByText("Ana Souza foi inativado.")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("carregando: 'Inativando…' e uma so chamada", async () => {
    actions.deactivateUserAction.mockReturnValue(new Promise(() => {}));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    const busy = await within(dialog).findByRole("button", { name: "Inativando…" });
    await userEvent.click(busy);
    expect(actions.deactivateUserAction).toHaveBeenCalledTimes(1);
  });

  it("CA24: LAST_ADMIN -> dialogo continua aberto com a mensagem e o botao sai do carregando", async () => {
    actions.deactivateUserAction.mockResolvedValue(fail(422, "LAST_ADMIN"));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    expect(await within(dialog).findByText("É preciso manter pelo menos um administrador ativo.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Inativar" })).not.toHaveAttribute("aria-busy", "true");
  });

  it("CANNOT_TARGET_SELF (corrida): mensagem do design no dialogo", async () => {
    actions.deactivateUserAction.mockResolvedValue(fail(422, "CANNOT_TARGET_SELF"));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    expect(await within(dialog).findByText("Você não pode executar esta ação na sua própria conta.")).toBeInTheDocument();
  });

  it("USER_NOT_FOUND: fecha, toast 'Usuario nao encontrado. A lista foi atualizada.' e recarrega", async () => {
    actions.deactivateUserAction.mockResolvedValue(fail(404, "USER_NOT_FOUND"));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    expect(await screen.findByText("Usuário não encontrado. A lista foi atualizada.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("FORBIDDEN (rebaixado com a tela aberta): toast 'Voce nao tem permissao para esta acao.' e refresh (a pagina vira not-found)", async () => {
    actions.deactivateUserAction.mockResolvedValue(fail(403, "FORBIDDEN"));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    expect(await screen.findByText("Você não tem permissão para esta ação.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("sessao expirada: alerta inline no dialogo e vai ao login depois de 1,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    actions.deactivateUserAction.mockResolvedValue(fail(401, "SESSION_EXPIRED", { message: "Sua sessão expirou. Entre novamente.", redirectUrl: "/login?next=%2Fadmin%2Fusers&reason=expired" }));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Inativar" }));
    expect(await within(dialog).findByText("Sua sessão expirou. Entre novamente.")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1600));
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fusers&reason=expired");
  });
});

describe("UsersList: Reativar (RF15, CA21)", () => {
  const reactivate = () => rowOf("Bruno Lima").getByRole("button", { name: "Reativar Bruno Lima", hidden: true });

  it("direto, SEM dialogo de confirmacao; toast 'Bruno Lima foi reativado.' e recarga", async () => {
    actions.reactivateUserAction.mockResolvedValue(ok({ ...BRUNO, status: "ACTIVE" }));
    setup();
    await userEvent.click(reactivate());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(actions.reactivateUserAction).toHaveBeenCalledWith(BRUNO.id));
    expect(await screen.findByText("Bruno Lima foi reativado.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("carregando: 'Reativando…' com aria-busy e os outros botoes da linha ficam inertes", async () => {
    actions.reactivateUserAction.mockReturnValue(new Promise(() => {}));
    setup();
    await userEvent.click(reactivate());
    const busy = await rowOf("Bruno Lima").findByRole("button", { name: /Reativando/, hidden: true });
    expect(busy).toHaveAttribute("aria-busy", "true");
    const edit = rowOf("Bruno Lima").getByRole("button", { name: "Editar Bruno Lima", hidden: true });
    expect(edit.hasAttribute("disabled") || edit.getAttribute("aria-disabled") === "true" || edit.closest("[inert]") !== null).toBe(true);
  });

  it("erro: toast com a mensagem da API e a linha nao muda", async () => {
    actions.reactivateUserAction.mockResolvedValue(fail(500, "INTERNAL_ERROR", { message: "Erro inesperado." }));
    setup();
    await userEvent.click(reactivate());
    expect(await screen.findByText("Erro inesperado.")).toBeInTheDocument();
    expect(reactivate()).toBeInTheDocument();
  });
});

describe("UsersList: gatilhos abrem drawer e dialogo (DA13)", () => {
  it("'Novo usuario' abre o drawer de criacao; Esc fecha (foco de volta ao gatilho: Playwright)", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    expect(screen.getByRole("dialog", { name: "Novo usuário" })).toBeInTheDocument();
    pressEscapeInDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'Editar' abre o drawer 'Editar <nome>' com os valores da lista (sem GET extra)", async () => {
    setup();
    await userEvent.click(rowOf("Ana Souza").getByRole("button", { name: "Editar Ana Souza", hidden: true }));
    const drawer = screen.getByRole("dialog", { name: "Editar Ana Souza" });
    expect((within(drawer).getByLabelText("Nome") as HTMLInputElement).value).toBe("Ana Souza");
    expect((within(drawer).getByLabelText("E-mail") as HTMLInputElement).value).toBe("ana@exemplo.com");
  });

  it("'Redefinir senha' abre o modal de formulario", async () => {
    setup();
    await userEvent.click(rowOf("Ana Souza").getByRole("button", { name: "Redefinir senha Ana Souza", hidden: true }));
    expect(screen.getByRole("dialog", { name: "Redefinir senha de Ana Souza" })).toBeInTheDocument();
  });
});
