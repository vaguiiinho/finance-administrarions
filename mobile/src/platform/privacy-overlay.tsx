import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

/** Cobertura de privacidade (P11): cobre a tela em `inactive`/`background`, sem desfoque; nenhum dado fica no seletor de apps. */
export function PrivacyOverlay() {
  const { palette } = useTheme();
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setCovered(next !== 'active'));
    return () => subscription.remove();
  }, []);
  if (!covered) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text variant="title2" tone="accent" style={{ fontFamily: undefined }}>
        Finanças Pessoais
      </Text>
    </View>
  );
}
