// Stub da API para os testes Playwright (ADR 9.5 / 11.5): implementa os contratos da secao 6 em memoria.
// Cenarios via `POST /__scenario { "name": "default" | "empty" | "error500" | "batch404" | "batch422" | "invoice-entries-error" | "card-conflict" }`.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_API_PORT ?? 4010);
const uuid = (p, n) => `${p}0000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const CARD = { nubank: uuid("c", 1), itau: uuid("c", 2) };

const entry = (n, o) => ({
  id: uuid("e", n), type: "EXPENSE", description: `Lancamento ${n}`, category: "Moradia", date: "2026-11-05", amount: "10.00",
  paymentMethod: "PIX", card: null, invoice: null, referenceMonth: "2026-11", status: "PENDING", paidAt: null,
  createdAt: "2026-10-05T13:00:00.000Z", updatedAt: "2026-10-05T13:00:00.000Z", ...o,
});
const nubank = { id: CARD.nubank, name: "Nubank" };

function seed(name) {
  if (name === "empty") return { cards: [], entries: [], failMode: null };
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
  return { cards, entries, failMode: name === "error500" ? "all" : name === "invoice-entries-error" ? "invoice-entries" : name === "batch404" ? "batch404" : name === "batch422" ? "batch422" : name === "card-conflict" ? "card-conflict" : null };
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
const invoicesOf = (month) => {
  const rows = state.entries.filter((e) => e.referenceMonth === month && e.paymentMethod === "CARD");
  return state.cards.map((c) => {
    const list = rows.filter((e) => e.card.id === c.id);
    if (!list.length) return null;
    return { card: { id: c.id, name: c.name }, referenceMonth: month, closingDate: list[0].invoice.closingDate, dueDate: list[0].invoice.dueDate, entryCount: list.length, pendingCount: list.filter((e) => e.status === "PENDING").length, totals: expTotals(list) };
  }).filter(Boolean);
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://stub");
  const path = url.pathname;
  try {
    if (path === "/__scenario" && req.method === "POST") { state = seed((await body(req)).name ?? "default"); return json(res, 200, { ok: true }); }
    if (state.failMode === "all" && path.startsWith("/api")) return err(res, 500, "INTERNAL_ERROR");
    const month = url.searchParams.get("month");
    let m;
    if (path === "/api/summary") return json(res, 200, { month, totals: totalsOf(month) });
    if (path === "/api/cards" && req.method === "GET") return json(res, 200, { items: state.cards });
    if (path === "/api/cards" && req.method === "POST") {
      const b = await body(req);
      if (state.failMode === "card-conflict" || state.cards.some((c) => c.name.toLowerCase() === String(b.name).trim().toLowerCase())) return err(res, 409, "CARD_NAME_TAKEN", { fields: [{ field: "name", code: "NAME_TAKEN", message: "Já existe um cartão com esse nome." }] });
      const card = { id: uuid("c", state.cards.length + 1), ...b, createdAt: "2026-10-24T13:00:00.000Z", updatedAt: "2026-10-24T13:00:00.000Z" };
      state.cards.push(card); return json(res, 201, card);
    }
    if (path === "/api/categories") return json(res, 200, { items: [...new Set(state.entries.map((e) => e.category))] });
    if (path === "/api/invoices") return json(res, 200, { month, items: invoicesOf(month) });
    if (path === "/api/entries/expenses") {
      let list = state.entries.filter((e) => e.type === "EXPENSE" && e.referenceMonth === month);
      const st = url.searchParams.get("status"), cat = url.searchParams.get("category"), card = url.searchParams.get("cardId");
      if (st) list = list.filter((e) => e.status === st);
      if (cat) list = list.filter((e) => e.category.toLowerCase() === cat.toLowerCase());
      if (card === "pix") list = list.filter((e) => !e.card); else if (card) list = list.filter((e) => e.card?.id === card);
      list.sort(byDate);
      return json(res, 200, { month, ...page(list, url), subtotal: expTotals(list) });
    }
    if (path === "/api/entries/incomes") {
      let list = state.entries.filter((e) => e.type === "INCOME" && e.referenceMonth === month);
      const cat = url.searchParams.get("category"); if (cat) list = list.filter((e) => e.category.toLowerCase() === cat.toLowerCase());
      list.sort(byDate);
      return json(res, 200, { month, ...page(list, url), subtotal: { total: sum(list) } });
    }
    if ((m = /^\/api\/cards\/([^/]+)\/invoices\/(\d{4}-\d{2})\/entries$/.exec(path))) {
      if (state.failMode === "invoice-entries") return err(res, 500, "INTERNAL_ERROR");
      const card = state.cards.find((c) => c.id === m[1]); if (!card) return err(res, 404, "CARD_NOT_FOUND", { id: m[1] });
      return json(res, 200, { card: { id: card.id, name: card.name }, referenceMonth: m[2], items: state.entries.filter((e) => e.card?.id === m[1] && e.referenceMonth === m[2]).sort(byDate) });
    }
    if ((m = /^\/api\/cards\/([^/]+)\/invoices\/(\d{4}-\d{2})\/pay$/.exec(path)) && req.method === "POST") {
      const pend = state.entries.filter((e) => e.card?.id === m[1] && e.referenceMonth === m[2] && e.status === "PENDING");
      pend.forEach((e) => { e.status = "PAID"; e.paidAt = "2026-11-02T13:00:00.000Z"; });
      return json(res, 200, { cardId: m[1], referenceMonth: m[2], paidIds: pend.map((e) => e.id), paidCount: pend.length, paidAmount: sum(pend) });
    }
    if (path === "/api/entries/pay" && req.method === "POST") {
      const { ids } = await body(req);
      if (state.failMode === "batch404") return err(res, 404, "ENTRIES_NOT_FOUND", { missingIds: [ids[0]] });
      if (state.failMode === "batch422") return err(res, 422, "ENTRIES_NOT_PAYABLE", { incomeIds: [ids[0]] });
      const found = ids.map((id) => state.entries.find((e) => e.id === id)).filter(Boolean);
      const paid = [], already = [];
      for (const e of found) { if (e.status === "PENDING") { e.status = "PAID"; e.paidAt = "2026-11-02T13:00:00.000Z"; paid.push(e.id); } else already.push(e.id); }
      return json(res, 200, { paidIds: paid, alreadyPaidIds: already });
    }
    if ((m = /^\/api\/entries\/([^/]+)\/pay$/.exec(path)) && req.method === "POST") {
      const e = state.entries.find((x) => x.id === m[1]); if (!e) return err(res, 404, "ENTRY_NOT_FOUND", { id: m[1] });
      if (e.type === "INCOME") return err(res, 422, "ENTRY_NOT_PAYABLE", { incomeIds: [e.id] });
      if (e.status === "PENDING") { e.status = "PAID"; e.paidAt = "2026-11-02T13:00:00.000Z"; }
      return json(res, 200, e);
    }
    if (path === "/api/entries" && req.method === "POST") {
      const b = await body(req);
      const card = b.cardId ? state.cards.find((c) => c.id === b.cardId) : null;
      const created = entry(state.entries.length + 1, { type: b.type, description: b.description, category: b.category, date: b.date, amount: b.amount, paymentMethod: b.paymentMethod,
        card: card ? { id: card.id, name: card.name } : null, invoice: card ? { closingDate: "2026-11-25", dueDate: "2026-12-05" } : null,
        referenceMonth: card ? "2026-12" : b.date.slice(0, 7), status: b.type === "INCOME" ? "RECEIVED" : b.paymentMethod === "CARD" || b.paid === false ? "PENDING" : "PAID" });
      state.entries.push(created); return json(res, 201, created);
    }
    if (path === "/api/dashboard/monthly-series") {
      const [y, mo] = month.split("-").map(Number);
      const points = Array.from({ length: 12 }, (_, i) => { const idx = y * 12 + (mo - 1) - 11 + i; const mm = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`; return { month: mm, totals: totalsOf(mm) }; });
      return json(res, 200, { from: points[0].month, to: month, points });
    }
    if (path === "/api/dashboard/category-distribution") {
      const list = state.entries.filter((e) => e.type === "EXPENSE" && e.referenceMonth === month);
      const total = cents(sum(list));
      const groups = [...new Set(list.map((e) => e.category))].map((c) => { const t = cents(sum(list.filter((e) => e.category === c))); return { category: c, total: money(t), percentage: (Number((t * 10000n) / (total || 1n)) / 100).toFixed(2) }; });
      return json(res, 200, { month, total: money(total), items: groups });
    }
    return err(res, 404, "ROUTE_NOT_FOUND");
  } catch (e) { return err(res, 500, "INTERNAL_ERROR", String(e)); }
}).listen(PORT, () => console.log(`stub-api em :${PORT}`));
