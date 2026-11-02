import { createSecureTokenStore, ensureFreshInstall } from './secure-token-store';

let pending: Promise<void> | null = null;

/** Chamado uma vez pelo ponto de entrada nativo (`index.ts`), antes de a arvore do app ler o token (CA10). */
export function startInstallCheck(): Promise<void> {
  pending ??= ensureFreshInstall(createSecureTokenStore()).catch(() => undefined);
  return pending;
}

/** O boot da sessao espera a verificacao quando ela foi iniciada; fora do app nativo (testes) resolve na hora. */
export function installCheckReady(): Promise<void> {
  return pending ?? Promise.resolve();
}
