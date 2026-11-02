import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorBoundary } from 'expo-router';
import { INVALID_CREDENTIALS_TEXT, NETWORK_TEXT, RATE_LIMITED_TEXT, SESSION_EXPIRED_TEXT, GENERIC_ERROR_TEXT } from '@/core/messages';
import type { ClassifiedError } from '@/core/api-errors';
import { fieldIssueMessage } from '@/core/api-errors';
import { externalBrowser } from '@/platform/external-browser';
import { privacyUrl, supportUrl } from '@/platform/config';
import { useSession } from '@/features/session/session-provider';
import { Button, Field, InlineAlert, PasswordField, Screen, type TextInputRef } from '@/ui/controls';
import { Text } from '@/ui/Text';
import { space } from '@/ui/tokens';

export { ErrorBoundary };

function bannerFor(error: ClassifiedError): string | null {
  switch (error.kind) {
    case 'INVALID_CREDENTIALS':
      return INVALID_CREDENTIALS_TEXT;
    case 'RATE_LIMITED':
      return RATE_LIMITED_TEXT(error.retryAfterMinutes ?? 1);
    case 'NETWORK':
    case 'TIMEOUT':
      return NETWORK_TEXT;
    case 'VALIDATION':
      return null;
    default:
      return GENERIC_ERROR_TEXT;
  }
}

export default function LoginScreen() {
  const { login, sessionExpiredNotice, lastEmail } = useSession();
  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const passwordRef = useRef<TextInputRef>(null);

  const submit = async () => {
    if (submitting.current) return; // envio duplo: um unico POST
    setBanner(null);
    const missingEmail = !email.trim();
    const missingPassword = !password;
    setEmailError(missingEmail ? 'Informe o e-mail.' : null);
    setPasswordError(missingPassword ? 'Informe a senha.' : null);
    if (missingEmail || missingPassword) return;
    submitting.current = true;
    setBusy(true);
    const outcome = await login(email.trim(), password);
    // Sucesso: a tela sai de cena (guarda da sessao); o botao fica travado ate la, sem segundo envio.
    if (outcome.ok) return;
    submitting.current = false;
    setBusy(false);
    if (outcome.error.kind === 'INVALID_CREDENTIALS') setPassword('');
    if (outcome.error.kind === 'VALIDATION') {
      for (const issue of outcome.error.fields ?? []) {
        if (issue.field === 'email') setEmailError(fieldIssueMessage(issue));
        if (issue.field === 'password') setPasswordError(fieldIssueMessage(issue));
      }
    }
    setBanner(bannerFor(outcome.error));
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.xl }}>
        <Text variant="title3" accessibilityRole="header">
          Finanças Pessoais
        </Text>
      </View>
      {sessionExpiredNotice ? <InlineAlert tone="info">{SESSION_EXPIRED_TEXT}</InlineAlert> : null}
      {banner ? <InlineAlert>{banner}</InlineAlert> : null}
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        editable={!busy}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordField
        ref={passwordRef}
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        editable={!busy}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button title="Entrar" busy={busy} busyTitle="Entrando…" onPress={() => void submit()} />
      <Text variant="footnote" tone="muted" center>
        Não tem acesso ou esqueceu a senha? Fale com um administrador.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, flexWrap: 'wrap' }}>
        <Button title="Política de privacidade" kind="tertiary" fullWidth={false} onPress={() => void externalBrowser.open(privacyUrl())} />
        <Button title="Suporte" kind="tertiary" fullWidth={false} onPress={() => void externalBrowser.open(supportUrl())} />
      </View>
    </Screen>
  );
}
