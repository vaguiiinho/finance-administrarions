const DEMO_ROUTE = /^\/demo\/(entries|dashboard|cards)(?:\/|$)/;

/**
 * Destino do "Entrar" (RF37, CA43): em `/demo/<x>` leva a `/login?next=/<x>`, so com o caminho (ids e filtros da demo
 * nao existem nos dados da pessoa); em qualquer outra rota publica, `/login`.
 */
export function signInHref(pathname: string | null): string {
  const match = pathname ? DEMO_ROUTE.exec(pathname) : null;
  return match ? `/login?next=/${match[1]}` : "/login";
}
