import { Linking } from 'react-native';
import { useSession } from '@/features/session/session-provider';
import { appVersion } from '@/platform/app-info';
import { externalBrowser } from '@/platform/external-browser';
import { Button, Screen } from '@/ui/controls';
import { ScreenState } from '@/ui/states';
import { Text } from '@/ui/Text';

/** URLs da App Store abrem no app da loja (Linking), nao no SFSafariViewController. */
async function openStore(url: string) {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // URL malformada: cai no navegador do sistema.
  }
  if (host === 'apps.apple.com') await Linking.openURL(url);
  else await externalBrowser.open(url);
}

/** Atualizacao obrigatoria (426, T7): a credencial e mantida; "Atualizar" abre a storeUrl. */
export default function UpdateRequired() {
  const { updateInfo, retryBoot } = useSession();
  const storeUrl = updateInfo?.storeUrl ?? null;
  const minimum = updateInfo?.minimumVersion;
  return (
    <Screen scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenState icon="⬇︎" title="Atualização necessária" message="Atualize o aplicativo para continuar.">
        <Text variant="footnote" tone="muted" center>
          {minimum
            ? `Esta versão (${appVersion()}) não é mais suportada. Instale a ${minimum} ou mais recente.`
            : `Esta versão (${appVersion()}) não é mais suportada.`}
        </Text>
        {storeUrl ? (
          <Button title="Atualizar" onPress={() => void openStore(storeUrl)} />
        ) : (
          <Text center tone="muted">
            Procure por Finanças Pessoais na App Store para atualizar.
          </Text>
        )}
        <Button title="Tentar novamente" kind="secondary" onPress={retryBoot} />
      </ScreenState>
    </Screen>
  );
}
