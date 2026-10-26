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
  const clock = new FixedClock(now);
  let builder = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CLOCK).useValue(clock);
  for (const o of overrides) builder = builder.overrideProvider(o.token as never).useValue(o.value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
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
