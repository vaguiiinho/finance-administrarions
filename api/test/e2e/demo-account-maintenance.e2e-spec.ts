import { MAINTENANCE_TASKS, type MaintenanceTask } from '../../src/bootstrap/maintenance-task.js';
import { ResetOwnerData } from '@finance/application/use-cases/maintenance/reset-owner-data.js';
import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { insertOwnedEntry } from '../support/owned-db.js';
import { SHOWCASE_E2E_PASSWORD, startShowcaseE2e, type ShowcaseE2e } from '../support/showcase-e2e.js';

/**
 * Tarefas de manutencao registradas na raiz de composicao (ADR 0013 5.6; RF04, RF16, CA05, CA21, CA27, R7).
 * Roda as tarefas REAIS do AppModule sobre o Postgres do container, com o relogio controlado.
 */
const D1 = '01900000-0000-7000-8000-0000000000d1';
const SP = (hhmm: string, day = '2026-11-15') => new Date(`${day}T${hhmm}:00.000-03:00`);

let e: ShowcaseE2e;
beforeAll(async () => {
  e = await startShowcaseE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  e.clock.set(SP('01:00', '2026-11-14'));
  await e.provision(SHOWCASE_E2E_PASSWORD);
});

const tasks = () => e.app.get<MaintenanceTask[]>(MAINTENANCE_TASKS);
const task = (name: string) => {
  const found = tasks().find((t) => t.name === name);
  if (!found) throw new Error(`tarefa ${name} nao registrada`);
  return found;
};
const resetter = () => e.app.get(ResetOwnerData, { strict: false });
const seedLikeSeed = () => resetter().execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: { kind: 'sample-stale' } });
const descriptions = async () =>
  (await e.pool.query('SELECT description FROM entries WHERE user_id = $1::uuid', [SHOWCASE_USER_ID])).rows.map((r) => r.description as string);

describe('registro das tarefas (RF04, RF16)', () => {
  it('sai o que gerava a demonstracao publica e a limpeza antiga; entra reset-demo-account diaria as 03:00; fica purge-expired-sessions', () => {
    const names = tasks().map((t) => t.name);
    expect(names).not.toContain('ensure-demo-user');
    expect(names).not.toContain('refresh-demo-dataset');
    expect(names).not.toContain('purge-showcase-data');
    expect(names).toContain('purge-expired-sessions');
    const reset = task('reset-demo-account');
    expect(reset.schedule).toMatchObject({ kind: 'daily' });
    const at = (reset.schedule as { at: { hour: number; minute: number } }).at;
    expect([at.hour, at.minute]).toEqual([3, 0]);
  });
});

describe('CA05: nada recria a demonstracao publica', () => {
  it('seed + todas as tarefas (startup e interval): o usuario DEMO_USER_ID nao existe e nao ha dados dele', async () => {
    await seedLikeSeed();
    for (const t of tasks()) await t.run(t.schedule.kind === 'daily' ? 'startup' : 'interval');
    for (const t of tasks()) await t.run(t.schedule.kind === 'daily' ? 'daily-timer' : 'interval');
    for (const table of ['users WHERE id', 'entries WHERE user_id', 'cards WHERE user_id']) {
      expect(Number((await e.pool.query(`SELECT count(*) AS c FROM ${table} = $1::uuid`, [D1])).rows[0].c), table).toBe(0);
    }
  });
});

describe('recuperacao na subida (R7, CA27) e execucao agendada (CA18)', () => {
  it('R7: a subida (startup) no meio do dia, depois da redefinicao das 03:00, NAO apaga o que quem esta testando criou', async () => {
    e.clock.set(SP('03:00'));
    await seedLikeSeed(); // last_reset_at = 03:00 de 15/11
    await insertOwnedEntry(e.pool, SHOWCASE_USER_ID, { n: 9001, description: 'Criado as 10h por quem testa' });
    e.clock.set(SP('15:00'));
    await task('reset-demo-account').run('startup');
    expect(await descriptions()).toContain('Criado as 10h por quem testa');
  });

  it('CA27: API fora do ar as 03:00; ao subir as 04:00 a redefinicao perdida e recuperada (dados de ontem somem; dataset volta)', async () => {
    e.clock.set(SP('03:00', '2026-11-14'));
    await seedLikeSeed();
    await insertOwnedEntry(e.pool, SHOWCASE_USER_ID, { n: 9002, description: 'Teste de ontem a tarde' });
    e.clock.set(SP('04:00', '2026-11-15'));
    await task('reset-demo-account').run('startup');
    const after = await descriptions();
    expect(after).not.toContain('Teste de ontem a tarde');
    expect(after.length).toBeGreaterThan(10); // dataset de exemplo restaurado
  });

  it('CA18: o disparo do timer das 03:00 (daily-timer) redefine; uma segunda chamada no mesmo minuto nao repete (idempotencia por condicao)', async () => {
    e.clock.set(SP('03:00', '2026-11-14'));
    await seedLikeSeed();
    await insertOwnedEntry(e.pool, SHOWCASE_USER_ID, { n: 9003, description: 'Teste visitante' });
    e.clock.set(SP('03:00', '2026-11-15'));
    await task('reset-demo-account').run('daily-timer');
    expect(await descriptions()).not.toContain('Teste visitante');
    await insertOwnedEntry(e.pool, SHOWCASE_USER_ID, { n: 9004, description: 'Logo depois das 03:00' });
    await task('reset-demo-account').run('startup');
    expect(await descriptions()).toContain('Logo depois das 03:00');
  });

  it('CA29: 03:00 de 2026-12-01 re-ancora o dataset em 2026-12 (12 meses de 2026-01 a 2026-12, mais 2027-01)', async () => {
    e.clock.set(SP('03:00', '2026-11-30'));
    await seedLikeSeed();
    e.clock.set(SP('03:00', '2026-12-01'));
    await task('reset-demo-account').run('daily-timer');
    const months = (await e.pool.query(`SELECT DISTINCT to_char(reference_month, 'YYYY-MM') AS m FROM entries WHERE user_id = $1::uuid ORDER BY 1`, [SHOWCASE_USER_ID])).rows.map((r) => r.m as string);
    expect(months[0]).toBe('2026-01');
    expect(months[months.length - 1]).toBe('2027-01');
    expect(months).not.toContain('2025-12');
  });

  it('CA28: com a conta desabilitada a tarefa apaga o que existir, nao grava dataset e nao reativa a conta', async () => {
    e.clock.set(SP('03:00', '2026-11-14'));
    await seedLikeSeed();
    await e.provision(null);
    e.clock.set(SP('03:00', '2026-11-15'));
    await task('reset-demo-account').run('daily-timer');
    expect((await descriptions()).length).toBe(0);
    expect((await e.pool.query('SELECT status FROM users WHERE id = $1::uuid', [SHOWCASE_USER_ID])).rows[0].status).toBe('INACTIVE');
  });

  it('conta demo ausente: a tarefa nao falha nem cria nada', async () => {
    await e.resetAll();
    await expect(task('reset-demo-account').run('startup')).resolves.not.toThrow();
    expect(Number((await e.pool.query('SELECT count(*) AS c FROM entries')).rows[0].c)).toBe(0);
  });
});
