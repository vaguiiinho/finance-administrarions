import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserDto } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), screenProps: [] as Record<string, unknown>[] }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/api/finance-reader", () => ({ createFinanceReader: () => ({}) }));
vi.mock("@/features/entries/redirect-to-initial-month", () => ({ redirectToInitialMonth: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/features/entries/entries-screen", () => ({
  EntriesScreen: (props: Record<string, unknown>) => {
    mocks.screenProps.push(props);
    return null;
  },
}));

import EntriesPage from "./page";

const user = (over: Record<string, unknown>): CurrentUserDto =>
  ({ id: "u1", name: "Bruno", email: "bruno@exemplo.com", role: "USER", mustChangePassword: false, accountKind: "REGULAR", capabilities: [], ...over }) as CurrentUserDto;

/** Renderiza a Server Component async e devolve o valor de `canManageExpenses` passado a EntriesScreen. */
async function canManage(u: CurrentUserDto | null): Promise<unknown> {
  mocks.getCurrentUser.mockResolvedValue(u);
  const element = (await EntriesPage({ searchParams: Promise.resolve({ month: "2026-11" }), params: Promise.resolve({}) } as never)) as { props: Record<string, unknown> };
  return element.props.canManageExpenses;
}

beforeEach(() => mocks.getCurrentUser.mockReset());

describe("/entries: Editar e Excluir para qualquer usuario com MANAGE_EXPENSES (B6, RF38, CA53)", () => {
  it("USER (Bruno) com MANAGE_EXPENSES -> canManageExpenses = true", async () => {
    expect(await canManage(user({ role: "USER", capabilities: ["CHANGE_OWN_PASSWORD", "MANAGE_EXPENSES", "UPDATE_OWN_PROFILE"] }))).toBe(true);
  });

  it("ADMIN com MANAGE_EXPENSES -> true", async () => {
    expect(await canManage(user({ role: "ADMIN", capabilities: ["MANAGE_EXPENSES", "MANAGE_USERS"] }))).toBe(true);
  });

  it("conta demo (SHOWCASE) com MANAGE_EXPENSES -> true", async () => {
    expect(await canManage(user({ accountKind: "SHOWCASE", email: "demo@showcase.invalid", capabilities: ["MANAGE_EXPENSES"] }))).toBe(true);
  });

  it("sem a capacidade -> false, inclusive para role ADMIN (decide por capacidades, nao por nivel)", async () => {
    expect(await canManage(user({ role: "ADMIN", capabilities: ["MANAGE_USERS"] }))).toBe(false);
  });

  it("me sem `capabilities` (API antiga / campo ausente) -> false, sem lancar", async () => {
    const legacy = user({});
    delete (legacy as unknown as Record<string, unknown>).capabilities;
    expect(await canManage(legacy)).toBe(false);
  });

  it("sem usuario (sessao ausente) -> false", async () => {
    expect(await canManage(null)).toBe(false);
  });
});
