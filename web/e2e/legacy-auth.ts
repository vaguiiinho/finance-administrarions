import type { Page } from "@playwright/test";
import { signIn } from "./auth-support";
import { setScenario } from "./support";

/**
 * Bearer de "ana" para chamar o stub direto (fora do navegador), como alguns testes fazem para conferir o que foi gravado.
 * Contrato do stub: token `stub-<id>`; o id de "ana" e o 2o usuario semeado (`server.mjs`). Nao faz login: com `holdMutations`
 * ligado o POST de login ficaria preso.
 */
export const anaAuthorization = async (): Promise<{ authorization: string }> => ({ authorization: "Bearer stub-a0000000-0000-7000-8000-000000000002" });

/**
 * Sessao para as suites anteriores a autenticacao (ADR 0005 D10): o stub nao aceita requisicao sem Bearer. Volta ao cenario
 * `default` antes de entrar, porque o stub e global e o teste anterior pode ter deixado um cenario de falha ou de espera.
 */
export async function signInAsAna(page: Page): Promise<void> {
  await setScenario("default");
  await signIn(page, "ana");
}
