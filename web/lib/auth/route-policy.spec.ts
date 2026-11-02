import { describe, expect, it } from "vitest";
import type { CurrentUserDto } from "@/lib/api/types";
import { decideAdminLayout, decideProtectedLayout, decideRoute } from "./route-policy";

const user = (over: Partial<CurrentUserDto> = {}): CurrentUserDto => ({ id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false, accountKind: "REGULAR", capabilities: ["CHANGE_OWN_PASSWORD", "MANAGE_EXPENSES", "UPDATE_OWN_PROFILE"], ...over });

describe("decideRoute: visitante sem cookie (CA40, RF34)", () => {
  it.each([
    ["/entries", "", "/login?next=%2Fentries"],
    ["/dashboard", "?month=2026-10", "/login?next=%2Fdashboard%3Fmonth%3D2026-10"],
    ["/cards", "", "/login?next=%2Fcards"],
    ["/account", "", "/login?next=%2Faccount"],
    ["/account/password", "", "/login?next=%2Faccount%2Fpassword"],
    ["/admin/users", "", "/login?next=%2Fadmin%2Fusers"],
    ["/entries/qualquer", "?a=1", "/login?next=%2Fentries%2Fqualquer%3Fa%3D1"],
  ])("%s%s -> login com next", (pathname, search, to) => {
    expect(decideRoute(pathname, search, false)).toEqual({ kind: "redirect", to });
  });

  it("login sem reason: o redirect do proxy NAO diz que a sessao expirou", () => {
    const d = decideRoute("/cards", "", false);
    expect(d.kind === "redirect" && d.to).not.toContain("reason");
  });
});

describe("decideRoute: rotas publicas e desconhecidas passam (CA07, CA38)", () => {
  it.each(["/demo/entries", "/demo/dashboard", "/demo/cards", "/login", "/register", "/qualquer-coisa", "/entriesx", "/accountant"])("%s sem cookie segue", (pathname) => {
    expect(decideRoute(pathname, "", false).kind).not.toBe("redirect");
  });

  it("/register nunca vai para o login nem para outra rota: o not-found global responde (CA07)", () => {
    expect(decideRoute("/register", "", false)).toEqual({ kind: "next" });
    expect(decideRoute("/register", "", true)).toEqual({ kind: "next" });
  });

  it("rotas protegidas COM cookie seguem (nivel e troca obrigatoria sao do layout/API)", () => {
    for (const p of ["/entries", "/dashboard", "/cards", "/account", "/account/password", "/admin/users"]) {
      expect(decideRoute(p, "", true)).toEqual({ kind: "next" });
    }
  });

  it("demo com cookie tambem segue (RF36)", () => {
    expect(decideRoute("/demo/entries", "", true)).toEqual({ kind: "next" });
  });
});

describe("decideRoute: raiz (CA41)", () => {
  it("visitante -> /demo/entries", () => expect(decideRoute("/", "", false)).toEqual({ kind: "redirect", to: "/demo/entries" }));
  it("logado -> /entries", () => expect(decideRoute("/", "", true)).toEqual({ kind: "redirect", to: "/entries" }));
});

describe("decideRoute: /login com cookie (RF05, CA07, CA08)", () => {
  it("sem resposta do /auth/me ainda: pede validacao da sessao", () => {
    expect(decideRoute("/login", "?next=%2Fcards", true)).toEqual({ kind: "validate-session" });
  });
  it("sessao valida -> /entries", () => {
    expect(decideRoute("/login", "", true, "valid")).toEqual({ kind: "redirect", to: "/entries" });
  });
  it("sessao valida com troca obrigatoria -> /account/password", () => {
    const d = decideRoute("/login", "", true, "must-change-password");
    expect(d.kind).toBe("redirect");
    expect(d.kind === "redirect" && new URL(d.to, "http://x").pathname).toBe("/account/password");
  });
  it("sessao invalida: segue para o login (o proxy apaga o cookie)", () => {
    expect(decideRoute("/login", "", true, "invalid")).toEqual({ kind: "next" });
  });
  it("sem cookie o login abre", () => {
    expect(decideRoute("/login", "?next=%2Fcards", false)).toEqual({ kind: "next" });
  });
});

describe("decideProtectedLayout (ADR 9.4, RF07, CA08)", () => {
  it("sem usuario -> login com o caminho atual em next", () => {
    const d = decideProtectedLayout(null, "/dashboard?month=2026-10");
    expect(d.kind).toBe("redirect");
    if (d.kind !== "redirect") return;
    const u = new URL(d.to, "http://x");
    expect(u.pathname).toBe("/login");
    expect(u.searchParams.get("next")).toBe("/dashboard?month=2026-10");
  });
  it("usuario normal passa", () => {
    expect(decideProtectedLayout(user(), "/cards")).toEqual({ kind: "allow" });
  });
  it("troca obrigatoria em outra rota -> /account/password?next=<url atual>", () => {
    const d = decideProtectedLayout(user({ mustChangePassword: true }), "/cards?x=1");
    expect(d.kind).toBe("redirect");
    if (d.kind !== "redirect") return;
    const u = new URL(d.to, "http://x");
    expect(u.pathname).toBe("/account/password");
    expect(u.searchParams.get("next")).toBe("/cards?x=1");
  });
  it("troca obrigatoria em /account/password passa (unica pagina liberada)", () => {
    expect(decideProtectedLayout(user({ mustChangePassword: true }), "/account/password?next=%2Fcards")).toEqual({ kind: "allow" });
  });
  it("troca obrigatoria em /account (prefixo) NAO passa", () => {
    expect(decideProtectedLayout(user({ mustChangePassword: true }), "/account").kind).toBe("redirect");
  });
});

describe("decideAdminLayout (RF10, CA15)", () => {
  it("ADMIN passa", () => expect(decideAdminLayout(user({ role: "ADMIN" }))).toEqual({ kind: "allow" }));
  it("USER -> notFound", () => expect(decideAdminLayout(user())).toEqual({ kind: "notFound" }));
  it("sem usuario -> notFound (o layout pai ja redireciona)", () => expect(decideAdminLayout(null).kind).not.toBe("allow"));
});
