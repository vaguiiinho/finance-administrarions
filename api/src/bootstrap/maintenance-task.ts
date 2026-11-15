import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';

export type MaintenanceSchedule =
  | { kind: 'interval' } // a cada MAINTENANCE_INTERVAL_MS
  | { kind: 'daily'; at: LocalTimeOfDay }; // horário civil de America/Sao_Paulo

/** Por que o agendador está chamando a tarefa (só para a origem do log; ADR 0013 5.6). */
export type MaintenanceTrigger = 'interval' | 'daily-timer' | 'startup';

export interface MaintenanceTask {
  readonly name: string;
  readonly schedule: MaintenanceSchedule;
  /**
   * Contrato das tarefas `daily`: precisam ser seguras para rodar no `start()` (recuperação) e repetidas; a decisão de
   * pular é da tarefa, não do agendador. Pode devolver um resumo (contagens, nunca conteúdo) para o log.
   */
  run(trigger: MaintenanceTrigger): Promise<void | string>;
}
export const MAINTENANCE_TASKS = Symbol('MAINTENANCE_TASKS');
