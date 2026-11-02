import { RequireUser } from '@/features/session/session-provider';
import { Tabs } from 'expo-router';
import { useTheme } from '@/ui/theme';

/** Abas: Dashboard, Financas e Ajustes. Cada aba tem a propria pilha nativa (titulo grande). */
export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <RequireUser>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.accent,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarAccessibilityLabel: 'Dashboard' }} />
        <Tabs.Screen name="finances" options={{ title: 'Finanças', tabBarAccessibilityLabel: 'Finanças' }} />
        <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarAccessibilityLabel: 'Ajustes' }} />
      </Tabs>
    </RequireUser>
  );
}
