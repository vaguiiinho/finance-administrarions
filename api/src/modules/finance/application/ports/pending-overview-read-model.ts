import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';

// Port do ADR 0007 5.1 (so tipos e token; sem logica).
export interface PendingOverview {
  firstPendingMonth: ReferenceMonth | null;
  oldestPendingCardMonth: ReferenceMonth | null;
  hasCard: boolean;
}

export interface PendingOverviewReadModel {
  /** Pendências a partir de `from`, faturas de cartão pendentes em qualquer mês e existência de cartão, em uma consulta. */
  overviewFrom(ownerId: OwnerId, from: ReferenceMonth): Promise<PendingOverview>;
}

export const PENDING_OVERVIEW_READ_MODEL = Symbol('PENDING_OVERVIEW_READ_MODEL');
