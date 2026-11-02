import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isDemoAccount } from '@/core/account-kind';
import { DEMO_CLEANUP_TEXT, DEMO_PASSWORD_UNAVAILABLE_TEXT, PASSWORD_UNAVAILABLE_TEXT } from '@/core/messages';
import { userInitial } from '@/core/initial';
import { versionLabel } from '@/platform/app-info';
import { privacyUrl, supportUrl } from '@/platform/config';
import { externalBrowser } from '@/platform/external-browser';
import { useMe, useSession } from '@/features/session/session-provider';
import { Button, Card, Divider, Screen, Segmented } from '@/ui/controls';
import { Text } from '@/ui/Text';
import { useTheme, type ThemePreference } from '@/ui/theme';
import { MIN_TOUCH, space } from '@/ui/tokens';

function Row({
  title,
  subtitle,
  value,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const rowStyle = {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  } as const;
  // Linha informativa (ex.: Versao): nao e um botao.
  if (!onPress && !disabled) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel ?? `${title}${value ? ` ${value}` : ''}`} style={rowStyle}>
        <Text>{title}</Text>
        {value ? <Text tone="muted">{value}</Text> : null}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, indisponível. ${subtitle}.` : title)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={rowStyle}
    >
      <View style={{ flex: 1 }}>
        <Text tone={disabled ? 'disabled' : 'text'}>{title}</Text>
        {subtitle ? (
          <Text variant="footnote" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text tone="muted">{value}</Text>
      ) : disabled ? null : (
        <Text tone="muted" accessible={false}>
          ›
        </Text>
      )}
    </Pressable>
  );
}

export default function Settings() {
  const me = useMe();
  const { logout } = useSession();
  const router = useRouter();
  const { palette, preference, setPreference } = useTheme();
  const demo = isDemoAccount(me);
  const canChangePassword = me.capabilities.includes('CHANGE_OWN_PASSWORD');

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }}
            accessible={false}
          >
            <Text variant="title3" tone="onPrimary">
              {userInitial(me.name)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline">{me.name}</Text>
            <Text variant="subheadline" tone="muted">
              {me.email}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: space.xs }}>
        <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
          Conta
        </Text>
        <Card>
          {canChangePassword ? (
            <Row title="Trocar senha" onPress={() => router.push('/settings/change-password' as never)} />
          ) : (
            <Row title="Trocar senha" subtitle={demo ? DEMO_PASSWORD_UNAVAILABLE_TEXT : PASSWORD_UNAVAILABLE_TEXT} disabled />
          )}
        </Card>
        {demo ? (
          <Text variant="footnote" tone="muted">
            {DEMO_CLEANUP_TEXT}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: space.xs }}>
        <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
          Aparência
        </Text>
        <Card>
          <Text>Tema</Text>
          <Segmented<ThemePreference>
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </Card>
      </View>

      <View style={{ gap: space.xs }}>
        <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
          Sobre
        </Text>
        <Card>
          <Row title="Política de privacidade" onPress={() => void externalBrowser.open(privacyUrl())} />
          <Divider />
          <Row title="Suporte" onPress={() => void externalBrowser.open(supportUrl())} />
          <Divider />
          <Row title="Versão" value={versionLabel()} accessibilityLabel={`Versão ${versionLabel()}`} onPress={undefined} disabled={false} />
        </Card>
        <Text variant="footnote" tone="muted">
          Perfil e cartões são gerenciados no site.
        </Text>
      </View>

      <Button title="Sair" kind="destructive" onPress={() => void logout()} />
    </Screen>
  );
}
