import type { Request } from 'express';
import type { AuthenticatedPrincipal } from './principal.js';

/** Request com o principal escrito pelo guard de acesso (identity). */
export type AuthenticatedRequest = Request & { principal?: AuthenticatedPrincipal };

/** `Authorization: Bearer <token>`; qualquer outro esquema ou formato -> null. */
export function extractBearerToken(request: Pick<Request, 'headers'>): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([^\s]+)$/i.exec(header.trim());
  return match ? (match[1] ?? null) : null;
}
