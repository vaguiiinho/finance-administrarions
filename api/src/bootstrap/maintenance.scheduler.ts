import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Clock } from '@shared/application/ports/clock.js';
import type { DailyTimeCalculator } from '@shared/application/ports/daily-time-calculator.js';
import type { MaintenanceTask } from './maintenance-task.js';

type DailyTask = MaintenanceTask & { schedule: { kind: 'daily' } };

/**
 * Manutenção (ADR 0005 7.6, ADR 0011 5.4): tarefas `interval` num único setInterval e tarefas `daily` num setTimeout
 * para o próximo horário de São Paulo. `intervalMs <= 0` desliga tudo. Cada tarefa tem o próprio try/catch.
 */
export class MaintenanceScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceScheduler.name);
  private interval: NodeJS.Timeout | null = null;
  private readonly dailyTimers = new Map<string, NodeJS.Timeout>();
  private stopped = false;
  private started = false;

  constructor(
    private readonly intervalMs: number,
    private readonly tasks: readonly MaintenanceTask[],
    private readonly clock: Clock,
    private readonly dailyTime: DailyTimeCalculator,
  ) {}

  /**
   * Início EXPLÍCITO: chamado só pelo `main.ts` (processo HTTP). Contextos sem HTTP (`run-seed`, `recover-admin`) criam o
   * `AppModule` mas nunca chamam `start()`, então não registram nem executam tarefas (ADR 0011 5.4).
   */
  start(): void {
    if (this.started || this.intervalMs <= 0) return;
    this.started = true;
    const intervalTasks = this.tasks.filter((t) => t.schedule.kind === 'interval');
    if (intervalTasks.length > 0) {
      this.interval = setInterval(() => void this.runAll(intervalTasks), this.intervalMs);
      this.interval.unref();
    }
    const dailyTasks = this.tasks.filter((t): t is DailyTask => t.schedule.kind === 'daily');
    // Recuperação no boot: segura porque a tarefa diária usa um corte e é idempotente.
    if (dailyTasks.length > 0) void this.runAll(dailyTasks);
    for (const task of dailyTasks) this.scheduleDaily(task);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    for (const timer of this.dailyTimers.values()) clearTimeout(timer);
    this.dailyTimers.clear();
  }

  /** Roda as tarefas `interval` uma vez, na ordem. Nunca lança. */
  async runOnce(): Promise<void> {
    await this.runAll(this.tasks.filter((t) => t.schedule.kind === 'interval'));
  }

  private scheduleDaily(task: DailyTask): void {
    if (this.stopped) return;
    const now = this.clock.now();
    const delay = Math.max(0, this.dailyTime.nextOccurrence(now, task.schedule.at).getTime() - now.getTime());
    const timer = setTimeout(() => {
      void this.runTask(task).finally(() => this.scheduleDaily(task));
    }, delay);
    timer.unref();
    this.dailyTimers.set(task.name, timer);
  }

  private async runAll(tasks: readonly MaintenanceTask[]): Promise<void> {
    for (const task of tasks) await this.runTask(task);
  }

  /** Nunca lança: uma falha não derruba o processo nem impede as outras tarefas ou a próxima execução. */
  private async runTask(task: MaintenanceTask): Promise<void> {
    try {
      const summary = await task.run();
      if (summary) this.logger.log(`${task.name}: ${summary}`);
    } catch (error) {
      this.logger.error(`Manutenção "${task.name}" falhou: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
