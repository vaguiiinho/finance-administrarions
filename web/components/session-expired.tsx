"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { InlineAlert } from "./ui/states";

export const SESSION_EXPIRED_TEXT = "Sua sessão expirou. Entre novamente.";
/** Tempo para ler o aviso antes de ir ao login (design 8; vale tambem com movimento reduzido). */
export const SESSION_REDIRECT_MS = 1500;

interface Redirecting {
  code?: string;
  redirectUrl?: string;
}

/**
 * Efeito dos erros 401/403-PCR das mutacoes (design 8): `SESSION_EXPIRED` -> mostra o aviso e vai ao login depois de
 * 1,5 s; `PASSWORD_CHANGE_REQUIRED` -> vai para a troca de senha na hora. Nada foi salvo.
 */
export function useAuthRedirect(error: Redirecting | null | undefined) {
  const router = useRouter();
  const code = error?.code;
  const url = error?.redirectUrl;
  useEffect(() => {
    if (!url) return;
    if (code === "PASSWORD_CHANGE_REQUIRED") {
      router.replace(url);
      return;
    }
    if (code !== "SESSION_EXPIRED") return;
    const timer = setTimeout(() => router.replace(url), SESSION_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [code, url, router]);
}

/** Atalho "Entrar novamente": navega na hora, sem esperar o tempo do aviso. */
export function EnterAgainLink({ redirectUrl }: { redirectUrl: string }) {
  const router = useRouter();
  return (
    <a
      href={redirectUrl}
      className="font-medium text-accent underline"
      onClick={(event) => {
        event.preventDefault();
        router.replace(redirectUrl);
      }}
    >
      Entrar novamente
    </a>
  );
}

/** Texto do aviso para caixas de dialogo (`AlertDialog.error`): mensagem + atalho. */
export function SessionExpiredInline({ redirectUrl }: { redirectUrl?: string }) {
  return (
    <>
      {SESSION_EXPIRED_TEXT}
      {redirectUrl ? (
        <>
          {" "}
          <EnterAgainLink redirectUrl={redirectUrl} />
        </>
      ) : null}
    </>
  );
}

/** Aviso no proprio dialogo/formulario, com o atalho "Entrar novamente". */
export function SessionExpiredAlert({ redirectUrl }: { redirectUrl?: string }) {
  return (
    <InlineAlert>
      <p>{SESSION_EXPIRED_TEXT}</p>
      {redirectUrl ? <EnterAgainLink redirectUrl={redirectUrl} /> : null}
    </InlineAlert>
  );
}
