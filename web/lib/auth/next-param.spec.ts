import { describe, expect, it } from "vitest";
import { loginUrl, nextLabel, safeNext } from "./next-param";

describe("safeNext (RF35, CA02, ADR 9.5)", () => {
  it.each([
    ["/entries", "/entries"],
    ["/dashboard", "/dashboard"],
    ["/cards", "/cards"],
    ["/account", "/account"],
    ["/account/password", "/account/password"],
    ["/admin/users", "/admin/users"],
    ["/cards?x=1", "/cards?x=1"],
    ["/dashboard?month=2026-10", "/dashboard?month=2026-10"],
    ["/entries/qualquer-coisa", "/entries/qualquer-coisa"],
    ["/admin/users/abc", "/admin/users/abc"],
  ])("aceita a rota protegida %s", (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    ["//evil.com", "protocolo relativo"],
    ["https://evil.com", "URL absoluta"],
    ["http://evil.com/cards", "URL absoluta com rota valida"],
    ["/\\evil.com", "barra invertida"],
    ["\\\\evil.com", "barra invertida dupla"],
    ["javascript:alert(1)", "esquema javascript"],
    ["/demo/entries", "rota publica (CA02)"],
    ["/login", "rota publica"],
    ["/register", "rota inexistente"],
    ["/entriesx", "prefixo sem fronteira"],
    ["/accountant", "prefixo sem fronteira"],
    ["/admin", "admin sem /users"],
    ["/admin/other", "admin fora da lista"],
    ["entries", "sem barra inicial"],
    ["", "vazio"],
    ["/%2F/evil.com", "barra codificada depois do decode"],
    ["/%5Cevil.com", "barra invertida codificada"],
    ["/entries\r\nLocation: x", "caractere de controle"],
    ["/entries%0d%0aSet-Cookie:x", "caractere de controle codificado"],
    ["/entries\u0000", "NUL"],
    [" /entries", "espaco inicial"],
  ])("rejeita %j (%s) e devolve /entries", (raw) => {
    expect(safeNext(raw)).toBe("/entries");
  });

  it("null e undefined viram /entries", () => {
    expect(safeNext(null)).toBe("/entries");
    expect(safeNext(undefined)).toBe("/entries");
  });

  it("nunca devolve valor diferente de caminho interno (propriedade)", () => {
    for (const raw of ["//a", "/\\a", "http://a", "/entries", "/cards?x=//a", "/zzz"]) {
      expect(safeNext(raw)).toMatch(/^\/(entries|dashboard|cards|account|admin\/users)/);
      expect(safeNext(raw).startsWith("//")).toBe(false);
    }
  });
});

describe("loginUrl (CA06, CA40)", () => {
  it("codifica o caminho com query em next", () => {
    expect(loginUrl("/dashboard?month=2026-10")).toBe("/login?next=%2Fdashboard%3Fmonth%3D2026-10");
  });
  it("reason=expired vem depois do next", () => {
    expect(loginUrl("/dashboard?month=2026-10", { reason: "expired" })).toBe("/login?next=%2Fdashboard%3Fmonth%3D2026-10&reason=expired");
  });
  it("caminho simples", () => {
    expect(loginUrl("/cards")).toBe("/login?next=%2Fcards");
  });
});

describe("nextLabel (design 3.3)", () => {
  it.each([
    ["/entries", "Lançamentos"],
    ["/dashboard?month=2026-10", "Dashboard"],
    ["/cards", "Cartões"],
    ["/account", "Meu perfil"],
    ["/account/password", "Trocar senha"],
    ["/admin/users", "Usuários"],
  ])("%s -> %s", (raw, label) => {
    expect(nextLabel(raw)).toBe(label);
  });
  it("next ausente ou inseguro nao gera contexto", () => {
    expect(nextLabel(undefined)).toBeNull();
    expect(nextLabel("//evil.com")).toBeNull();
    expect(nextLabel("/demo/entries")).toBeNull();
  });
});
