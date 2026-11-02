import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/data/query-client';
import { guardTarget } from '@/features/session/route-guard';
import { SessionProvider, useSession } from '@/features/session/session-provider';
import { ViewStateProvider } from '@/features/view-state/view-state';
import { PrivacyOverlay } from '@/platform/privacy-overlay';
import { useQueryLifecycle } from '@/platform/query-lifecycle';
import { FeedbackProvider } from '@/ui/feedback';
import { Loading } from '@/ui/states';
import { ThemeProvider, useTheme } from '@/ui/theme';

function Gate() {
  const { state } = useSession();
  const { palette, scheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  useQueryLifecycle();

  useEffect(() => {
    if (!navigationState?.key) return;
    const target = guardTarget(state, segments, { allowDiagnostics: process.env.EXPO_PUBLIC_E2E === '1' });
    if (!target) return;
    // Folhas modais abertas sao fechadas antes do replace (design 4.2).
    // Adiado um ciclo: a tela atual conclui o que estava fazendo (ex.: o botao "Entrar" termina o envio) antes de sair.
    const timer = setTimeout(() => {
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // sem pilha para fechar
      }
      router.replace(target as never);
    }, 0);
    return () => clearTimeout(timer);
  }, [state, segments, navigationState?.key, router]);

  if (state === 'booting') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="new" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="edit" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="month-picker" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true }} />
        <Stack.Screen name="filters" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  // Desmontar o app limpa o cache e os timers de coleta de lixo do React Query.
  useEffect(() => () => queryClient.clear(), [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <ViewStateProvider>
            <FeedbackProvider>
              <Gate />
              <PrivacyOverlay />
            </FeedbackProvider>
          </ViewStateProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
