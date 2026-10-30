import "server-only";
import { headers } from "next/headers";
import { loginUrl } from "./next-param";

/** Tela atual (`x-fa-url`, injetado pelo `proxy.ts`): vira o `next` ao mandar a pessoa para o login ou para a troca de senha. */
export async function currentUrl(): Promise<string | null> {
  try {
    return (await headers()).get("x-fa-url");
  } catch {
    return null; // fora de uma requisicao (build, testes)
  }
}

/** `/login?next=<tela atual>&reason=expired` (CA06, PA1); sem tela conhecida, so o `reason`. */
export async function expiredLoginUrl(): Promise<string> {
  const url = await currentUrl();
  return url ? loginUrl(url, { reason: "expired" }) : "/login?reason=expired";
}

/** `/account/password?next=<tela atual>` (CA08). */
export async function passwordChangeUrl(): Promise<string> {
  const url = await currentUrl();
  return url ? `/account/password?next=${encodeURIComponent(url)}` : "/account/password";
}
