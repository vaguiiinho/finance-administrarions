import { QueryClient } from '@tanstack/react-query';
import { classifyApiError } from '@/core/api-errors';
import { ApiError } from './http-client';

export const STALE_TIME_MS = 30_000;
export const GC_TIME_MS = 5 * 60_000;

/** Retry (ADR 0011 10.8): nenhum em 4xx; 1 retry so em erro de rede nas leituras; mutacoes nunca. */
export function shouldRetryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return error instanceof ApiError && classifyApiError(error).kind === 'NETWORK';
}

/**
 * TanStack Query so em memoria (sem persister). No Jest o `gcTime` e infinito: o temporizador de 5 min das consultas
 * inativas (criado ao desmontar a arvore) manteria o processo vivo.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, gcTime: process.env.NODE_ENV === 'test' ? Infinity : GC_TIME_MS, retry: shouldRetryRead, refetchOnReconnect: true },
      mutations: { retry: false },
    },
  });
}
