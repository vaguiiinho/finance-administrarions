// Stub da API para os testes Playwright (ADR 9.5 / 11.5): implementa os contratos da secao 6 em memoria.
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

// Mapa nome -> configuracao (OCP: cenario novo = nova entrada). `failMode` e consultado pelos handlers.
const SCENARIOS = {
  default: { failMode: null },
  empty: { failMode: null, empty: true },
  // 25 despesas extras em novembro (> 20 por pagina): habilita a paginacao
  many: { failMode: null, many: true },
  error500: { failMode: "all" },
  "invoice-entries-error": { failMode: "invoice-entries" },
  batch404: { failMode: "batch404" },
  batch422: { failMode: "batch422" },
  "card-conflict": { failMode: "card-conflict" },
};

function seed(name, options = {}) {
  const config = SCENARIOS[name] ?? SCENARIOS.default;
  const extra = { failMode: config.failMode, delayMs: Number(options.delayMs ?? 0), holdMutations: Boolean(options.holdMutations), holdQueries: Boolean(options.holdQueries) };
  if (config.empty) return { cards: [], entries: [], ...extra };
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
const err = (res, status, code, details = null) => json(res, status, { code, message: code, details });
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const nowIso = () => new Date().toISOString();
const body = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b ? JSON.parse(b) : {})); });

function page(items, url) {
  const p = Number(url.searchParams.get("page") ?? 1), s = Number(url.searchParams.get("pageSize") ?? 20);
  return { items: items.slice((p - 1) * s, p * s), pagination: { page: p, pageSize: s, totalItems: items.length, totalPages: Math.ceil(items.length / s) } };
}
const byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1);
const totalsOf = (month) => {
  const list = state.entries.filter((e) => e.referenceMonth === month);
  const income = sum(list.filter((e) => e.type === "INCOME"));
  const ex = expTotals(list.filter((e) => e.type === "EXPENSE"));
  return { income, expenses: ex, balance: { realized: money(cents(income) - cents(ex.paid)), projected: money(cents(income) - cents(ex.total)) } };
};
// B9: como a API, a fatura expoe a MAIOR closingDate e a MAIOR dueDate entre os lancamentos (cartao editado no meio do mes).
const maxOf = (list, key) => list.map((e) => e.invoice[key]).reduce((a, b) => (a >= b ? a : b));
const invoicesOf = (month) => {
  const rows = state.entries.filter((e) => e.referenceMonth === month && e.paymentMethod === "CARD");
  return state.cards.map((c) => {
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
const listExpenses = ({ res, url }) => {
  let list = state.entries.filter((e) => e.type === "EXPENSE" && e.referenceMonth === month(url));
  const st = url.searchParams.get("status"), cat = url.searchParams.get("category"), card = url.searchParams.get("cardId");
  if (st) list = list.filter((e) => e.status === st);
  if (cat) list = list.filter((e) => e.category.toLowerCase() === cat.toLowerCase());
  if (card === "pix") list = list.filter((e) => !e.card); else if (card) list = list.filter((e) => e.card?.id === card);
  list.sort(byDate);
  return json(res, 200, { month: month(url), ...page(list, url), subtotal: expTotals(list) });
};
const listIncomes = ({ res, url }) => {
  let list = state.entries.filter((e) => e.type === "INCOME" && e.referenceMonth === month(url));
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
const invoiceEntries = ({ res, params }) => {
  if (state.failMode === "invoice-entries") return err(res, 500, "INTERNAL_ERROR");
  const card = state.cards.find((c) => c.id === params[0]); if (!card) return err(res, 404, "CARD_NOT_FOUND", { id: params[0] });
  return json(res, 200, { card: { id: card.id, name: card.name }, referenceMonth: params[1], items: state.entries.filter((e) => e.card?.id === params[0] && e.referenceMonth === params[1]).sort(byDate) });
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
const monthlySeries = ({ res, url }) => {
  const [y, mo] = month(url).split("-").map(Number);
  const points = Array.from({ length: 12 }, (_, i) => { const idx = y * 12 + (mo - 1) - 11 + i; const mm = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`; return { month: mm, totals: totalsOf(mm) }; });
  return json(res, 200, { from: points[0].month, to: month(url), points });
};
const categoryDistribution = ({ res, url }) => {
  const list = state.entries.filter((e) => e.type === "EXPENSE" && e.referenceMonth === month(url));
  const total = cents(sum(list));
  const groups = [...new Set(list.map((e) => e.category))].map((c) => { const t = cents(sum(list.filter((e) => e.category === c))); return { category: c, total: money(t), percentage: (Number((t * 10000n) / (total || 1n)) / 100).toFixed(2) }; });
  return json(res, 200, { month: month(url), total: money(total), items: groups });
};

const route = (method, pattern, handler) => ({ method, pattern: pattern instanceof RegExp ? pattern : new RegExp(`^${pattern}$`), handler });
const ROUTES = [
  route("GET", "/api/summary", ({ res, url }) => json(res, 200, { month: month(url), totals: totalsOf(month(url)) })),
  route("GET", "/api/cards", ({ res }) => json(res, 200, { items: state.cards })),
  route("POST", "/api/cards", createCard),
  route("PUT", "/api/cards/([^/]+)", updateCard),
  route("GET", "/api/categories", ({ res }) => json(res, 200, { items: [...new Set(state.entries.map((e) => e.category))] })),
  route("GET", "/api/invoices", ({ res, url }) => json(res, 200, { month: month(url), items: invoicesOf(month(url)) })),
  route("GET", "/api/entries/expenses", listExpenses),
  route("GET", "/api/entries/incomes", listIncomes),
  route("GET", "/api/cards/([^/]+)/invoices/(\\d{4}-\\d{2})/entries", invoiceEntries),
  route("POST", "/api/cards/([^/]+)/invoices/(\\d{4}-\\d{2})/pay", payInvoice),
  route("POST", "/api/entries/pay", payBatch),
  route("POST", "/api/entries/([^/]+)/pay", payOne),
  route("POST", "/api/entries", createEntry),
  route("GET", "/api/dashboard/monthly-series", monthlySeries),
  route("GET", "/api/dashboard/category-distribution", categoryDistribution),
];

// Mutacoes seguradas por `holdMutations` esperam este gate ate `POST /__release` (ou novo `__scenario`).
let releaseGate = null;
const openGate = () => { releaseGate?.(); releaseGate = null; };
const waitGate = () => new Promise((resolve) => { const prev = releaseGate; releaseGate = () => { prev?.(); resolve(); }; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONTROL = {
  "POST /__scenario": async ({ req, res }) => { openGate(); const b = await body(req); state = seed(b.name ?? "default", b); return json(res, 200, { ok: true }); },
  "POST /__release": ({ res }) => { openGate(); return json(res, 200, { ok: true }); },
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://stub");
  const path = url.pathname;
  try {
    const control = CONTROL[`${req.method} ${path}`];
    if (control) return await control({ req, res });
    const isApi = path.startsWith("/api");
    if (isApi && req.method === "GET" && state.delayMs > 0) await sleep(state.delayMs);
    if (isApi && req.method === "GET" && state.holdQueries) await waitGate();
    if (isApi && (req.method === "POST" || req.method === "PUT") && state.holdMutations) await waitGate();
    if (state.failMode === "all" && isApi) return err(res, 500, "INTERNAL_ERROR");
    for (const r of ROUTES) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(path);
      if (m) return await r.handler({ req, res, url, params: m.slice(1) });
    }
    return err(res, 404, "ROUTE_NOT_FOUND");
  } catch (e) { return err(res, 500, "INTERNAL_ERROR", String(e)); }
}).listen(PORT, () => console.log(`stub-api em :${PORT}`));
