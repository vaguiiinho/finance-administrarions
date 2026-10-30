"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInHref } from "@/lib/auth/sign-in-href";

/**
 * Acao do aviso da demo. Client porque o layout nao re-renderiza em navegacao no cliente: o `next` do "Entrar" acompanha
 * a tela atual (`usePathname`), com o caminho do servidor como base.
 */
export function DemoBannerAction({ loggedIn, path }: { loggedIn: boolean; path: string }) {
  const pathname = usePathname() ?? path;
  return loggedIn ? (
    <Link href="/entries" className="btn btn-primary w-full min-h-11 md:w-auto">
      Ir para meus dados
    </Link>
  ) : (
    <Link href={signInHref(pathname)} className="btn btn-primary w-full min-h-11 md:w-auto">
      Entrar
    </Link>
  );
}
