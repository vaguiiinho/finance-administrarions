import { Redirect } from 'expo-router';
import { currentYearMonthSP, formatCivilDate, formatInstant, formatInstantDate, todaySP } from '@/lib/dates/format';
import { Screen } from '@/ui/controls';
import { Text } from '@/ui/Text';

/**
 * Diagnostico de data e fuso no motor real (Hermes), ADR 0011 10.6 / CA15 / CA18. So existe no build `e2e`
 * (EXPO_PUBLIC_E2E=1); nos demais perfis a rota volta ao inicio. O fluxo Maestro confere os textos com TZ=UTC e Asia/Tokyo.
 */
export default function Diagnostics() {
  if (process.env.EXPO_PUBLIC_E2E !== '1') return <Redirect href="/" />;
  const instant = new Date('2026-12-01T01:30:00Z');
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Text variant="title3" accessibilityRole="header">
        Diagnóstico de datas
      </Text>
      <Text>{`mes: ${currentYearMonthSP(instant)}`}</Text>
      <Text>{`hoje: ${todaySP(instant)}`}</Text>
      <Text>{formatCivilDate('2026-11-01')}</Text>
      <Text>{formatInstantDate('2026-11-02T01:00:00Z')}</Text>
      <Text>{formatInstant('2026-12-01T01:30:00Z')}</Text>
    </Screen>
  );
}
