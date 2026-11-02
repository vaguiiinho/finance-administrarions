import type { SessionState } from '@/core/session-machine';

const SIGNED_IN_GROUPS = new Set(['(tabs)', 'new', 'edit', 'month-picker', 'filters']);

/**
 * Destino exigido pelo estado da sessao (design 4.2), ou `null` quando a rota atual ja e permitida.
 * Funcao pura: `segments` vem do Expo Router (`useSegments`).
 */
export function guardTarget(state: SessionState, segments: readonly string[], options: { allowDiagnostics?: boolean } = {}): string | null {
  const [group, leaf] = segments;
  // Tela de diagnostico de data/fuso (ADR 0011 10.6): so no perfil e2e, acessivel em qualquer estado da sessao.
  if (options.allowDiagnostics && group === 'diagnostics') return null;
  switch (state) {
    case 'booting':
      return null;
    case 'signedOut':
      return group === '(auth)' && leaf === 'login' ? null : '/login';
    case 'passwordChangeRequired':
      return group === '(auth)' && leaf === 'password-change-required' ? null : '/password-change-required';
    case 'offline':
      return group === 'boot-offline' ? null : '/boot-offline';
    case 'updateRequired':
      return group === 'update-required' ? null : '/update-required';
    case 'signedIn':
      return group && SIGNED_IN_GROUPS.has(group) ? null : '/dashboard';
  }
}
