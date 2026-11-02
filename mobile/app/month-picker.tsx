import { RequireUser } from '@/features/session/session-provider';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { currentYearMonthSP, isYearMonth } from '@/lib/dates/format';
import { useDismiss } from '@/features/navigation';
import { useViewState } from '@/features/view-state/view-state';
import { Button, Screen } from '@/ui/controls';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, radius, space } from '@/ui/tokens';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Folha de escolha de mes (6.8): ano com ‹ › e grade 3 x 4. */
function MonthPickerContent() {
  const { target, value } = useLocalSearchParams<{ target?: string; value?: string }>();
  const { setDashboardMonth, setFinancesMonth } = useViewState();
  const dismiss = useDismiss();
  const { palette } = useTheme();
  const current = currentYearMonthSP();
  const selected = value && isYearMonth(value) ? value : current;
  const [year, setYear] = useState(Number(selected.slice(0, 4)));

  const choose = (month: string) => {
    if (target === 'dashboard') setDashboardMonth(month);
    else setFinancesMonth(month);
    dismiss();
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button title="Ano anterior" accessibilityLabel="Ano anterior" kind="tertiary" fullWidth={false} onPress={() => setYear((y) => y - 1)} />
        <Text variant="title3" tabular accessibilityRole="header">{`${year}`}</Text>
        <Button title="Próximo ano" accessibilityLabel="Próximo ano" kind="tertiary" fullWidth={false} onPress={() => setYear((y) => y + 1)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {MONTHS.map((label, index) => {
          const ym = `${year}-${String(index + 1).padStart(2, '0')}`;
          const isSelected = ym === selected;
          return (
            <Pressable
              key={ym}
              accessibilityRole="button"
              accessibilityLabel={`${label} de ${year}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => choose(ym)}
              style={{
                width: '31%',
                minHeight: MIN_TOUCH + 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: ym === current ? 2 : 1,
                borderColor: ym === current ? palette.accent : palette.border,
                backgroundColor: isSelected ? palette.primary : palette.surface,
              }}
            >
              <Text variant="headline" tone={isSelected ? 'onPrimary' : 'text'} accessible={false}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button title="Mês atual" kind="secondary" onPress={() => choose(current)} />
    </Screen>
  );
}

export default function MonthPicker() {
  return (
    <RequireUser>
      <MonthPickerContent />
    </RequireUser>
  );
}
