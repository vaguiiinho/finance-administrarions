import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { keychain } from '../support/setup';
import { createSecureTokenStore, ensureFreshInstall } from '@/platform/secure-token-store';

describe('armazenamento seguro do token (RNF02, CA01, CA10)', () => {
  it('grava no Keychain com AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY e nunca no AsyncStorage', async () => {
    await createSecureTokenStore().write({ token: 'tok-abc', expiresAt: '2026-11-03T08:00:00Z' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fa.session', expect.stringContaining('tok-abc'), expect.objectContaining({ keychainAccessible: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' }));
    expect(JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()))).not.toContain('tok-abc');
  });
  it('clear apaga a sessao', async () => {
    const s = createSecureTokenStore();
    await s.write({ token: 't', expiresAt: 'x' });
    await s.clear();
    expect(await s.read()).toBeNull();
  });
  it('CA10: primeira execucao apos instalar apaga token remanescente e grava o marcador', async () => {
    keychain.set('fa.session', JSON.stringify({ token: 'velho', expiresAt: '2099-01-01T00:00:00Z' }));
    await ensureFreshInstall(createSecureTokenStore());
    expect(keychain.has('fa.session')).toBe(false);
    expect(await AsyncStorage.getItem('fa.installed')).not.toBeNull();
  });
  it('execucoes seguintes preservam o token', async () => {
    await AsyncStorage.setItem('fa.installed', '1');
    keychain.set('fa.session', JSON.stringify({ token: 'ok', expiresAt: '2099-01-01T00:00:00Z' }));
    await ensureFreshInstall(createSecureTokenStore());
    expect(keychain.has('fa.session')).toBe(true);
  });
});
