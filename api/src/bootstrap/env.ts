import { isIP } from 'node:net';
import { z } from 'zod';
import { codePointLength } from '@shared/domain/text.js';
import { AppVersion } from '../modules/identity/domain/client/app-version.js';
import { MIN_SESSION_SECRET_BYTES } from '../modules/identity/infrastructure/session-secret.js';

const DEFAULT_MAINTENANCE_INTERVAL_MS = 3_600_000;
const DEFAULT_TRUST_PROXY = 'loopback, uniquelocal';
const DEFAULT_MOBILE_MIN_VERSION = '1.0.0';
const SHOWCASE_PASSWORD_MAX = 72;
const MIN_IPV4_PREFIX = 24;
const MIN_IPV6_PREFIX = 64;

/** IPv4-mapped (`::ffff:a.b.c.d`, em qualquer grafia): o proxy-addr o lê como IPv4 e ignora o prefixo IPv6; recusado. */
function isIpv4Mapped(address: string): boolean {
  try {
    return /^\[(0*:)*ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}\]$/.test(new URL(`http://[${address}]`).hostname);
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Em produção só IP/sub-rede explícitos do nginx (ADR 0011 6.1): nada de `true`, saltos, `loopback` ou `uniquelocal`. */
function isExplicitProxyList(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === '') return false;
  return raw.split(',').every((token) => {
    const [address, mask, ...rest] = token.trim().split('/');
    const family = isIP(address ?? '');
    if (rest.length > 0 || !address || family === 0) return false;
    if (family === 6 && isIpv4Mapped(address)) return false;
    if (mask === undefined) return true;
    if (!/^\d{1,3}$/.test(mask)) return false;
    // Faixa válida (0-32 / 0-128) e prefixo estreito o bastante para não confiar numa rede inteira.
    const bits = Number(mask);
    return bits >= (family === 4 ? MIN_IPV4_PREFIX : MIN_IPV6_PREFIX) && bits <= (family === 4 ? 32 : 128);
  });
}

/**
 * Variáveis do ambiente (ADR 0005 6.7). `ADMIN_*` são só strings opcionais aqui: a obrigatoriedade e as regras são do
 * `BootstrapFirstAdmin` (só valem se ainda não houver usuário REGULAR). Nenhum valor é logado.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_TOKEN_SECRET: z.string().refine((v) => Buffer.byteLength(v, 'utf8') >= MIN_SESSION_SECRET_BYTES),
  PORT: z.string().regex(/^\d+$/).optional(),
  NODE_ENV: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  MOBILE_MIN_VERSION: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || AppVersion.create(v).ok),
  MOBILE_STORE_URL: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || isHttpsUrl(v)),
  SHOWCASE_ACCOUNT_PASSWORD: z
    .string()
    .optional()
    .refine((v) => v === undefined || codePointLength(v) <= SHOWCASE_PASSWORD_MAX),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  MAINTENANCE_INTERVAL_MS: z.string().regex(/^\d+$/).optional(),
});

export interface Env {
  databaseUrl: string;
  port: number;
  trustProxy: string;
  mobileMinVersion: string;
  mobileStoreUrl: string | null;
  /** Lida só pelo seed. `null` = conta de demonstração desligada. Nunca logada. */
  showcaseAccountPassword: string | null;
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
  if (v.NODE_ENV === 'production' && !isExplicitProxyList(v.TRUST_PROXY)) throw new EnvError(['TRUST_PROXY']);
  return {
    databaseUrl: v.DATABASE_URL,
    port: v.PORT ? Number(v.PORT) : 3000,
    trustProxy: v.TRUST_PROXY ?? DEFAULT_TRUST_PROXY,
    mobileMinVersion: v.MOBILE_MIN_VERSION || DEFAULT_MOBILE_MIN_VERSION,
    mobileStoreUrl: v.MOBILE_STORE_URL || null,
    showcaseAccountPassword: v.SHOWCASE_ACCOUNT_PASSWORD?.trim() ? v.SHOWCASE_ACCOUNT_PASSWORD : null,
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
