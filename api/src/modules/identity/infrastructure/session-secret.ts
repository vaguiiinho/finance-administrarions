/** Menor segredo aceito para o HMAC do digest de sessão (RNF03): 32 bytes. */
export const MIN_SESSION_SECRET_BYTES = 32;

/** Falha alto no boot se o segredo faltar ou for curto (a API não sobe sem ele). */
export function requireSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.SESSION_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < MIN_SESSION_SECRET_BYTES) {
    throw new Error(`SESSION_TOKEN_SECRET ausente ou com menos de ${MIN_SESSION_SECRET_BYTES} bytes.`);
  }
  return secret;
}
