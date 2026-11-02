import { PASSWORD_PENDING_NOTICE } from '@/core/messages';
import { webLoginUrl } from '@/platform/config';
import { externalBrowser } from '@/platform/external-browser';
import { useSession } from '@/features/session/session-provider';
import { Button, Screen } from '@/ui/controls';
import { ScreenState } from '@/ui/states';

/** Troca de senha pendente (P-ADR1 variante A): a troca obrigatoria e feita no site; a sessao ja foi encerrada. */
export default function PasswordChangeRequired() {
  const { logout } = useSession();
  return (
    <Screen scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenState icon="🔑" title="Troca de senha pendente" message={PASSWORD_PENDING_NOTICE}>
        <Button title="Abrir o site" onPress={() => void externalBrowser.open(webLoginUrl())} />
        <Button title="Sair" kind="secondary" onPress={() => void logout()} />
      </ScreenState>
    </Screen>
  );
}
