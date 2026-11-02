import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { Button } from './controls';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH, radius, space } from './tokens';

// ---------------------------------------------------------------------------------------------------------------------
// Toast (8.4): uma mensagem por vez, acao opcional ("Desfazer"), duracao maior com VoiceOver ligado.
// ---------------------------------------------------------------------------------------------------------------------
export interface ToastInput {
  message: string;
  /** Segunda linha (por exemplo, "Em dezembro de 2026."). */
  detail?: string;
  kind?: 'success' | 'error' | 'info';
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

interface ToastApi {
  show(toast: ToastInput): void;
  dismiss(): void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined, dismiss: () => undefined });
export const useToast = () => useContext(ToastContext);

export const TOAST_DURATION_MS = 5_000;
const TOAST_DURATION_SCREEN_READER_MS = 10_000;

// ---------------------------------------------------------------------------------------------------------------------
// Dialogo de confirmacao (Alert customizado, para o estado ficar na arvore e ser testavel; modal para o VoiceOver).
// ---------------------------------------------------------------------------------------------------------------------
export interface ConfirmInput {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface DialogApi {
  confirm(input: ConfirmInput): Promise<boolean>;
}

const DialogContext = createContext<DialogApi>({ confirm: async () => false });
export const useDialog = () => useContext(DialogContext);

interface ActiveDialog extends ConfirmInput {
  resolve(result: boolean): void;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const screenReader = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => (screenReader.current = on));
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    counter.current += 1;
    const id = counter.current;
    setToast({ ...input, id });
    const duration = input.durationMs ?? (screenReader.current ? TOAST_DURATION_SCREEN_READER_MS : TOAST_DURATION_MS);
    timer.current = setTimeout(() => setToast((current) => (current?.id === id ? null : current)), duration);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const confirm = useCallback(
    (input: ConfirmInput) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          ...input,
          resolve: (result) => {
            setDialog(null);
            resolve(result);
          },
        });
      }),
    [],
  );

  const toastApi = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const dialogApi = useMemo(() => ({ confirm }), [confirm]);
  const toastColor = toast?.kind === 'error' ? palette.danger : toast?.kind === 'success' ? palette.success : palette.accent;

  return (
    <ToastContext.Provider value={toastApi}>
      <DialogContext.Provider value={dialogApi}>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>{children}</View>
          {toast ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: 96 }}>
              <View
                accessibilityLiveRegion="polite"
                style={{
                  backgroundColor: palette.surface,
                  borderColor: toastColor,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                }}
              >
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text variant="subheadline">{toast.message}</Text>
                  {toast.detail ? (
                    <Text variant="footnote" tone="muted">
                      {toast.detail}
                    </Text>
                  ) : null}
                </View>
                {toast.action ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={toast.action.label}
                    onPress={() => {
                      const { onPress } = toast.action!;
                      dismiss();
                      onPress();
                    }}
                    style={{ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.sm }}
                  >
                    <Text variant="headline" tone="accent" accessible={false}>
                      {toast.action.label}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
          {dialog ? (
            <View
              accessibilityViewIsModal
              style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim, alignItems: 'center', justifyContent: 'center', padding: space.xl }]}
            >
              <View
                accessibilityRole="alert"
                style={{ alignSelf: 'stretch', backgroundColor: palette.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}
              >
                <Text variant="headline" center>
                  {dialog.title}
                </Text>
                {dialog.message ? (
                  <Text variant="subheadline" tone="muted" center>
                    {dialog.message}
                  </Text>
                ) : null}
                <View style={{ gap: space.sm }}>
                  <Button title={dialog.confirmLabel} kind={dialog.destructive ? 'destructive' : 'primary'} onPress={() => dialog.resolve(true)} />
                  <Button title={dialog.cancelLabel ?? 'Cancelar'} kind="secondary" onPress={() => dialog.resolve(false)} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </DialogContext.Provider>
    </ToastContext.Provider>
  );
}
