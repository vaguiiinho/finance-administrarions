import { Logger } from '@nestjs/common';
import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { FakeDailyTimeCalculator } from '@test/fakes/maintenance-fakes.js';
import { unwrap } from '@test/support/result.js';
import { MaintenanceScheduler } from './maintenance.scheduler.js';
import type { MaintenanceTask, MaintenanceTrigger } from './maintenance-task.js';

/**
 * Gatilho passado a tarefa (ADR 0013 5.6, S6): o agendador diz POR QUE esta chamando (`startup` na recuperacao do boot,
 * `daily-timer` no horario, `interval` no tick), e a decisao de pular e da tarefa. Complementa maintenance.scheduler.spec.ts.
 */
const HOUR = 3_600_000;
const at3 = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse('03:00'));
const clock = { now: () => new Date() };

function recorder(name: string, schedule: MaintenanceTask['schedule'], seen: { name: string; trigger: MaintenanceTrigger; at: string }[], fail = false): MaintenanceTask {
  return {
    name,
    schedule,
    run: async (trigger: MaintenanceTrigger) => {
      seen.push({ name, trigger, at: new Date().toISOString() });
      if (fail) throw new Error('falha');
    },
  } as MaintenanceTask;
}
const build = (tasks: MaintenanceTask[], intervalMs = HOUR) => new MaintenanceScheduler(intervalMs, tasks, clock, new FakeDailyTimeCalculator() as never);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T05:00:00.000Z')); // 02:00 em Sao Paulo
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MaintenanceScheduler: gatilho da tarefa (ADR 0013 5.6)', () => {
  it('a tarefa diaria recebe `startup` no start() (recuperacao) e `daily-timer` no 03:00 de Sao Paulo (06:00Z)', async () => {
    const seen: { name: string; trigger: MaintenanceTrigger; at: string }[] = [];
    const s = build([recorder('reset-demo-account', { kind: 'daily', at: at3 }, seen)]);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.map((x) => x.trigger)).toEqual(['startup']);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(seen.map((x) => x.trigger)).toEqual(['startup', 'daily-timer']);
    expect(seen[1].at).toBe('2026-11-03T06:00:00.000Z');
    s.onModuleDestroy();
  });

  it('o 03:00 do dia seguinte tambem chega como `daily-timer`', async () => {
    const seen: { name: string; trigger: MaintenanceTrigger; at: string }[] = [];
    const s = build([recorder('reset-demo-account', { kind: 'daily', at: at3 }, seen)]);
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR + 24 * HOUR);
    expect(seen.map((x) => x.trigger)).toEqual(['startup', 'daily-timer', 'daily-timer']);
    s.onModuleDestroy();
  });

  it('tarefas `interval` recebem `interval` a cada tick', async () => {
    const seen: { name: string; trigger: MaintenanceTrigger; at: string }[] = [];
    const s = build([recorder('sessions', { kind: 'interval' }, seen)]);
    s.start();
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(seen.map((x) => x.trigger)).toEqual(['interval', 'interval']);
    s.onModuleDestroy();
  });

  it('runOnce (tarefas interval) tambem informa `interval`', async () => {
    const seen: { name: string; trigger: MaintenanceTrigger; at: string }[] = [];
    const s = build([recorder('sessions', { kind: 'interval' }, seen), recorder('reset', { kind: 'daily', at: at3 }, seen)]);
    await s.runOnce();
    expect(seen).toEqual([expect.objectContaining({ name: 'sessions', trigger: 'interval' })]);
  });

  it('falha da tarefa diaria no boot nao impede o 03:00 seguinte, que chega como `daily-timer` (CA21: a proxima execucao tenta de novo)', async () => {
    const seen: { name: string; trigger: MaintenanceTrigger; at: string }[] = [];
    const s = build([recorder('reset-demo-account', { kind: 'daily', at: at3 }, seen, true)]);
    s.start();
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(seen.map((x) => x.trigger)).toEqual(['startup', 'daily-timer']);
    s.onModuleDestroy();
  });

  it('o resumo devolvido pela tarefa continua indo para o log com o NOME da tarefa', async () => {
    const logs: string[] = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((m: unknown) => void logs.push(String(m)));
    const task: MaintenanceTask = { name: 'reset-demo-account', schedule: { kind: 'daily', at: at3 }, run: async () => 'apagados: 1 lancamentos' };
    const s = build([task]);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(logs.some((l) => l.includes('reset-demo-account') && l.includes('apagados: 1 lancamentos'))).toBe(true);
    s.onModuleDestroy();
  });
});
