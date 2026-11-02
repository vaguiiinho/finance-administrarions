import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';

export type MaintenanceSchedule =
  | { kind: 'interval' } // a cada MAINTENANCE_INTERVAL_MS
  | { kind: 'daily'; at: LocalTimeOfDay }; // horário civil de America/Sao_Paulo

export interface MaintenanceTask {
  readonly name: string;
  readonly schedule: MaintenanceSchedule;
  /** Pode devolver um resumo (contagens, nunca conteúdo) para o log. */
  run(): Promise<void | string>;
}
export const MAINTENANCE_TASKS = Symbol('MAINTENANCE_TASKS');
