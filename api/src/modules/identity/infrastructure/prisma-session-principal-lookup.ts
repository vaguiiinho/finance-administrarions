import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { SessionPrincipalLookup, SessionPrincipalRecord } from '../application/ports/session-principal-lookup.js';
import type { SessionTokenDigest } from '../domain/session/value-objects/session-token-digest.js';

/** T16: uma consulta sessions JOIN users por índice único, a cada requisição, sem cache. */
export class PrismaSessionPrincipalLookup implements SessionPrincipalLookup {
  constructor(private readonly prisma: PrismaExecutor) {}

  async findByDigest(digest: SessionTokenDigest, now: Date): Promise<SessionPrincipalRecord | null> {
    const rows = await this.prisma.$queryRaw<
      {
        session_id: string;
        user_id: string;
        kind: SessionPrincipalRecord['kind'];
        role: SessionPrincipalRecord['role'];
        status: SessionPrincipalRecord['status'];
        must_change_password: boolean;
      }[]
    >(Prisma.sql`
      SELECT s.id::text AS session_id, u.id::text AS user_id, u.kind::text AS kind, u.role::text AS role,
             u.status::text AS status, u.must_change_password
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_digest = ${digest.value} AND s.expires_at > ${now}`);
    const row = rows[0];
    return row
      ? {
          sessionId: row.session_id,
          userId: row.user_id,
          kind: row.kind,
          role: row.role,
          status: row.status,
          mustChangePassword: row.must_change_password,
        }
      : null;
  }
}
