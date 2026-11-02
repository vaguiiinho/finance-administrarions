import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/** Fecha a tela atual; sem historico (abertura direta), vai para `fallback`. */
export function useDismiss(fallback = '/dashboard') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  }, [router, fallback]);
}

/** Fecha a folha se ha para onde voltar; devolve `false` quando e a unica rota (o formulario se reinicia). */
export function useDismissModal() {
  const router = useRouter();
  return useCallback((): boolean => {
    if (!router.canGoBack()) return false;
    router.back();
    return true;
  }, [router]);
}
