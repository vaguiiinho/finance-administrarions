// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { STUB_ADMIN_LIST_ORDER, STUB_USERS, type StubUser } from "../stub-users";

/**
 * Contrato do stub de e2e com auth/demo/admin (ADR 0005 9.8, T11, D10). Sobe `server.mjs` numa porta propria e fala HTTP.
 * Toda regra aqui espelha a API real (ADR 6.2-6.5); se a API mudar, este spec e o stub mudam juntos.
 */
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;

beforeAll(async () => {
  server = spawn("node", [resolve(__dirname, "server.mjs")], { env: { ...process.env, STUB_API_PORT: String(PORT) }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error("stub nao subiu")), 10_000);
    server.stdout?.on("data", (d: Buffer) => {
      if (String(d).includes("stub-api em")) {
        clearTimeout(t);
        ok();
      }
    });
    server.on("exit", () => bad(new Error("stub terminou")));
  });
});
afterAll(() => void server?.kill());
beforeEach(async () => void (await call("POST", "/__scenario", { body: { name: "default" } })));

interface Reply {
  status: number;
  headers: Headers;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<Reply> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(opts.body !== undefined ? { "content-type": "application/json" } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}
const login = async (u: StubUser, password = u.password) => call("POST", "/api/auth/login", { body: { email: u.email, password } });
const tokenOf = async (u: StubUser) => (await login(u)).json.session.token as string;
const { vagner, ana, carla, bruno } = STUB_USERS;

describe("A1 login", () => {
  it("200 { user, session: { token 'stub-<id>', expiresAt ~24 h } } sem expor senha/hash", async () => {
    const r = await login(ana);
    expect(r.status).toBe(200);
    expect(r.json.user).toEqual({ id: expect.any(String), name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false });
    expect(r.json.session.token).toBe(`stub-${r.json.user.id}`);
    const ms = Date.parse(r.json.session.expiresAt) - Date.now();
    expect(ms).toBeGreaterThan(23 * 3600_000);
    expect(ms).toBeLessThanOrEqual(24 * 3600_000 + 5_000);
    expect(JSON.stringify(r.json)).not.toMatch(/segredo123|passwordHash/);
  });

  it("e-mail normalizado: ' ANA@Exemplo.com ' entra", async () => {
    expect((await call("POST", "/api/auth/login", { body: { email: " ANA@Exemplo.com ", password: ana.password } })).status).toBe(200);
  });

  it("CA03: senha errada, e-mail inexistente e usuario inativo respondem 401 IGUAIS (sem enumeracao)", async () => {
    const replies = [await login(ana, "errada"), await call("POST", "/api/auth/login", { body: { email: "naoexiste@exemplo.com", password: "x" } }), await login(bruno)];
    for (const r of replies) expect(r.status).toBe(401);
    expect(replies[0].json).toEqual(replies[1].json);
    expect(replies[1].json).toEqual(replies[2].json);
    expect(replies[0].json.code).toBe("INVALID_CREDENTIALS");
  });

  it("carla entra com mustChangePassword=true", async () => {
    expect((await login(carla)).json.user.mustChangePassword).toBe(true);
  });

  it("400 VALIDATION_ERROR (REQUIRED) sem e-mail/senha", async () => {
    const r = await call("POST", "/api/auth/login", { body: {} });
    expect(r.status).toBe(400);
    expect(r.json.details.fields.map((f: { field: string; code: string }) => `${f.field}:${f.code}`)).toEqual(["email:REQUIRED", "password:REQUIRED"]);
  });

  it("nao existe cadastro: POST /api/auth/register -> 404 ROUTE_NOT_FOUND (CA07)", async () => {
    const r = await call("POST", "/api/auth/register", { body: { name: "x", email: "x@y.z", password: "12345678" } });
    expect([r.status, r.json.code]).toEqual([404, "ROUTE_NOT_FOUND"]);
  });
});

describe("A2/A3 me e logout", () => {
  it("me exige Bearer; 401 UNAUTHENTICATED sem token ou com token desconhecido", async () => {
    expect((await call("GET", "/api/auth/me")).status).toBe(401);
    const r = await call("GET", "/api/auth/me", { token: "stub-inexistente" });
    expect([r.status, r.json.code]).toEqual([401, "UNAUTHENTICATED"]);
  });
  it("me devolve o CurrentUserDto; liberado na troca obrigatoria (carla)", async () => {
    const r = await call("GET", "/api/auth/me", { token: await tokenOf(carla) });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ email: "carla@exemplo.com", role: "USER", mustChangePassword: true });
  });
  it("logout 204 e a sessao deixa de valer (CA05); logout sem token e idempotente (204)", async () => {
    const token = await tokenOf(ana);
    expect((await call("POST", "/api/auth/logout", { token })).status).toBe(204);
    expect((await call("GET", "/api/auth/me", { token })).status).toBe(401);
    expect((await call("POST", "/api/auth/logout")).status).toBe(204);
  });
  it("novo login depois do logout volta a valer", async () => {
    const token = await tokenOf(ana);
    await call("POST", "/api/auth/logout", { token });
    expect((await call("GET", "/api/auth/me", { token: await tokenOf(ana) })).status).toBe(200);
  });
});

describe("rotas existentes com Bearer (RF22-RF27, CA27, CA08)", () => {
  const protectedGets = ["/api/summary?month=2026-11", "/api/cards", "/api/categories", "/api/invoices?month=2026-11", "/api/entries/expenses?month=2026-11", "/api/entries/incomes?month=2026-11", "/api/dashboard/monthly-series?month=2026-11", "/api/dashboard/category-distribution?month=2026-11"];

  it.each(protectedGets)("%s sem Bearer -> 401 UNAUTHENTICATED", async (path) => {
    const r = await call("GET", path);
    expect([r.status, r.json.code]).toEqual([401, "UNAUTHENTICATED"]);
  });
  it.each(protectedGets)("%s com Bearer valido -> 200", async (path) => {
    expect((await call("GET", path, { token: await tokenOf(ana) })).status).toBe(200);
  });
  it("escritas sem Bearer -> 401 e nada e criado", async () => {
    expect((await call("POST", "/api/cards", { body: { name: "X", closingDay: 1, dueDay: 2 } })).status).toBe(401);
    const cards = await call("GET", "/api/cards", { token: await tokenOf(ana) });
    expect(cards.json.items.map((c: { name: string }) => c.name)).not.toContain("X");
  });
  it("CA08: troca obrigatoria -> 403 PASSWORD_CHANGE_REQUIRED em /api/summary, ate com query invalida; me e logout funcionam", async () => {
    const token = await tokenOf(carla);
    for (const path of ["/api/summary?month=2026-11", "/api/summary?month=lixo", "/api/cards"]) {
      const r = await call("GET", path, { token });
      expect([r.status, r.json.code]).toEqual([403, "PASSWORD_CHANGE_REQUIRED"]);
    }
    expect((await call("GET", "/api/auth/me", { token })).status).toBe(200);
    expect((await call("POST", "/api/auth/logout", { token })).status).toBe(204);
  });
  it("401 antes de 403 antes de 400: sem token + query invalida -> 401", async () => {
    expect((await call("GET", "/api/summary?month=lixo")).status).toBe(401);
  });
});

describe("A4 trocar senha (CA09, CA10)", () => {
  const change = (token: string, currentPassword: string, newPassword: string) => call("PUT", "/api/account/password", { token, body: { currentPassword, newPassword } });
  const codes = (r: Reply) => r.json.details.fields.map((f: { field: string; code: string }) => `${f.field}:${f.code}`);

  it("CA09: sucesso devolve CurrentUserDto sem troca pendente; a sessao atual continua; login com a nova senha", async () => {
    const token = await tokenOf(carla);
    const r = await change(token, "Temp1234", "MinhaSenha9");
    expect(r.status).toBe(200);
    expect(r.json.mustChangePassword).toBe(false);
    expect((await call("GET", "/api/summary?month=2026-11", { token })).status).toBe(200);
    expect((await login(carla, "Temp1234")).status).toBe(401);
    const again = await login(carla, "MinhaSenha9");
    expect([again.status, again.json.user.mustChangePassword]).toEqual([200, false]);
  });
  it("CA10: INCORRECT, SAME_AS_CURRENT, TOO_SHORT", async () => {
    const token = await tokenOf(ana);
    expect(codes(await change(token, "errada", "MinhaSenha9"))).toEqual(["currentPassword:INCORRECT"]);
    expect(codes(await change(token, ana.password, ana.password))).toEqual(["newPassword:SAME_AS_CURRENT"]);
    expect(codes(await change(token, ana.password, "1234567"))).toEqual(["newPassword:TOO_SHORT"]);
    expect(codes(await change(token, ana.password, "x".repeat(73)))).toEqual(["newPassword:TOO_LONG"]);
  });
  it("sem Bearer -> 401", async () => {
    expect((await call("PUT", "/api/account/password", { body: { currentPassword: "a", newPassword: "b" } })).status).toBe(401);
  });
});

describe("A5 perfil (CA11)", () => {
  it("normaliza o nome ('  ana   lima ' -> 'ana lima') e devolve o CurrentUserDto", async () => {
    const r = await call("PUT", "/api/account/profile", { token: await tokenOf(ana), body: { name: "  ana   lima " } });
    expect([r.status, r.json.name]).toEqual([200, "ana lima"]);
  });
  it("email/role no corpo -> 400 UNKNOWN_FIELD e nada muda", async () => {
    const token = await tokenOf(ana);
    const r = await call("PUT", "/api/account/profile", { token, body: { name: "Ana", email: "x@y.z", role: "ADMIN" } });
    expect(r.status).toBe(400);
    expect(r.json.details.fields.map((f: { field: string; code: string }) => `${f.field}:${f.code}`).sort()).toEqual(["email:UNKNOWN_FIELD", "role:UNKNOWN_FIELD"]);
    expect((await call("GET", "/api/auth/me", { token })).json).toMatchObject({ name: "Ana Souza", role: "USER" });
  });
  it("nome vazio -> name:REQUIRED", async () => {
    const r = await call("PUT", "/api/account/profile", { token: await tokenOf(ana), body: { name: "   " } });
    expect(r.json.details.fields[0]).toMatchObject({ field: "name", code: "REQUIRED" });
  });
});

describe("U1-U7 gestao de usuarios (RF10-RF19)", () => {
  const admin = () => tokenOf(vagner);
  const list = async (token: string) => (await call("GET", "/api/admin/users", { token })).json.items as { id: string; name: string; email: string; role: string; status: string; mustChangePassword: boolean }[];
  const idOf = async (u: StubUser) => (await list(await admin())).find((x) => x.email === u.email)!.id;

  it("CA15: USER -> 403 FORBIDDEN (inclusive com corpo invalido, nunca 400); sem token 401; troca pendente 403 PCR", async () => {
    const token = await tokenOf(ana);
    expect((await call("GET", "/api/admin/users", { token })).json.code).toBe("FORBIDDEN");
    const bad = await call("POST", "/api/admin/users", { token, body: { lixo: true } });
    expect([bad.status, bad.json.code]).toEqual([403, "FORBIDDEN"]);
    expect((await call("GET", "/api/admin/users")).status).toBe(401);
    expect((await call("GET", "/api/admin/users", { token: await tokenOf(carla) })).json.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("U1: lista os quatro com apenas os campos do AdminUserDto, ativos antes de inativos, sem demo e sem dados financeiros (CA25, CA26)", async () => {
    const items = await list(await admin());
    expect(items.map((i) => i.email)).toEqual(STUB_ADMIN_LIST_ORDER.map((k) => STUB_USERS[k].email));
    for (const i of items) expect(Object.keys(i).sort()).toEqual(["createdAt", "email", "id", "mustChangePassword", "name", "role", "status"]);
    expect(items.find((i) => i.email === bruno.email)).toMatchObject({ status: "INACTIVE" });
    expect(items.find((i) => i.email === carla.email)).toMatchObject({ mustChangePassword: true });
    expect(JSON.stringify(items)).not.toMatch(/passwordHash|demo/i);
  });

  it("U3 CA16: cria normalizando, USER, ativo, troca pendente; a pessoa consegue entrar e cai na troca", async () => {
    const r = await call("POST", "/api/admin/users", { token: await admin(), body: { name: "  Carla   Dias ", email: " Nova@Exemplo.com ", role: "USER", password: "Temp1234" } });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ name: "Carla Dias", email: "nova@exemplo.com", role: "USER", status: "ACTIVE", mustChangePassword: true });
    const entered = await call("POST", "/api/auth/login", { body: { email: "nova@exemplo.com", password: "Temp1234" } });
    expect([entered.status, entered.json.user.mustChangePassword]).toEqual([200, true]);
  });

  it("U3 CA17: e-mail duplicado (ativo, inativo, caixa diferente) -> 409 EMAIL_TAKEN com details.fields[0]", async () => {
    for (const email of ["ANA@exemplo.com", "bruno@exemplo.com"]) {
      const r = await call("POST", "/api/admin/users", { token: await admin(), body: { name: "X", email, role: "USER", password: "Temp1234" } });
      expect([r.status, r.json.code]).toEqual([409, "EMAIL_TAKEN"]);
      expect(r.json.details.fields[0]).toMatchObject({ field: "email", code: "EMAIL_TAKEN" });
    }
  });

  it("U3 CA18: 400 acumulado nos quatro campos; senha de 73 caracteres -> TOO_LONG", async () => {
    const r = await call("POST", "/api/admin/users", { token: await admin(), body: { name: "", email: "ana@", role: "ROOT", password: "1234567" } });
    expect(r.status).toBe(400);
    expect(r.json.details.fields.map((f: { field: string; code: string }) => `${f.field}:${f.code}`)).toEqual(["name:REQUIRED", "email:INVALID_FORMAT", "role:INVALID_VALUE", "password:TOO_SHORT"]);
    const long = await call("POST", "/api/admin/users", { token: await admin(), body: { name: "A", email: "a@b.co", role: "USER", password: "x".repeat(73) } });
    expect(long.json.details.fields[0]).toMatchObject({ field: "password", code: "TOO_LONG" });
  });

  it("U4 CA19: edita nome/e-mail/nivel e a mudanca vale na proxima requisicao SEM novo login (promove e rebaixa)", async () => {
    const ids = await idOf(ana);
    const token = await tokenOf(ana);
    expect((await call("GET", "/api/admin/users", { token })).status).toBe(403);
    const r = await call("PUT", `/api/admin/users/${ids}`, { token: await admin(), body: { name: "Ana Lima", email: "ana.lima@exemplo.com", role: "ADMIN" } });
    expect(r.json).toMatchObject({ name: "Ana Lima", email: "ana.lima@exemplo.com", role: "ADMIN" });
    expect((await call("GET", "/api/admin/users", { token })).status).toBe(200);
    expect((await call("GET", "/api/auth/me", { token })).json).toMatchObject({ role: "ADMIN", name: "Ana Lima" });
    await call("PUT", `/api/admin/users/${ids}`, { token: await admin(), body: { name: "Ana Lima", email: "ana.lima@exemplo.com", role: "USER" } });
    expect((await call("GET", "/api/admin/users", { token })).status).toBe(403);
    expect((await login({ ...ana, email: "ana.lima@exemplo.com" })).status).toBe(200);
  });

  it("U4: password no corpo -> 400 UNKNOWN_FIELD", async () => {
    const r = await call("PUT", `/api/admin/users/${await idOf(ana)}`, { token: await admin(), body: { name: "A", email: "a@b.co", role: "USER", password: "x" } });
    expect(r.json.details.fields.some((f: { code: string }) => f.code === "UNKNOWN_FIELD")).toBe(true);
  });

  it("U5 CA20: inativar encerra as sessoes (proxima requisicao 401), login falha, e e idempotente", async () => {
    const token = await tokenOf(ana);
    const id = await idOf(ana);
    const r = await call("POST", `/api/admin/users/${id}/deactivate`, { token: await admin() });
    expect([r.status, r.json.status]).toEqual([200, "INACTIVE"]);
    expect((await call("GET", "/api/cards", { token })).status).toBe(401);
    expect((await login(ana)).json.code).toBe("INVALID_CREDENTIALS");
    const again = await call("POST", `/api/admin/users/${id}/deactivate`, { token: await admin() });
    expect([again.status, again.json.status]).toEqual([200, "INACTIVE"]);
  });

  it("U6 CA21: reativar permite entrar com a senha anterior, sem troca", async () => {
    const r = await call("POST", `/api/admin/users/${await idOf(bruno)}/reactivate`, { token: await admin() });
    expect(r.json.status).toBe("ACTIVE");
    const entered = await login(bruno);
    expect([entered.status, entered.json.user.mustChangePassword]).toEqual([200, false]);
  });

  it("U7 CA22: redefinir encerra sessoes, invalida a senha antiga e marca a troca pendente; vale para inativo", async () => {
    const token = await tokenOf(ana);
    const r = await call("POST", `/api/admin/users/${await idOf(ana)}/password-reset`, { token: await admin(), body: { password: "Nova1234" } });
    expect(r.json.mustChangePassword).toBe(true);
    expect((await call("GET", "/api/cards", { token })).status).toBe(401);
    expect((await login(ana)).status).toBe(401);
    expect((await login(ana, "Nova1234")).json.user.mustChangePassword).toBe(true);
    const inactive = await call("POST", `/api/admin/users/${await idOf(bruno)}/password-reset`, { token: await admin(), body: { password: "Nova1234" } });
    expect(inactive.status).toBe(200);
  });

  it("CA23: o administrador nao inativa nem redefine a propria senha -> 422 CANNOT_TARGET_SELF", async () => {
    const id = await idOf(vagner);
    expect((await call("POST", `/api/admin/users/${id}/deactivate`, { token: await admin() })).json.code).toBe("CANNOT_TARGET_SELF");
    expect((await call("POST", `/api/admin/users/${id}/password-reset`, { token: await admin(), body: { password: "Nova1234" } })).json.code).toBe("CANNOT_TARGET_SELF");
  });

  it("CA24: unico administrador ativo nao pode ser rebaixado -> 422 LAST_ADMIN; com dois ativos pode", async () => {
    const v = await idOf(vagner);
    const body = { name: "Vagner", email: vagner.email, role: "USER" };
    const blocked = await call("PUT", `/api/admin/users/${v}`, { token: await admin(), body });
    expect([blocked.status, blocked.json.code]).toEqual([422, "LAST_ADMIN"]);
    await call("PUT", `/api/admin/users/${await idOf(ana)}`, { token: await admin(), body: { name: "Ana Souza", email: ana.email, role: "ADMIN" } });
    const allowed = await call("PUT", `/api/admin/users/${v}`, { token: await admin(), body });
    expect([allowed.status, allowed.json.role]).toEqual([200, "USER"]);
  });

  it("CA26: id inexistente -> 404 USER_NOT_FOUND em U4-U7; id mal formado -> 400", async () => {
    const ghost = "0192f1e2-0000-7000-8000-00000000ffff";
    const token = await admin();
    for (const [m, p, body] of [["PUT", `/api/admin/users/${ghost}`, { name: "A", email: "a@b.co", role: "USER" }], ["POST", `/api/admin/users/${ghost}/deactivate`], ["POST", `/api/admin/users/${ghost}/reactivate`], ["POST", `/api/admin/users/${ghost}/password-reset`, { password: "Nova1234" }]] as [string, string, unknown?][]) {
      const r = await call(m, p, { token, body });
      expect([r.status, r.json.code]).toEqual([404, "USER_NOT_FOUND"]);
    }
    expect((await call("POST", "/api/admin/users/nao-e-uuid/deactivate", { token })).status).toBe(400);
  });
});

describe("rotas publicas da demo (RF29, CA35, CA36)", () => {
  const demo = ["/api/demo/summary?month=2026-11", "/api/demo/cards", "/api/demo/categories", "/api/demo/invoices?month=2026-11", "/api/demo/entries/expenses?month=2026-11", "/api/demo/entries/incomes?month=2026-11", "/api/demo/dashboard/monthly-series?month=2026-11", "/api/demo/dashboard/category-distribution?month=2026-11"];

  it.each(demo)("GET %s sem cookie/Bearer -> 200", async (path) => {
    expect((await call("GET", path)).status).toBe(200);
  });
  it("tambem funciona para quem esta logado e nao mistura com os dados do usuario", async () => {
    const own = await call("GET", "/api/cards", { token: await tokenOf(ana) });
    const demoCards = await call("GET", "/api/demo/cards", { token: await tokenOf(ana) });
    expect(demoCards.status).toBe(200);
    expect(demoCards.json.items.map((c: { name: string }) => c.name)).toEqual(["Cartão Demo"]);
    expect(own.json.items.map((c: { name: string }) => c.name)).not.toContain("Cartão Demo");
  });
  it("despesas da demo em 2026-11 existem e sao reconheciveis ('Demo' na descricao)", async () => {
    const r = await call("GET", "/api/demo/entries/expenses?month=2026-11");
    expect(r.json.items.length).toBeGreaterThan(0);
    expect(r.json.items.every((e: { description: string }) => /Demo/.test(e.description))).toBe(true);
  });
  it("fatura da demo lista os lancamentos do cartao demo", async () => {
    const cards = (await call("GET", "/api/demo/cards")).json.items as { id: string }[];
    const r = await call("GET", `/api/demo/cards/${cards[0].id}/invoices/2026-11/entries`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.items)).toBe(true);
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s em qualquer caminho da demo -> 404 ROUTE_NOT_FOUND", async (method) => {
    const r = await call(method, "/api/demo/entries", { token: await tokenOf(ana), body: {} });
    expect([r.status, r.json.code]).toEqual([404, "ROUTE_NOT_FOUND"]);
  });
});

describe("cenarios (ADR 9.8)", () => {
  const scenario = (name: string) => call("POST", "/__scenario", { body: { name } });

  it("expired-session: toda rota autenticada responde 401 mesmo com Bearer valido (me inclusive); demo e login seguem", async () => {
    const token = await tokenOf(ana);
    await scenario("expired-session");
    expect((await call("GET", "/api/auth/me", { token })).status).toBe(401);
    expect((await call("GET", "/api/summary?month=2026-11", { token })).status).toBe(401);
    expect((await call("POST", "/api/cards", { token, body: { name: "X", closingDay: 1, dueDay: 2 } })).status).toBe(401);
    expect((await call("GET", "/api/demo/cards")).status).toBe(200);
  });

  it("rate-limited: login e troca de senha respondem 429 TOO_MANY_ATTEMPTS com retryAfterSeconds > 0 e Retry-After", async () => {
    const token = await tokenOf(ana);
    await scenario("rate-limited");
    const l = await login(ana);
    expect([l.status, l.json.code]).toEqual([429, "TOO_MANY_ATTEMPTS"]);
    expect(l.json.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(l.headers.get("retry-after"))).toBeGreaterThan(0);
    const p = await call("PUT", "/api/account/password", { token: token || "stub-x", body: { currentPassword: "a", newPassword: "b" } });
    expect(p.status).toBe(429);
  });

  it("users-error: so GET /api/admin/users responde 500 INTERNAL_ERROR (error.tsx do bloco); login, me e o resto seguem", async () => {
    const token = await tokenOf(vagner);
    await scenario("users-error");
    const r = await call("GET", "/api/admin/users", { token });
    expect([r.status, r.json.code]).toEqual([500, "INTERNAL_ERROR"]);
    expect((await call("GET", "/api/auth/me", { token })).status).toBe(200);
    expect((await call("GET", "/api/cards", { token })).status).toBe(200);
  });

  it("trocar de cenario restaura usuarios, sessoes e dados (isolamento entre testes)", async () => {
    const id = (await call("GET", "/api/admin/users", { token: await tokenOf(vagner) })).json.items[0].id;
    await call("POST", `/api/admin/users/${id}/deactivate`, { token: await tokenOf(vagner) });
    await scenario("default");
    const items = (await call("GET", "/api/admin/users", { token: await tokenOf(vagner) })).json.items;
    expect(items.filter((i: { status: string }) => i.status === "INACTIVE")).toHaveLength(1);
  });

  it("os cenarios antigos (empty, many, error500...) continuam funcionando com auth", async () => {
    const token = await tokenOf(ana);
    await scenario("error500");
    expect((await call("GET", "/api/summary?month=2026-11", { token })).status).toBe(500);
  });
});
