/** ttl fixo de 24 h, sem renovação (ADR 0005 3.1). */
export const SessionPolicy = {
  ttlMs: 24 * 60 * 60 * 1000,
  expiresAt(createdAt: Date): Date {
    return new Date(createdAt.getTime() + SessionPolicy.ttlMs);
  },
};
