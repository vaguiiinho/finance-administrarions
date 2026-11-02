import { Stack } from 'expo-router';
import { RequireUser } from '@/features/session/session-provider';

export default function EditLayout() {
  return (
    <RequireUser>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireUser>
  );
}
