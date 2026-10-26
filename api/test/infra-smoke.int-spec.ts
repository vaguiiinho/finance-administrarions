import type pg from 'pg';
import { createPool } from './support/db.js';

/** Garante que a infraestrutura de teste (container, TZ, ICU) funciona, independentemente da feature. */
describe('infra de integracao (testcontainers)', () => {
  let pool: pg.Pool;
  beforeAll(() => {
    pool = createPool();
  });
  afterAll(() => pool.end());

  it('o processo de teste roda em America/Sao_Paulo (CA23)', () => {
    expect(process.env.TZ).toBe('America/Sao_Paulo');
    expect(new Date('2026-10-05T12:00:00Z').getTimezoneOffset()).toBe(180);
  });

  it('Postgres 17 responde', async () => {
    const { rows } = await pool.query('SHOW server_version');
    expect(rows[0].server_version).toMatch(/^17/);
  });

  it('colacao ICU "und-x-icu" esta disponivel (ordenacao com acentos, CA04)', async () => {
    const { rows } = await pool.query(
      `SELECT name FROM (VALUES ('Zeta'), ('Itaú'), ('Ágil'), ('Nubank')) v(name) ORDER BY name COLLATE "und-x-icu"`,
    );
    expect(rows.map((r) => r.name)).toEqual(['Ágil', 'Itaú', 'Nubank', 'Zeta']);
  });
});
