import { useRef, useState } from 'react';
import { classifyApiError, fieldIssueMessage } from '@/core/api-errors';
import { RATE_LIMITED_TEXT } from '@/core/messages';
import { useDismiss } from '@/features/navigation';
import { useSession } from '@/features/session/session-provider';
import { Button, InlineAlert, PasswordField, Screen } from '@/ui/controls';
import { useToast } from '@/ui/feedback';

const NEW_PASSWORD_MIN = 8;
const NEW_PASSWORD_MAX = 72;
const codePoints = (value: string) => [...value].length;

/** Troca opcional de senha (B4, 10.10). Visivel so com CHANGE_OWN_PASSWORD (a conta demo nao chega aqui). */
export default function ChangePassword() {
  const { api, setUser, refreshMe } = useSession();
  const toast = useToast();
  const dismiss = useDismiss('/settings');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    setBanner(null);
    const found: typeof errors = {};
    if (!current) found.current = 'Informe a senha atual.';
    if (!next) found.next = 'Informe a nova senha.';
    else if (codePoints(next) < NEW_PASSWORD_MIN || codePoints(next) > NEW_PASSWORD_MAX) found.next = 'A nova senha deve ter de 8 a 72 caracteres.';
    if (!found.next && confirm !== next) found.confirm = 'As senhas não conferem.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    submitting.current = true;
    setBusy(true);
    try {
      const me = await api.changePassword(current, next);
      setUser(me);
      toast.show({ kind: 'success', message: 'Senha alterada.', detail: 'As outras sessões, inclusive no site, foram encerradas.' });
      dismiss();
    } catch (error) {
      const c = classifyApiError(error as never);
      if (c.kind === 'VALIDATION') {
        const fields: typeof errors = {};
        for (const issue of c.fields ?? []) {
          if (issue.field === 'currentPassword') fields.current = fieldIssueMessage(issue);
          if (issue.field === 'newPassword') fields.next = fieldIssueMessage(issue);
        }
        setErrors(fields);
        if (Object.keys(fields).length === 0) setBanner('Não foi possível salvar agora. Confira os dados e tente novamente.');
      } else if (c.kind === 'RATE_LIMITED') setBanner(RATE_LIMITED_TEXT(c.retryAfterMinutes ?? 1));
      else if (c.kind === 'FORBIDDEN') {
        setBanner('Esta conta não pode trocar a senha.');
        void refreshMe();
      } else if (c.kind === 'NETWORK' || c.kind === 'TIMEOUT') setBanner('Não foi possível salvar agora. Verifique sua conexão e tente novamente.');
      else if (c.kind !== 'SESSION_EXPIRED' && c.kind !== 'UPDATE_REQUIRED' && c.kind !== 'PASSWORD_CHANGE_REQUIRED')
        setBanner('Não foi possível salvar agora. Tente novamente.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      {banner ? <InlineAlert>{banner}</InlineAlert> : null}
      <PasswordField
        label="Senha atual"
        value={current}
        onChangeText={setCurrent}
        error={errors.current}
        editable={!busy}
        textContentType="password"
        returnKeyType="next"
      />
      <PasswordField
        label="Nova senha"
        value={next}
        onChangeText={setNext}
        error={errors.next}
        help="De 8 a 72 caracteres."
        editable={!busy}
        textContentType="newPassword"
        passwordRules="minlength: 8; maxlength: 72;"
        returnKeyType="next"
      />
      <PasswordField
        label="Confirmar nova senha"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        editable={!busy}
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      <Button title="Salvar" busy={busy} busyTitle="Salvando…" onPress={() => void submit()} />
    </Screen>
  );
}
