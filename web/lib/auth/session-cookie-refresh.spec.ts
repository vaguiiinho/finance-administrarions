import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => store }));

import { clearSessionCookie } from "./session-cookie";

beforeEach(() => Object.values(store).forEach((f) => f.mockReset()));

describe("clearSessionCookie({ refresh: false }) (401 numa Server Action)", () => {
  it("nao altera cookies: mexer neles dentro de uma action re-renderiza a tela e o layout redirecionaria antes do aviso", async () => {
    await clearSessionCookie({ refresh: false });
    expect(store.delete).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });
  it("sem opcao (logout) apaga o cookie com Path=/ e os mesmos atributos da gravacao", async () => {
    await clearSessionCookie();
    expect(store.delete).toHaveBeenCalledWith(expect.objectContaining({ name: "fa_session", path: "/", httpOnly: true, sameSite: "lax" }));
  });
});
