import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredSession, TokenStore } from '@/core/ports';

/** Item unico do Keychain com a sessao de 24 h (ADR 0011 10.4). Nunca AsyncStorage, arquivos, logs ou URL (CA01). */
export const SESSION_KEY = 'fa.session';
/** Marcador NAO sensivel de "app ja executado depois de instalar" (CA10). */
export const INSTALL_MARKER_KEY = 'fa.installed';

export function createSecureTokenStore(): TokenStore {
  return {
    async read() {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<StoredSession>;
        if (typeof parsed.token === 'string' && typeof parsed.expiresAt === 'string') return { token: parsed.token, expiresAt: parsed.expiresAt };
      } catch {
        // item corrompido: tratado como ausente
      }
      return null;
    },
    async write(session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    },
    async clear() {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    },
  };
}

/** CA10: o Keychain sobrevive a desinstalacao; sem o marcador (apagado com o app), a primeira execucao descarta o token. */
export async function ensureFreshInstall(store: TokenStore): Promise<void> {
  const marker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);
  if (marker !== null) return;
  await store.clear();
  await AsyncStorage.setItem(INSTALL_MARKER_KEY, new Date().toISOString());
}
