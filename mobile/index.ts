import { startInstallCheck } from './src/platform/install-check';
import 'expo-router/entry';

// CA10: o Keychain sobrevive a desinstalacao; a primeira execucao descarta o token antes de a sessao ler o Keychain.
void startInstallCheck();
