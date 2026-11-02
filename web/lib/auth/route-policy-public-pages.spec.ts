import { describe, expect, it } from "vitest";
import { decideRoute } from "./route-policy";

// ADR 0011 9: /privacy e /support sao publicas (a App Store as abre sem login) e nao estao em PROTECTED_PREFIXES.
describe("decideRoute: paginas publicas da loja (T-W1)", () => {
  it.each(["/privacy", "/support"])("%s sem cookie segue (nao vai para o login)", (pathname) => {
    expect(decideRoute(pathname, "", false)).toEqual({ kind: "next" });
  });

  it.each(["/privacy", "/support"])("%s com cookie tambem segue", (pathname) => {
    expect(decideRoute(pathname, "", true)).toEqual({ kind: "next" });
  });

  it("nao cria brecha: rotas protegidas continuam indo para o login sem cookie", () => {
    expect(decideRoute("/entries", "", false)).toMatchObject({ kind: "redirect" });
    expect(decideRoute("/privacyx/../entries", "", false).kind).toBeDefined();
  });
});
