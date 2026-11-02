import { inject } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type pg from 'pg';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { CLOCK } from '@shared/application/ports/clock.js';
import { FixedClock } from '../fakes/simple-fakes.js';
import { createPool, resetDb } from './db.js';

export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface E2eApp {
  app: INestApplication;
  clock: FixedClock;
  pool: pg.Pool;
  http: () => ReturnType<typeof request>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Sobe a aplicacao real (AppModule + `configureApp` compartilhado com main.ts, ADR 10) sobre o Postgres do container,
 * trocando apenas o Clock por um relogio controlavel.
 * `overrides` permite substituir providers por token (ex.: forcar erro 500).
 */
export async function startE2eApp(
  now = new Date('2026-10-05T13:00:00.000Z'),
  overrides: { token: unknown; value: unknown }[] = [],
): Promise<E2eApp> {
  process.env.DATABASE_URL = inject('databaseUrl');
  // RNF03: a API nao sobe sem o segredo do HMAC de sessao (ADR 0005 6.7).
  process.env.SESSION_TOKEN_SECRET ??= 'e2e-session-secret-e2e-session-secret-0123456789';
  const clock = new FixedClock(now);
  let builder = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CLOCK).useValue(clock);
  for (const o of overrides) builder = builder.overrideProvider(o.token as never).useValue(o.value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  // Servidor ja escutando: o supertest nao abre/fecha o socket a cada requisicao (evita corrida em `e.http().x(await y())`).
  await app.listen(0);
  const pool = createPool();
  return {
    app,
    clock,
    pool,
    http: () => request(app.getHttpServer()),
    reset: () => resetDb(pool),
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export const errorShape = { code: expect.any(String), message: expect.any(String) };
