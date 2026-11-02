import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';

/** `focusManager` ligado ao AppState e `onlineManager` ao NetInfo (ADR 0011 10.8). */
export function useQueryLifecycle(): void {
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    };
    const appState = AppState.addEventListener('change', onChange);
    let unsubscribeNet: (() => void) | undefined;
    // O modulo nativo do NetInfo nao existe no Jest: nos testes o onlineManager segue o padrao.
    if (process.env.NODE_ENV !== 'test') {
      try {
        // require tardio: o modulo nativo do NetInfo nao existe no ambiente de teste
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const NetInfo = require('@react-native-community/netinfo').default as typeof import('@react-native-community/netinfo').default;
        unsubscribeNet = NetInfo.addEventListener((net) => onlineManager.setOnline(net.isConnected !== false));
      } catch {
        // NetInfo indisponivel: o React Query segue com o padrao
      }
    }
    return () => {
      appState.remove();
      unsubscribeNet?.();
    };
  }, []);
}
