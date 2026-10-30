import { z } from 'zod';
import { MIN_SESSION_SECRET_BYTES } from '../modules/identity/infrastructure/session-secret.js';

const DEFAULT_MAINTENANCE_INTERVAL_MS = 3_600_000;
const DEFAULT_TRUST_PROXY = 'loopback, uniquelocal';

/**
 * Variáveis do ambiente (ADR 0005 6.7). `ADMIN_*` são só strings opcionais aqui: a obrigatoriedade e as regras são do
 * `BootstrapFirstAdmin` (só valem se ainda não houver usuário REGULAR). Nenhum valor é logado.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_TOKEN_SECRET: z.string().refine((v) => Buffer.byteLength(v, 'utf8') >= MIN_SESSION_SECRET_BYTES),
  PORT: z.string().regex(/^\d+$/).optional(),
  TRUST_PROXY: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  MAINTENANCE_INTERVAL_MS: z.string().regex(/^\d+$/).optional(),
});

export interface Env {
  databaseUrl: string;
  port: number;
  trustProxy: string;
  maintenanceIntervalMs: number;
  admin: { ADMIN_NAME?: string; ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string };
}

/** Erro de configuração: lista só os NOMES das variáveis problemáticas, nunca os valores. */
export class EnvError extends Error {
  constructor(readonly variables: string[]) {
    super(`Configuração inválida: verifique as variáveis ${variables.join(', ')}.`);
    this.name = 'EnvError';
  }
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError([...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'env')))]);
  }
  const v = parsed.data;
  return {
    databaseUrl: v.DATABASE_URL,
    port: v.PORT ? Number(v.PORT) : 3000,
    trustProxy: v.TRUST_PROXY ?? DEFAULT_TRUST_PROXY,
    maintenanceIntervalMs: v.MAINTENANCE_INTERVAL_MS ? Number(v.MAINTENANCE_INTERVAL_MS) : DEFAULT_MAINTENANCE_INTERVAL_MS,
    admin: { ADMIN_NAME: v.ADMIN_NAME, ADMIN_EMAIL: v.ADMIN_EMAIL, ADMIN_PASSWORD: v.ADMIN_PASSWORD },
  };
}

/** `trust proxy` do Express: 'true'/'false' viram booleanos, inteiros viram saltos; o resto é lista/sub-rede. */
export function parseTrustProxy(raw: string | undefined): boolean | number | string {
  const value = (raw ?? DEFAULT_TRUST_PROXY).trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/** Intervalo da manutenção periódica; `0` desliga. */
export function parseMaintenanceInterval(raw: string | undefined): number {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_MAINTENANCE_INTERVAL_MS;
}
