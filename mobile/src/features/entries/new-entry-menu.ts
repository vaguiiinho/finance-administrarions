import { ActionSheetIOS, Platform } from 'react-native';
import type { useRouter } from 'expo-router';

/** Folha de acoes nativa "Novo lancamento" (4.3): Despesa, Despesa parcelada, Receita. */
export function showNewEntryMenu(router: ReturnType<typeof useRouter>): void {
  const routes = ['/new/expense', '/new/installments', '/new/income'] as const;
  if (Platform.OS !== 'ios') {
    router.push(routes[0] as never);
    return;
  }
  ActionSheetIOS.showActionSheetWithOptions(
    { title: 'Novo lançamento', options: ['Despesa', 'Despesa parcelada', 'Receita', 'Cancelar'], cancelButtonIndex: 3 },
    (index) => {
      if (index < routes.length) router.push(routes[index] as never);
    },
  );
}
