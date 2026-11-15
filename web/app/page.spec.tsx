import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readSessionToken: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => ({ readSessionToken: mocks.readSessionToken }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    mocks.redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

import Home from "./page";

/** Fallback de `/` (RF06, CA06, CA07): a decisao real e do proxy.ts; aqui so se o proxy nao rodou. */
beforeEach(() => {
  mocks.readSessionToken.mockReset();
  mocks.redirect.mockReset();
});

describe("app/page.tsx: raiz sem o modo demonstracao", () => {
  it("CA06: sem cookie de sessao -> /login (nunca /demo/entries)", async () => {
    mocks.readSessionToken.mockResolvedValue(undefined);
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("CA06: token vazio/nulo tambem conta como sem sessao", async () => {
    mocks.readSessionToken.mockResolvedValue(null);
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT /login");
    mocks.readSessionToken.mockResolvedValue("");
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("CA07: com cookie de sessao -> /entries", async () => {
    mocks.readSessionToken.mockResolvedValue("tok-1");
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT /entries");
    expect(mocks.redirect).toHaveBeenCalledWith("/entries");
  });

  it("nenhum caminho redireciona para /demo", async () => {
    for (const token of [undefined, null, "", "tok"]) {
      mocks.readSessionToken.mockResolvedValue(token);
      await Home().catch(() => undefined);
    }
    for (const [to] of mocks.redirect.mock.calls) expect(to).not.toMatch(/demo/);
  });
});
