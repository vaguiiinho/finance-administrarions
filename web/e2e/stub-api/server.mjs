// Stub da API para os testes Playwright (ADR 9.5 / 11.5; ADR 0005 9.8): implementa os contratos da secao 6 em memoria,
// inclusive autenticacao (A1-A5), gestao de usuarios (U1-U7, so administrador) e rotas publicas da demo (/api/demo/*).
// Usuarios semeados em qualquer cenario: vagner (ADMIN), ana (USER), carla (troca obrigatoria), bruno (inativo); token `stub-<id>`.
// Cenarios extras: `expired-session` (toda rota autenticada responde 401), `rate-limited` (login e troca de senha respondem 429),
// `users-error` (so GET /api/admin/users responde 500). Contrato verificado por `auth.spec.ts`. Nao ha cadastro publico.
// Cenarios via `POST /__scenario { name, delayMs?, holdMutations?, holdQueries? }` (ver SCENARIOS). `delayMs` atrasa os GETs /api/*;
// `holdMutations` segura POST/PUT e `holdQueries` segura GET em /api/* ate `POST /__release` (estados deterministicos). Rotas: tabela ROUTES { method, pattern, handler }.
import { createServer } from "node:http";
import { calculateInvoiceDates } from "./invoice-dates.mjs";

const PORT = Number(process.env.STUB_API_PORT ?? 4010);
const uuid = (p, n) => `${p}0000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const CARD = { nubank: uuid("c", 1), itau: uuid("c", 2) };

const entry = (n, o) => ({
  id: uuid("e", n), type: "EXPENSE", description: `Lancamento ${n}`, category: "Moradia", date: "2026-11-05", amount: "10.00",
  paymentMethod: "PIX", card: null, invoice: null, referenceMonth: "2026-11", status: "PENDING", paidAt: null,
  createdAt: "2026-10-05T13:00:00.000Z", updatedAt: "2026-10-05T13:00:00.000Z", ...o,
});
const nubank = { id: CARD.nubank, name: "Nubank" };

// ---------- usuarios (ADR 0005 6.2): estado em `state.users`, recriado a cada cenario ----------
const userId = (n) => uuid("a", n);
const SEED_USERS = () => [
  { id: userId(1), name: "Vagner", email: "vagner@exemplo.com", password: "Admin1234", role: "ADMIN", status: "ACTIVE", mustChangePassword: false, createdAt: "2026-10-28T12:00:00.000Z" },
  { id: userId(2), name: "Ana Souza", email: "ana@exemplo.com", password: "segredo123", role: "USER", status: "ACTIVE", mustChangePassword: false, createdAt: "2026-10-29T12:00:00.000Z" },
  { id: userId(3), name: "Carla Dias", email: "carla@exemplo.com", password: "Temp1234", role: "USER", status: "ACTIVE", mustChangePassword: true, createdAt: "2026-10-30T02:30:00.000Z" },
  { id: userId(4), name: "Bruno Lima", email: "bruno@exemplo.com", password: "segredo123", role: "USER", status: "INACTIVE", mustChangePassword: false, createdAt: "2026-10-29T15:00:00.000Z" },
];
const DEMO_EMAIL = "demo@finance.invalid";
const SESSION_MS = 24 * 3600_000;
const RETRY_AFTER_SECONDS = 180;
const currentUserDto = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword });
const adminUserDto = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, mustChangePassword: u.mustChangePassword, createdAt: u.createdAt });
const normalizeName = (v) => String(v ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
const normalizeEmail = (v) => String(v ?? "").trim().toLowerCase();
const length = (v) => [...String(v ?? "")].length;
const issue = (field, code, message = code) => ({ field, code, message });
const validation = (res, fields) => err(res, 400, "VALIDATION_ERROR", { fields });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mapa nome -> configuracao (OCP: cenario novo = nova entrada). `failMode` e consultado pelos handlers.
const SCENARIOS = {
  default: { failMode: null },
  empty: { failMode: null, empty: true },
  // 25 despesas extras em novembro (> 20 por pagina): habilita a paginacao
  many: { failMode: null, many: true },
  // valores curtos ("R$ 10,00"): o indicador do Saldo cabe na mesma linha (CLS do skeleton do resumo, CA20)
  short: { failMode: null, short: true },
  error500: { failMode: "all" },
  // ADR 0005 9.8: sessao encerrada, limite de tentativas e falha so da lista de usuarios
  "expired-session": { failMode: null, expiredSession: true },
  "rate-limited": { failMode: null, rateLimited: true },
  "users-error": { failMode: null, usersError: true },
  "invoice-entries-error": { failMode: "invoice-entries" },
  batch404: { failMode: "batch404" },
  batch422: { failMode: "batch422" },
  "card-conflict": { failMode: "card-conflict" },
};

function seed(name, options = {}) {
  const config = SCENARIOS[name] ?? SCENARIOS.default;
  const extra = {
    failMode: config.failMode, delayMs: Number(options.delayMs ?? 0), holdMutations: Boolean(options.holdMutations), holdQueries: Boolean(options.holdQueries),
    expiredSession: Boolean(config.expiredSession), rateLimited: Boolean(config.rateLimited), usersError: Boolean(config.usersError), emptyDemo: Boolean(config.empty),
    // usuarios e sessoes encerradas (inativar/redefinir/sair): trocar de cenario restaura tudo
    users: SEED_USERS(), revoked: new Set(),
  };
  if (config.empty) return { cards: [], entries: [], ...extra };
  if (config.short) {
    return {
      cards: [],
      entries: [
        entry(1, { type: "INCOME", description: "Salário", category: "Salário", amount: "10.00", date: "2026-11-05", status: "RECEIVED" }),
        entry(2, { description: "Internet", amount: "2.00", date: "2026-11-10" }),
      ],
      ...extra,
    };
  }
  const cards = [
    { id: CARD.nubank, name: "Nubank", closingDay: 25, dueDay: 5, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" },
    { id: CARD.itau, name: "Itaú", closingDay: 3, dueDay: 10, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" },
  ];
  const inv = { closingDate: "2026-10-25", dueDate: "2026-11-05" };
  const entries = [
    entry(1, { description: "Mercado", category: "Alimentação", date: "2026-10-10", amount: "100.00", paymentMethod: "CARD", card: nubank, invoice: inv }),
    entry(2, { description: "Farmácia", category: "Saúde", date: "2026-10-12", amount: "50.00", paymentMethod: "CARD", card: nubank, invoice: inv }),
    entry(3, { description: "Internet", amount: "80.00", date: "2026-11-10" }),
    entry(4, { description: "Aluguel", amount: "30.00", date: "2026-11-02", status: "PAID", paidAt: "2026-11-02T13:00:00.000Z" }),
    entry(5, { type: "INCOME", description: "Salário", category: "Salário", amount: "5000.00", date: "2026-11-05", status: "RECEIVED" }),
    entry(6, { description: "Luz", category: "Moradia", amount: "120.00", date: "2026-10-20", referenceMonth: "2026-10", status: "PAID", paidAt: "2026-10-20T13:00:00.000Z" }),
    entry(7, { type: "INCOME", description: "Salário", category: "Salário", amount: "5000.00", date: "2026-10-05", referenceMonth: "2026-10", status: "RECEIVED" }),
  ];
  if (config.many) {
    for (let n = 8; n < 33; n++) entries.push(entry(n, { description: `Extra ${n}`, date: `2026-11-${String(1 + (n % 27)).padStart(2, "0")}` }));
  }
  return { cards, entries, ...extra };
}

let state = seed("default");
const cents = (s) => BigInt(s.replace(".", "").replace("-", "")) * (s.startsWith("-") ? -1n : 1n);
const money = (c) => `${c < 0n ? "-" : ""}${(c < 0n ? -c : c) / 100n}.${String((c < 0n ? -c : c) % 100n).padStart(2, "0")}`;
const sum = (list) => money(list.reduce((a, e) => a + cents(e.amount), 0n));
const expTotals = (list) => {
  const paid = list.filter((e) => e.status === "PAID"), pend = list.filter((e) => e.status === "PENDING");
  return { total: sum(list), paid: sum(paid), pending: sum(pend) };
};
const err = (res, status, code, details = null, headers = {}) => json(res, status, { code, message: code, details }, headers);
const json = (res, status, body, headers = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(body)); };
const nowIso = () => new Date().toISOString();
const body = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b ? JSON.parse(b) : {})); });

function page(items, url) {
  const p = Number(url.searchParams.get("page") ?? 1), s = Number(url.searchParams.get("pageSize") ?? 20);
  return { items: items.slice((p - 1) * s, p * s), pagination: { page: p, pageSize: s, totalItems: items.length, totalPages: Math.ceil(items.length / s) } };
}
const byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1);
const totalsOf = (month, data = state) => {
  const list = data.entries.filter((e) => e.referenceMonth === month);
  const income = sum(list.filter((e) => e.type === "INCOME"));
  const ex = expTotals(list.filter((e) => e.type === "EXPENSE"));
  return { income, expenses: ex, balance: { realized: money(cents(income) - cents(ex.paid)), projected: money(cents(income) - cents(ex.total)) } };
};
// B9: como a API, a fatura expoe a MAIOR closingDate e a MAIOR dueDate entre os lancamentos (cartao editado no meio do mes).
const maxOf = (list, key) => list.map((e) => e.invoice[key]).reduce((a, b) => (a >= b ? a : b));
const invoicesOf = (month, data = state) => {
  const rows = data.entries.filter((e) => e.referenceMonth === month && e.paymentMethod === "CARD");
  return data.cards.map((c) => {
    const list = rows.filter((e) => e.card.id === c.id);
    if (!list.length) return null;
    return { card: { id: c.id, name: c.name }, referenceMonth: month, closingDate: maxOf(list, "closingDate"), dueDate: maxOf(list, "dueDate"), entryCount: list.length, pendingCount: list.filter((e) => e.status === "PENDING").length, totals: expTotals(list) };
  }).filter(Boolean);
};

const PAID_AT = "2026-11-02T13:00:00.000Z";
const cardConflict = () => ({ fields: [{ field: "name", code: "NAME_TAKEN", message: "Já existe um cartão com esse nome." }] });
const nameTaken = (name, exceptId) => state.cards.some((c) => c.id !== exceptId && c.name.toLowerCase() === String(name).trim().toLowerCase());
const month = (url) => url.searchParams.get("month");

// Handlers: ({ req, res, url, params }) => resposta.
const listExpenses = ({ res, url, data }) => {
  let list = data.entries.filter((e) => e.type === "EXPENSE" && e.referenceMonth === month(url));
  const st = url.searchParams.get("status"), cat = url.searchParams.get("category"), card = url.searchParams.get("cardId");
  if (st) list = list.filter((e) => e.status === st);
  if (cat) list = list.filter((e) => e.category.toLowerCase() === cat.toLowerCase());
  if (card === "pix") list = list.filter((e) => !e.card); else if (card) list = list.filter((e) => e.card?.id === card);
  list.sort(byDate);
  return json(res, 200, { month: month(url), ...page(list, url), subtotal: expTotals(list) });
};
const listIncomes = ({ res, url, data }) => {
  let list = data.entries.filter((e) => e.type === "INCOME" && e.referenceMonth === month(url));
  const cat = url.searchParams.get("category"); if (cat) list = list.filter((e) => e.category.toLowerCase() === cat.toLowerCase());
  list.sort(byDate);
  return json(res, 200, { month: month(url), ...page(list, url), subtotal: { total: sum(list) } });
};
const createCard = async ({ req, res }) => {
  const b = await body(req);
  if (state.failMode === "card-conflict" || nameTaken(b.name)) return err(res, 409, "CARD_NAME_TAKEN", cardConflict());
  const stamp = nowIso();
  const card = { id: uuid("c", state.cards.length + 1), ...b, createdAt: stamp, updatedAt: stamp };
  state.cards.push(card); return json(res, 201, card);
};
const updateCard = async ({ req, res, params }) => {
  const card = state.cards.find((c) => c.id === params[0]);
  if (!card) return err(res, 404, "CARD_NOT_FOUND", { id: params[0] });
  const b = await body(req);
  if (state.failMode === "card-conflict" || nameTaken(b.name, card.id)) return err(res, 409, "CARD_NAME_TAKEN", cardConflict());
  // CA05: nao toca lancamentos. updatedAt so muda com alteracao efetiva.
  const next = { name: b.name ?? card.name, closingDay: b.closingDay ?? card.closingDay, dueDay: b.dueDay ?? card.dueDay };
  if (Object.keys(next).some((k) => next[k] !== card[k])) Object.assign(card, next, { updatedAt: nowIso() });
  return json(res, 200, card);
};
const invoiceEntries = ({ res, params, data }) => {
  if (state.failMode === "invoice-entries") return err(res, 500, "INTERNAL_ERROR");
  const card = data.cards.find((c) => c.id === params[0]); if (!card) return err(res, 404, "CARD_NOT_FOUND", { id: params[0] });
  return json(res, 200, { card: { id: card.id, name: card.name }, referenceMonth: params[1], items: data.entries.filter((e) => e.card?.id === params[0] && e.referenceMonth === params[1]).sort(byDate) });
};
const payInvoice = ({ res, params }) => {
  const pend = state.entries.filter((e) => e.card?.id === params[0] && e.referenceMonth === params[1] && e.status === "PENDING");
  pend.forEach((e) => { e.status = "PAID"; e.paidAt = PAID_AT; });
  return json(res, 200, { cardId: params[0], referenceMonth: params[1], paidIds: pend.map((e) => e.id), paidCount: pend.length, paidAmount: sum(pend) });
};
const payBatch = async ({ req, res }) => {
  const { ids } = await body(req);
  if (state.failMode === "batch404") return err(res, 404, "ENTRIES_NOT_FOUND", { missingIds: [ids[0]] });
  if (state.failMode === "batch422") return err(res, 422, "ENTRIES_NOT_PAYABLE", { incomeIds: [ids[0]] });
  const found = ids.map((id) => state.entries.find((e) => e.id === id)).filter(Boolean);
  const paid = [], already = [];
  for (const e of found) { if (e.status === "PENDING") { e.status = "PAID"; e.paidAt = PAID_AT; paid.push(e.id); } else already.push(e.id); }
  return json(res, 200, { paidIds: paid, alreadyPaidIds: already });
};
const payOne = ({ res, params }) => {
  const e = state.entries.find((x) => x.id === params[0]); if (!e) return err(res, 404, "ENTRY_NOT_FOUND", { id: params[0] });
  if (e.type === "INCOME") return err(res, 422, "ENTRY_NOT_PAYABLE", { incomeIds: [e.id] });
  if (e.status === "PENDING") { e.status = "PAID"; e.paidAt = PAID_AT; }
  return json(res, 200, e);
};
const createEntry = async ({ req, res }) => {
  const b = await body(req);
  const card = b.cardId ? state.cards.find((c) => c.id === b.cardId) : null;
  if (b.cardId && !card) return err(res, 404, "CARD_NOT_FOUND", { id: b.cardId }); // como a API real
  // RF05: datas da fatura pela regra (espelho do dominio) com fechamento/vencimento ATUAIS do cartao.
  const dates = card ? calculateInvoiceDates(b.date, card.closingDay, card.dueDay) : null;
  const created = entry(state.entries.length + 1, { type: b.type, description: b.description, category: b.category, date: b.date, amount: b.amount, paymentMethod: b.paymentMethod,
    card: card ? { id: card.id, name: card.name } : null, invoice: dates ? { closingDate: dates.closingDate, dueDate: dates.dueDate } : null,
    referenceMonth: dates ? dates.referenceMonth : b.date.slice(0, 7), status: b.type === "INCOME" ? "RECEIVED" : b.paymentMethod === "CARD" || b.paid === false ? "PENDING" : "PAID" });
  state.entries.push(created); return json(res, 201, created);
};
const monthlySeries = ({ res, url, data }) => {
  const [y, mo] = month(url).split("-").map(Number);
  const points = Array.from({ length: 12 }, (_, i) => { const idx = y * 12 + (mo - 1) - 11 + i; const mm = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`; return { month: mm, totals: totalsOf(mm, data) }; });
  return json(res, 200, { from: points[0].month, to: month(url), points });
};
const categoryDistribution = ({ res, url, data }) => {
  const list = data.entries.filter((e) => e.type === "EXPENSE" && e.referenceMonth === month(url));
  const total = cents(sum(list));
  const groups = [...new Set(list.map((e) => e.category))].map((c) => { const t = cents(sum(list.filter((e) => e.category === c))); return { category: c, total: money(t), percentage: (Number((t * 10000n) / (total || 1n)) / 100).toFixed(2) }; });
  return json(res, 200, { month: month(url), total: money(total), items: groups });
};

// ---------- dados de exemplo da demo (RF28, B5): 1 cartao, meses ao redor do mes atual + ago-dez/2026 fixos para os testes ----------
const monthShift = (ym, delta) => { const [y, m] = ym.split("-").map(Number); const i = y * 12 + (m - 1) + delta; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
function buildDemo() {
  const demoCard = { id: uuid("d", 1), name: "Cartão Demo", closingDay: 25, dueDay: 5, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" };
  if (state.emptyDemo) return { cards: [], entries: [] };
  const now = new Date().toISOString().slice(0, 7);
  const months = new Set(["2026-09", "2026-10", "2026-11", "2026-12"]);
  for (let d = -12; d <= 1; d++) months.add(monthShift(now, d));
  const entries = [];
  let n = 1;
  for (const m of [...months].sort()) {
    const prev = monthShift(m, -1);
    const base = { referenceMonth: m, createdAt: "2026-10-05T13:00:00.000Z", updatedAt: "2026-10-05T13:00:00.000Z" };
    entries.push(
      entry(1000 + n++, { ...base, description: "Demo: Salário", type: "INCOME", category: "Salário", amount: "5000.00", date: `${m}-05`, status: "RECEIVED" }),
      entry(1000 + n++, { ...base, description: "Demo: Aluguel", category: "Moradia", amount: "1500.00", date: `${m}-02`, status: "PAID", paidAt: `${m}-02T13:00:00.000Z` }),
      entry(1000 + n++, { ...base, description: "Demo: Internet", category: "Moradia", amount: "99.90", date: `${m}-10` }),
      entry(1000 + n++, { ...base, description: "Demo: Mercado", category: "Alimentação", amount: "420.00", date: `${prev}-10`, paymentMethod: "CARD", card: { id: demoCard.id, name: demoCard.name }, invoice: { closingDate: `${prev}-25`, dueDate: `${m}-05` } }),
    );
  }
  return { cards: [demoCard], entries };
}
let demoCache = null;
const demoData = () => (demoCache ??= buildDemo());

const route = (method, pattern, handler, options = {}) => ({ method, pattern: pattern instanceof RegExp ? pattern : new RegExp(`^${pattern}$`), handler, ...options });

// Leituras do finance: as MESMAS em /api/* (protegidas, dados do usuario) e /api/demo/* (publicas, dados de exemplo; ADR 6.5).
const READS = [
  ["/summary", ({ res, url, data }) => json(res, 200, { month: month(url), totals: totalsOf(month(url), data) })],
  ["/cards", ({ res, data }) => json(res, 200, { items: data.cards })],
  ["/categories", ({ res, data }) => json(res, 200, { items: [...new Set(data.entries.map((e) => e.category))] })],
  ["/invoices", ({ res, url, data }) => json(res, 200, { month: month(url), items: invoicesOf(month(url), data) })],
  ["/entries/expenses", listExpenses],
  ["/entries/incomes", listIncomes],
  ["/cards/([^/]+)/invoices/(\\d{4}-\\d{2})/entries", invoiceEntries],
  ["/dashboard/monthly-series", monthlySeries],
  ["/dashboard/category-distribution", categoryDistribution],
];

// ---------- identidade (A1-A5) e gestao (U1-U7) ----------
const findUser = (id) => state.users.find((u) => u.id === id);
const sessionOf = (req) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
  if (!m || state.expiredSession) return null;
  const id = m[1].startsWith("stub-") ? m[1].slice(5) : null;
  const user = id ? findUser(id) : null;
  return user && user.status === "ACTIVE" && !state.revoked.has(user.id) ? user : null;
};
const unauthenticated = (res) => err(res, 401, "UNAUTHENTICATED", null, { "www-authenticate": "Bearer" });
const issueSession = (user) => { state.revoked.delete(user.id); return { token: `stub-${user.id}`, expiresAt: new Date(Date.now() + SESSION_MS).toISOString() }; };
const activeAdminsExcept = (id) => state.users.filter((u) => u.id !== id && u.role === "ADMIN" && u.status === "ACTIVE").length;
const passwordIssues = (value, field) => (value === undefined || value === "" ? [issue(field, "REQUIRED")] : typeof value !== "string" ? [issue(field, "REQUIRED")] : length(value) < 8 ? [issue(field, "TOO_SHORT")] : length(value) > 72 ? [issue(field, "TOO_LONG")] : []);
const nameIssues = (value) => { const n = normalizeName(value); return n === "" ? [issue("name", "REQUIRED")] : length(n) > 60 ? [issue("name", "TOO_LONG")] : []; };
const emailIssues = (value) => {
  const e = normalizeEmail(value);
  if (e === "") return [issue("email", "REQUIRED")];
  if (length(e) > 254) return [issue("email", "TOO_LONG")];
  return /^[^@\s]{1,64}@[^@\s]+\.[^@\s]+$/.test(e) ? [] : [issue("email", "INVALID_FORMAT")];
};
const roleIssues = (value) => (value === undefined || value === "" ? [issue("role", "REQUIRED")] : value === "ADMIN" || value === "USER" ? [] : [issue("role", "INVALID_VALUE")]);
const unknownIssues = (b, allowed) => Object.keys(b).filter((k) => !allowed.includes(k)).map((k) => issue(k, "UNKNOWN_FIELD"));
const emailTaken = (email, exceptId) => email === DEMO_EMAIL || state.users.some((u) => u.id !== exceptId && u.email === email);
const takenReply = (res) => err(res, 409, "EMAIL_TAKEN", { fields: [issue("email", "EMAIL_TAKEN", "Este e-mail já está em uso.")] });

const login = async ({ req, res }) => {
  if (state.rateLimited) return err(res, 429, "TOO_MANY_ATTEMPTS", { retryAfterSeconds: RETRY_AFTER_SECONDS }, { "retry-after": String(RETRY_AFTER_SECONDS) });
  const b = await body(req);
  const fields = [...(b.email ? [] : [issue("email", "REQUIRED")]), ...(b.password ? [] : [issue("password", "REQUIRED")])];
  if (fields.length) return validation(res, fields);
  const user = state.users.find((u) => u.email === normalizeEmail(b.email));
  // inexistente, senha errada e inativo: a MESMA resposta (CA03, sem enumeracao)
  if (!user || user.status !== "ACTIVE" || user.password !== b.password) return err(res, 401, "INVALID_CREDENTIALS", null, { "www-authenticate": "Bearer" });
  return json(res, 200, { user: currentUserDto(user), session: issueSession(user) });
};
const logout = (ctx) => { const user = sessionOf(ctx.req); if (user) state.revoked.add(user.id); ctx.res.writeHead(204); ctx.res.end(); };
const changePassword = async ({ req, res, user }) => {
  if (state.rateLimited) return err(res, 429, "TOO_MANY_ATTEMPTS", { retryAfterSeconds: RETRY_AFTER_SECONDS }, { "retry-after": String(RETRY_AFTER_SECONDS) });
  const b = await body(req);
  const shape = [...unknownIssues(b, ["currentPassword", "newPassword"]), ...(b.currentPassword ? [] : [issue("currentPassword", "REQUIRED")]), ...passwordIssues(b.newPassword, "newPassword")];
  if (shape.length) return validation(res, shape);
  if (b.currentPassword !== user.password) return validation(res, [issue("currentPassword", "INCORRECT", "Senha atual incorreta.")]);
  if (b.newPassword === b.currentPassword) return validation(res, [issue("newPassword", "SAME_AS_CURRENT", "A nova senha deve ser diferente da atual.")]);
  Object.assign(user, { password: b.newPassword, mustChangePassword: false });
  return json(res, 200, currentUserDto(user));
};
const updateProfile = async ({ req, res, user }) => {
  const b = await body(req);
  const fields = [...unknownIssues(b, ["name"]), ...nameIssues(b.name)];
  if (fields.length) return validation(res, fields);
  user.name = normalizeName(b.name);
  return json(res, 200, currentUserDto(user));
};

const badId = (res, id) => !UUID_RE.test(id) && (validation(res, [issue("id", "INVALID_FORMAT")]), true);
const listUsers = ({ res }) => {
  if (state.usersError) return err(res, 500, "INTERNAL_ERROR");
  const by = (a, b) => a.name.localeCompare(b.name, "pt-BR");
  const items = [...state.users.filter((u) => u.status === "ACTIVE").sort(by), ...state.users.filter((u) => u.status === "INACTIVE").sort(by)];
  return json(res, 200, { items: items.map(adminUserDto) });
};
const getUser = ({ res, params }) => badId(res, params[0]) ? undefined : findUser(params[0]) ? json(res, 200, adminUserDto(findUser(params[0]))) : err(res, 404, "USER_NOT_FOUND", { id: params[0] });
const createUser = async ({ req, res }) => {
  const b = await body(req);
  const fields = [...unknownIssues(b, ["name", "email", "role", "password"]), ...nameIssues(b.name), ...emailIssues(b.email), ...roleIssues(b.role), ...passwordIssues(b.password, "password")];
  if (fields.length) return validation(res, fields);
  const email = normalizeEmail(b.email);
  if (emailTaken(email)) return takenReply(res);
  const user = { id: userId(state.users.length + 1), name: normalizeName(b.name), email, password: b.password, role: b.role, status: "ACTIVE", mustChangePassword: true, createdAt: nowIso() };
  state.users.push(user);
  return json(res, 201, adminUserDto(user));
};
const updateUser = async ({ req, res, params, user: actor }) => {
  const b = await body(req);
  const fields = [...unknownIssues(b, ["name", "email", "role"]), ...nameIssues(b.name), ...emailIssues(b.email), ...roleIssues(b.role)];
  if (badId(res, params[0])) return;
  if (fields.length) return validation(res, fields);
  const target = findUser(params[0]);
  if (!target) return err(res, 404, "USER_NOT_FOUND", { id: params[0] });
  if (target.role === "ADMIN" && target.status === "ACTIVE" && b.role === "USER" && activeAdminsExcept(target.id) === 0) return err(res, 422, "LAST_ADMIN");
  const email = normalizeEmail(b.email);
  if (emailTaken(email, target.id)) return takenReply(res);
  void actor;
  Object.assign(target, { name: normalizeName(b.name), email, role: b.role });
  return json(res, 200, adminUserDto(target));
};
const deactivateUser = ({ res, params, user: actor }) => {
  if (badId(res, params[0])) return;
  const target = findUser(params[0]);
  if (!target) return err(res, 404, "USER_NOT_FOUND", { id: params[0] });
  if (target.id === actor.id) return err(res, 422, "CANNOT_TARGET_SELF");
  if (target.status === "INACTIVE") return json(res, 200, adminUserDto(target)); // idempotente (P18)
  if (target.role === "ADMIN" && activeAdminsExcept(target.id) === 0) return err(res, 422, "LAST_ADMIN");
  target.status = "INACTIVE"; state.revoked.add(target.id);
  return json(res, 200, adminUserDto(target));
};
const reactivateUser = ({ res, params }) => {
  if (badId(res, params[0])) return;
  const target = findUser(params[0]);
  if (!target) return err(res, 404, "USER_NOT_FOUND", { id: params[0] });
  target.status = "ACTIVE"; // nao toca a senha nem a troca obrigatoria (CA21)
  return json(res, 200, adminUserDto(target));
};
const resetUserPassword = async ({ req, res, params, user: actor }) => {
  const b = await body(req);
  const fields = [...unknownIssues(b, ["password"]), ...passwordIssues(b.password, "password")];
  if (badId(res, params[0])) return;
  if (fields.length) return validation(res, fields);
  const target = findUser(params[0]);
  if (!target) return err(res, 404, "USER_NOT_FOUND", { id: params[0] });
  if (target.id === actor.id) return err(res, 422, "CANNOT_TARGET_SELF");
  Object.assign(target, { password: b.password, mustChangePassword: true }); state.revoked.add(target.id);
  return json(res, 200, adminUserDto(target));
};

// `auth`: "public" (sem Bearer), "any" (qualquer sessao, inclusive com troca obrigatoria pendente), "user" (bloqueada na troca
// obrigatoria, T13) ou "admin" (alem disso, so ADMIN). Ordem: 401 > 403 PASSWORD_CHANGE_REQUIRED > 403 FORBIDDEN > validacao > 404 > 422 > 409.
const ROUTES = [
  route("POST", "/api/auth/login", login, { auth: "public" }),
  route("POST", "/api/auth/logout", logout, { auth: "public" }),
  route("GET", "/api/auth/me", ({ res, user }) => json(res, 200, currentUserDto(user)), { auth: "any" }),
  route("PUT", "/api/account/password", changePassword, { auth: "any" }),
  route("PUT", "/api/account/profile", updateProfile, { auth: "user" }),
  route("GET", "/api/admin/users", listUsers, { auth: "admin" }),
  route("POST", "/api/admin/users", createUser, { auth: "admin" }),
  route("GET", "/api/admin/users/([^/]+)", getUser, { auth: "admin" }),
  route("PUT", "/api/admin/users/([^/]+)", updateUser, { auth: "admin" }),
  route("POST", "/api/admin/users/([^/]+)/deactivate", deactivateUser, { auth: "admin" }),
  route("POST", "/api/admin/users/([^/]+)/reactivate", reactivateUser, { auth: "admin" }),
  route("POST", "/api/admin/users/([^/]+)/password-reset", resetUserPassword, { auth: "admin" }),
  ...READS.map(([path, handler]) => route("GET", `/api${path}`, handler, { auth: "user", data: () => state })),
  ...READS.map(([path, handler]) => route("GET", `/api/demo${path}`, handler, { auth: "public", data: () => demoData() })),
  route("POST", "/api/cards", createCard, { auth: "user" }),
  route("PUT", "/api/cards/([^/]+)", updateCard, { auth: "user" }),
  route("POST", "/api/cards/([^/]+)/invoices/(\\d{4}-\\d{2})/pay", payInvoice, { auth: "user" }),
  route("POST", "/api/entries/pay", payBatch, { auth: "user" }),
  route("POST", "/api/entries/([^/]+)/pay", payOne, { auth: "user" }),
  route("POST", "/api/entries", createEntry, { auth: "user" }),
];

// Mutacoes seguradas por `holdMutations` esperam este gate ate `POST /__release` (ou novo `__scenario`).
let releaseGate = null;
const openGate = () => { releaseGate?.(); releaseGate = null; };
const waitGate = () => new Promise((resolve) => { const prev = releaseGate; releaseGate = () => { prev?.(); resolve(); }; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONTROL = {
  "POST /__scenario": async ({ req, res }) => { openGate(); const b = await body(req); state = seed(b.name ?? "default", b); demoCache = null; return json(res, 200, { ok: true }); },
  "POST /__release": ({ res }) => { openGate(); return json(res, 200, { ok: true }); },
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://stub");
  const path = url.pathname;
  try {
    const control = CONTROL[`${req.method} ${path}`];
    if (control) return await control({ req, res });
    const isApi = path.startsWith("/api");
    // atraso/espera simulam consultas LENTAS DE DADOS: a identidade (/auth/me do layout, lista de usuarios) responde na hora,
    // senao o layout seguraria a pagina inteira e nenhum skeleton (loading.tsx) apareceria
    const isDataQuery = isApi && req.method === "GET" && !path.startsWith("/api/auth/") && !path.startsWith("/api/admin/");
    if (isDataQuery && state.delayMs > 0) await sleep(state.delayMs);
    if (isDataQuery && state.holdQueries) await waitGate();
    if (isApi && (req.method === "POST" || req.method === "PUT") && state.holdMutations) await waitGate();
    if (state.failMode === "all" && isApi) return err(res, 500, "INTERNAL_ERROR");
    for (const r of ROUTES) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(path);
      if (!m) continue;
      let user = null;
      if (r.auth !== "public") {
        user = sessionOf(req);
        if (!user) return unauthenticated(res);
        if (user.mustChangePassword && r.auth !== "any") return err(res, 403, "PASSWORD_CHANGE_REQUIRED");
        if (r.auth === "admin" && user.role !== "ADMIN") return err(res, 403, "FORBIDDEN");
      }
      return await r.handler({ req, res, url, params: m.slice(1), user, data: r.data ? r.data() : state });
    }
    return err(res, 404, "ROUTE_NOT_FOUND");
  } catch (e) { return err(res, 500, "INTERNAL_ERROR", String(e)); }
}).listen(PORT, () => console.log(`stub-api em :${PORT}`));
