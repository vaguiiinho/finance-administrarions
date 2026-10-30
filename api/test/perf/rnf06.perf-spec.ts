import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import { DEFAULT_OWNER_ID } from '@test/support/default-owner-db.js';
import { startFinanceE2e } from '@test/support/finance-e2e.js';
import { percentile } from './p95.js';
import { seedVolume, type VolumeSeed } from './seed-volume.js';

/**
 * RNF06 (ADR 0002 T4): p95 < 300 ms com 100 mil lancamentos e 20 cartoes. Mede por HTTP real (fetch) a aplicacao Nest
 * sobre Postgres 17 em container. 5 aquecimentos + 50 amostras sequenciais por cenario. Opt-in: `npm run perf:rnf06`.
 * Um cenario com p95 >= 300 ms deixa a suite vermelha (B2: bloqueia o fechamento).
 */
const LIMIT_MS = 300;
const WARMUP = 5;
const SAMPLES = 50;

interface Scenario {
  name: ScenarioName;
  /** Devolve method + path da amostra `i` (I3 usa uma fatura diferente por amostra) */
  request: (i: number) => { method: 'GET' | 'POST'; path: string };
}

interface Result {
  scenario: string;
  p50: number;
  p95: number;
  max: number;
  /** indices usados nos planos EXPLAIN (ANALYZE) da ultima amostra */
  indexes: string[];
  /** tabelas lidas por Seq Scan nesses planos */
  seqScans: string[];
  seqScanOnEntries: boolean;
  plans: PlanSummary[];
}

let ctx: Awaited<ReturnType<typeof startFinanceE2e>>;
const auth = () => ({ Authorization: `Bearer ${ctx.token()}` });
let base: string;
let seed: VolumeSeed;
let lastExpensePage = 1;
const results: Result[] = [];

beforeAll(async () => {
  installCapture();
  ctx = await startFinanceE2e();
  await ctx.reset();
  seed = await seedVolume(ctx.pool, DEFAULT_OWNER_ID);
  await ctx.app.listen(0);
  base = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
  const first = await fetch(`${base}/api/entries/expenses?month=${seed.months[seed.months.length - 2]}&page=1&pageSize=20`, { headers: auth() });
  lastExpensePage = ((await first.json()) as { pagination: { totalPages: number } }).pagination.totalPages;
});

afterAll(async () => {
  Reflect.set(pg.Client.prototype, 'query', originalQuery);
  const dir = resolve(process.cwd(), 'test/perf/results');
  mkdirSync(dir, { recursive: true });
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // fora de um repositorio git: segue sem o commit
  }
  const hardware = { cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length, memGiB: Math.round(totalmem() / 2 ** 30) };
  const file = resolve(dir, `rnf06-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ limitMs: LIMIT_MS, samples: SAMPLES, commit, hardware, results }, null, 2));
  console.table(
    results.map(({ scenario, p50, p95, max, indexes, seqScans }) => ({
      scenario, p50, p95, max, indices: indexes.join(', '), seqScan: seqScans.join(', '),
    })),
  );
  await ctx.close();
});

async function timed(method: string, url: string): Promise<number> {
  const start = performance.now();
  const res = await fetch(url, { method, headers: auth() });
  await res.arrayBuffer();
  const elapsed = performance.now() - start;
  expect(res.status, `${method} ${url}`).toBe(200);
  return elapsed;
}

interface CapturedQuery {
  text: string;
  values: unknown[];
}
interface PlanSummary {
  statement: string;
  indexes: string[];
  seqScans: string[];
  executionMs: number;
}

let capturing: CapturedQuery[] | null = null;
const originalQuery = Reflect.get(pg.Client.prototype, 'query') as (...a: unknown[]) => unknown;
/**
 * Os SQLs gerados pelo Prisma nao sao acessiveis, e pg_stat_user_indexes nao e confiavel (os backends do pool do app
 * descarregam estatisticas com atraso e o pg_stat_force_next_flush() so atua na propria sessao). Entao intercepta-se o
 * driver `pg` (o mesmo usado pelo adapter) durante a ultima amostra e roda-se EXPLAIN (ANALYZE, FORMAT JSON) de cada
 * SELECT/UPDATE que toca entries ou cards, com os mesmos parametros.
 */
function installCapture(): void {
  (pg.Client.prototype as unknown as { query: unknown }).query = function (this: pg.Client, ...args: unknown[]) {
    const first = args[0];
    const text = typeof first === 'string' ? first : (first as { text?: string } | undefined)?.text;
    const values = typeof first === 'string' ? args[1] : (first as { values?: unknown[] } | undefined)?.values;
    if (capturing && text && /^\s*(select|update|with)\b/i.test(text) && /\b(entries|cards)\b/i.test(text)) {
      capturing.push({ text, values: Array.isArray(values) ? values : [] });
    }
    return originalQuery.apply(this, args);
  };
}

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function walk(node: PlanNode, out: { indexes: Set<string>; seqScans: Set<string> }): void {
  if (node['Index Name']) out.indexes.add(node['Index Name']);
  if (node['Node Type'] === 'Seq Scan' && node['Relation Name']) out.seqScans.add(node['Relation Name']);
  for (const child of node.Plans ?? []) walk(child, out);
}

async function explain(queries: CapturedQuery[]): Promise<PlanSummary[]> {
  const summaries: PlanSummary[] = [];
  const client = await ctx.pool.connect();
  try {
    for (const { text, values } of queries) {
      await client.query('BEGIN');
      try {
        // timezone da sessao do app (UTC); EXPLAIN ANALYZE de UPDATE executa de fato, por isso o ROLLBACK
        await client.query("SET LOCAL timezone = 'UTC'");
        const res = await client.query<{ 'QUERY PLAN': { Plan: PlanNode; 'Execution Time': number }[] }>(
          `EXPLAIN (ANALYZE, FORMAT JSON) ${text}`,
          values,
        );
        const root = res.rows[0]['QUERY PLAN'][0];
        const out = { indexes: new Set<string>(), seqScans: new Set<string>() };
        walk(root.Plan, out);
        summaries.push({
          statement: text.replace(/\s+/g, ' ').slice(0, 160),
          indexes: [...out.indexes],
          seqScans: [...out.seqScans],
          executionMs: Math.round(root['Execution Time'] * 100) / 100,
        });
      } catch (error) {
        summaries.push({ statement: text.replace(/\s+/g, ' ').slice(0, 160), indexes: [], seqScans: [], executionMs: -1 });
        console.warn('EXPLAIN falhou:', (error as Error).message);
      } finally {
        await client.query('ROLLBACK');
      }
    }
  } finally {
    client.release();
  }
  return summaries;
}

async function measure(scenario: Scenario): Promise<Result> {
  for (let i = 0; i < WARMUP; i++) {
    const r = scenario.request(i);
    await timed(r.method, `${base}${r.path}`);
  }
  const samples: number[] = [];
  let captured: CapturedQuery[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const r = scenario.request(WARMUP + i);
    if (i === SAMPLES - 1) capturing = captured = [];
    samples.push(await timed(r.method, `${base}${r.path}`));
    capturing = null;
  }
  const plans = await explain(captured);
  const usedIndexes = [...new Set(plans.flatMap((p) => p.indexes))];
  const seqScans = [...new Set(plans.flatMap((p) => p.seqScans))];
  const result: Result = {
    scenario: scenario.name,
    p50: Math.round(percentile(samples, 0.5)),
    p95: Math.round(percentile(samples, 0.95)),
    max: Math.round(Math.max(...samples)),
    indexes: usedIndexes,
    seqScans,
    seqScanOnEntries: seqScans.includes('entries'),
    plans,
  };
  results.push(result);
  return result;
}

const month = () => seed.months[seed.months.length - 2]; // mes "cheio" (nao e a ponta da serie)
const q = (params: Record<string, string | number>) => new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString();

/** Fonte unica dos nomes: o it.each e os cenarios derivam desta lista (a massa so existe apos o beforeAll). */
const SCENARIO_NAMES = [
  'S1 resumo',
  'E2 pagina 1',
  'E2 ultima pagina',
  'E2 status',
  'E2 categoria',
  'E2 cartao',
  'E2 status+cartao',
  'E2 categoria+status',
  'E2 cardId=pix',
  'E3 receitas',
  'I1 faturas do mes',
  'I2 maior fatura',
  'I3 pagar fatura',
  'D2 serie mensal',
  'D3 distribuicao por categoria',
  'E6 categorias',
  'C2 cartoes',
] as const;
type ScenarioName = (typeof SCENARIO_NAMES)[number];

const scenarios = (): Scenario[] => {
  const m = month();
  const get = (name: ScenarioName, path: string): Scenario => ({ name, request: () => ({ method: 'GET', path }) });
  const card = seed.cardIds[0];
  const category = seed.categories[0];
  return [
    get('S1 resumo', `/api/summary?${q({ month: m })}`),
    get('E2 pagina 1', `/api/entries/expenses?${q({ month: m, page: 1, pageSize: 20 })}`),
    get('E2 ultima pagina', `/api/entries/expenses?${q({ month: m, page: lastExpensePage, pageSize: 20 })}`),
    get('E2 status', `/api/entries/expenses?${q({ month: m, status: 'PENDING' })}`),
    get('E2 categoria', `/api/entries/expenses?${q({ month: m, category })}`),
    get('E2 cartao', `/api/entries/expenses?${q({ month: m, cardId: card })}`),
    get('E2 status+cartao', `/api/entries/expenses?${q({ month: m, status: 'PENDING', cardId: card })}`),
    get('E2 categoria+status', `/api/entries/expenses?${q({ month: m, category, status: 'PAID' })}`),
    get('E2 cardId=pix', `/api/entries/expenses?${q({ month: m, cardId: 'pix' })}`),
    get('E3 receitas', `/api/entries/incomes?${q({ month: m })}`),
    get('I1 faturas do mes', `/api/invoices?${q({ month: m })}`),
    get('I2 maior fatura', `/api/cards/${seed.biggestInvoice.cardId}/invoices/${seed.biggestInvoice.referenceMonth}/entries`),
    {
      // I3 nao usa rollback: cada amostra paga uma fatura pendente diferente (ADR 0002 T4)
      name: 'I3 pagar fatura',
      request: (i) => {
        const inv = seed.pendingInvoices[i];
        return { method: 'POST', path: `/api/cards/${inv.cardId}/invoices/${inv.referenceMonth}/pay` };
      },
    },
    get('D2 serie mensal', `/api/dashboard/monthly-series?${q({ month: seed.months[seed.months.length - 1] })}`),
    get('D3 distribuicao por categoria', `/api/dashboard/category-distribution?${q({ month: m })}`),
    get('E6 categorias', '/api/categories'),
    get('C2 cartoes', '/api/cards'),
  ];
};

describe('RNF06 - p95 < 300 ms com 100 mil lancamentos e 20 cartoes', () => {
  it('a massa tem o volume exigido', async () => {
    const { rows } = await ctx.pool.query<{ entries: string; cards: string }>(
      `SELECT (SELECT count(*) FROM entries) AS entries, (SELECT count(*) FROM cards) AS cards`,
    );
    expect(Number(rows[0].entries)).toBe(100_000);
    expect(Number(rows[0].cards)).toBe(20);
    expect(seed.months.length).toBeGreaterThanOrEqual(12);
    expect(seed.pendingInvoices.length).toBeGreaterThanOrEqual(WARMUP + SAMPLES);
  });

  it.each(SCENARIO_NAMES)('%s: p95 < 300 ms', async (name) => {
    const scenario = scenarios().find((s) => s.name === name);
    if (!scenario) throw new Error(`cenario desconhecido: ${name}`);
    const result = await measure(scenario);
    expect(result.p95, `${name}: p95=${result.p95}ms p50=${result.p50}ms max=${result.max}ms`).toBeLessThan(LIMIT_MS);
  });
});
