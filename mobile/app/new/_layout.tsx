import { Stack } from 'expo-router';
import { RequireUser } from '@/features/session/session-provider';

/** Folha modal de criacao (4.1). O cabecalho (Cancelar / titulo) e do proprio formulario. */
export default function NewLayout() {
  return (
    <RequireUser>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireUser>
  );
}
