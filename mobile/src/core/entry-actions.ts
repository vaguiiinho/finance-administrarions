import type { Capability, EntryDto } from '@/lib/api/types';

export interface EntryActions {
  pay: boolean;
  edit: boolean;
  remove: boolean;
}

/**
 * Acoes visiveis por linha (B6, DM12): editar/excluir so por capacidade `MANAGE_EXPENSES` e so em despesas; pagar em
 * despesas pendentes. Nunca le `role` nem `accountKind`.
 */
export function entryActions(entry: Pick<EntryDto, 'type' | 'status'>, capabilities: readonly Capability[]): EntryActions {
  if (entry.type !== 'EXPENSE') return { pay: false, edit: false, remove: false };
  const manage = capabilities.includes('MANAGE_EXPENSES');
  return { pay: entry.status === 'PENDING', edit: manage, remove: manage };
}
