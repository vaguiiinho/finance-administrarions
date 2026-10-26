import type { Prisma } from './generated/client.js';

/** Cliente Prisma ou cliente de transação: repositórios e read models aceitam ambos. */
export type PrismaExecutor = Prisma.TransactionClient;
