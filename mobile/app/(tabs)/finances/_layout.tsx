import { Stack } from 'expo-router';
import { useTheme } from '@/ui/theme';

export default function FinancesLayout() {
  const { palette } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerStyle: { backgroundColor: palette.bg },
        headerLargeStyle: { backgroundColor: palette.bg },
        headerTintColor: palette.accent,
        headerTitleStyle: { color: palette.text },
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Finanças' }} />
      <Stack.Screen name="invoice/[cardId]/[referenceMonth]" options={{ title: 'Fatura', headerLargeTitle: true, headerBackTitle: 'Finanças' }} />
    </Stack>
  );
}
