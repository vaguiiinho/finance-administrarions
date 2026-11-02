import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from './controls';
import { Text } from './Text';
import { useTheme } from './theme';
import { space } from './tokens';

/** Estado de tela inteira (erro, vazio, atualizacao, sem conexao): icone, titulo, texto e acoes. */
export function ScreenState({
  icon,
  title,
  message,
  children,
  testID,
}: {
  icon?: string;
  title: string;
  message?: string;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      {icon ? (
        <Text variant="largeTitle" tone="accent" accessible={false} importantForAccessibility="no">
          {icon}
        </Text>
      ) : null}
      <Text variant="title2" center accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text center tone="muted">
          {message}
        </Text>
      ) : null}
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.sm }}>{children}</View>
    </View>
  );
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  const { palette } = useTheme();
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" style={{ padding: space.xl, alignItems: 'center' }}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

/** Bloco com falha isolada: mensagem + "Tentar novamente". */
export function BlockError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text tone="danger" accessibilityRole="alert">
        {message}
      </Text>
      <Button title="Tentar novamente" kind="secondary" onPress={onRetry} fullWidth={false} />
    </View>
  );
}

export function Skeleton({ height = 72 }: { height?: number }) {
  const { palette } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, borderRadius: 12, backgroundColor: palette.surface2 }} />
  );
}
