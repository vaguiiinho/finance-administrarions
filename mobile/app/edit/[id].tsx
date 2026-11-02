import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ENTRY_NOT_FOUND_TEXT } from '@/core/messages';
import { currentYearMonthSP } from '@/lib/dates/format';
import type { EntryDto } from '@/lib/api/types';
import { EntryForm } from '@/features/entries/entry-form';
import { useDismiss } from '@/features/navigation';
import { useSession } from '@/features/session/session-provider';
import { Button, Screen } from '@/ui/controls';
import { Loading, ScreenState } from '@/ui/states';

/** Procura a despesa no cache das listas (a API nao tem GET por id). */
function findCached(queryClient: ReturnType<typeof useQueryClient>, id: string): EntryDto | null {
  for (const [, data] of queryClient.getQueriesData<{ pages: { items: EntryDto[] }[] }>({ queryKey: ['expenses'] })) {
    const hit = data?.pages?.flatMap((p) => p.items).find((e) => e.id === id);
    if (hit) return hit;
  }
  for (const [, data] of queryClient.getQueriesData<EntryDto[]>({ queryKey: ['invoice-entries'] })) {
    const hit = data?.find((e) => e.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Editar despesa (B3, B6): reaproveita o formulario de criacao. */
export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { api } = useSession();
  const dismiss = useDismiss();
  const cached = findCached(queryClient, id);

  // Abertura sem cache (link direto): busca o mes inicial e procura a despesa nele.
  const lookup = useQuery({
    queryKey: ['entry-lookup', id],
    enabled: cached === null,
    retry: false,
    queryFn: async () => {
      const decision = await api.initialMonth().catch(() => null);
      const page = await api.expenses(decision?.month ?? currentYearMonthSP(), {}, 1, undefined, 100);
      return page.items.find((e) => e.id === id) ?? null;
    },
  });

  const entry = cached ?? lookup.data ?? null;
  if (entry) return <EntryForm mode="edit" entry={entry} />;
  if (cached === null && lookup.isPending)
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  return (
    <Screen scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenState title="Despesa não encontrada" message={ENTRY_NOT_FOUND_TEXT}>
        <Button title="Fechar" onPress={dismiss} />
      </ScreenState>
    </Screen>
  );
}
