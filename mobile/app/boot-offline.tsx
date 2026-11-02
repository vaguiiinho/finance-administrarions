import { useState } from 'react';
import { LOAD_FAILED_TEXT, NETWORK_TEXT } from '@/core/messages';
import { useSession } from '@/features/session/session-provider';
import { Button, Screen } from '@/ui/controls';
import { ScreenState } from '@/ui/states';

/** Erro de conexao na abertura (CA06): a credencial e mantida; so "Tentar novamente". */
export default function BootOffline() {
  const { retryBoot, bootFailure } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Screen scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenState icon="⚠︎" title={bootFailure === 'NETWORK' ? 'Sem conexão' : 'Algo deu errado'} message={bootFailure === 'NETWORK' ? NETWORK_TEXT : LOAD_FAILED_TEXT}>
        <Button
          title="Tentar novamente"
          busy={busy}
          busyTitle="Tentando…"
          onPress={() => {
            setBusy(true);
            retryBoot();
          }}
        />
      </ScreenState>
    </Screen>
  );
}
