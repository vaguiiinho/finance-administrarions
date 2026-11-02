import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { FakeDailyTimeCalculator } from '@test/fakes/maintenance-fakes.js';
import { unwrap } from '@test/support/result.js';
import { MaintenanceScheduler } from './maintenance.scheduler.js';
import type { MaintenanceTask } from './maintenance-task.js';

const HOUR = 3_600_000;
const at3 = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse('03:00'));
const clock = { now: () => new Date() };

function task(name: string, schedule: MaintenanceTask['schedule'], log: string[], fail = false): MaintenanceTask {
  return {
    name,
    schedule,
    run: async () => {
      log.push(`${name}@${new Date().toISOString()}`);
      if (fail) throw new Error(`falha em ${name}`);
    },
  };
}
const build = (intervalMs: number, tasks: MaintenanceTask[]) =>
  new MaintenanceScheduler(intervalMs, tasks, clock, new FakeDailyTimeCalculator() as never);

let errors: string[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T05:00:00.000Z')); // 02:00 em Sao Paulo
  errors = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((m: unknown) => void errors.push(String(m)));
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MaintenanceScheduler (ADR 0011 5.4, S9)', () => {
  it('intervalMs = 0 desliga TODAS as tarefas, inclusive as diarias (nem a recuperacao no boot)', async () => {
    const log: string[] = [];
    const s = build(0, [task('sessions', { kind: 'interval' }, log), task('purge', { kind: 'daily', at: at3 }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(48 * HOUR);
    expect(log).toEqual([]);
    s.onModuleDestroy();
  });

  it('I5: sem start() (contexto do seed/recover-admin) nada e registrado nem executado, nem a recuperacao do boot', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('sessions', { kind: 'interval' }, log), task('purge', { kind: 'daily', at: at3 }, log)]);
    await vi.advanceTimersByTimeAsync(48 * HOUR);
    expect(log).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    s.onModuleDestroy();
  });

  it('I5: start() duas vezes nao duplica timers', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('A', { kind: 'interval' }, log)]);
    s.start();
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(log).toHaveLength(1);
    s.onModuleDestroy();
  });

  it('I5: apenas o main.ts (processo HTTP) inicia o agendador; seed e recover-admin nao', () => {
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
    expect(read('../main.ts')).toMatch(/MaintenanceScheduler\)\.start\(\)/);
    for (const file of ['./seed/run-seed.ts', './scripts/recover-admin.ts']) {
      expect(read(file), file).not.toMatch(/MaintenanceScheduler|\.start\(\)/);
    }
  });

  it('tarefas interval rodam em ordem a cada tick', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('A', { kind: 'interval' }, log), task('B', { kind: 'interval' }, log), task('C', { kind: 'interval' }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(log.map((l) => l.split('@')[0])).toEqual(['A', 'B', 'C']);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(log.map((l) => l.split('@')[0])).toEqual(['A', 'B', 'C', 'A', 'B', 'C']);
    s.onModuleDestroy();
  });

  it('tarefa daily roda UMA vez no boot (recuperacao) e de novo exatamente no proximo 03:00 de Sao Paulo (06:00Z)', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('purge', { kind: 'daily', at: at3 }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(HOUR - 1_000); // 05:59:59Z
    expect(log).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000); // 06:00:00Z
    expect(log).toHaveLength(2);
    expect(log[1]).toBe('purge@2026-11-03T06:00:00.000Z');
    s.onModuleDestroy();
  });

  it('reagenda a daily a partir de um novo now: proxima execucao 24 h depois, sem acumular deriva', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('purge', { kind: 'daily', at: at3 }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR + 1_000 + 24 * HOUR);
    expect(log.map((l) => l.split('@')[1])).toEqual(['2026-11-03T05:00:00.000Z', '2026-11-03T06:00:00.000Z', '2026-11-04T06:00:00.000Z']);
    s.onModuleDestroy();
  });

  it('daily nao roda em outro horario do dia (ex.: 03:00 UTC)', async () => {
    const log: string[] = [];
    vi.setSystemTime(new Date('2026-11-03T02:00:00.000Z'));
    const s = build(HOUR, [task('purge', { kind: 'daily', at: at3 }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    const afterBoot = log.length;
    await vi.advanceTimersByTimeAsync(2 * HOUR); // passa por 03:00Z
    expect(log).toHaveLength(afterBoot);
    s.onModuleDestroy();
  });

  it('a falha de uma tarefa nao impede as outras nem a proxima execucao, e o log traz o NAME', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('ruim', { kind: 'interval' }, log, true), task('boa', { kind: 'interval' }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(log.filter((l) => l.startsWith('boa'))).toHaveLength(2);
    expect(log.filter((l) => l.startsWith('ruim'))).toHaveLength(2);
    expect(errors.some((m) => m.includes('ruim'))).toBe(true);
    s.onModuleDestroy();
  });

  it('falha na daily nao derruba o processo e ela e reagendada', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('purge', { kind: 'daily', at: at3 }, log, true)]);
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR + 24 * HOUR);
    expect(log.length).toBeGreaterThanOrEqual(3);
    s.onModuleDestroy();
  });

  it('onModuleDestroy limpa os timers: nada roda depois', async () => {
    const log: string[] = [];
    const s = build(HOUR, [task('A', { kind: 'interval' }, log), task('purge', { kind: 'daily', at: at3 }, log)]);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    s.onModuleDestroy();
    const count = log.length;
    await vi.advanceTimersByTimeAsync(72 * HOUR);
    expect(log).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
  });
});
