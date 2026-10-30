/** Estado comum das Server Actions de formulario (`useActionState`) da Feature A. */
export interface FormState {
  status: "idle" | "success" | "error";
  /** Mensagem geral (sucesso ou banner). */
  message?: string;
  /** Codigo da API (INVALID_CREDENTIALS, TOO_MANY_ATTEMPTS, SESSION_EXPIRED, NETWORK_ERROR...). */
  code?: string;
  /** campo -> mensagem pt-BR (design 3.4, 4.3). */
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
  redirectUrl?: string;
  /** Eco dos valores que a tela deve manter/mostrar (e-mail digitado, nome normalizado). */
  values?: Record<string, string>;
  /** Carimbo (ms) de quando a resposta chegou ao navegador; marca cada resposta como nova e ancora o prazo do 429. */
  at?: number;
}

export const INITIAL_FORM_STATE: FormState = { status: "idle" };
