import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/**
 * Sobe UM Postgres 17 para a suíte e aplica as migrations (`prisma migrate deploy`).
 * Se ainda não houver migrations (fase RED: nada implementado), o container sobe mesmo assim
 * e os testes falham por ausência de implementação, não por infraestrutura.
 */
export default async function setup(project: TestProject) {
  process.env.TZ = 'America/Sao_Paulo';
  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('finance_test')
    .withUsername('test')
    .withPassword('test')
    .withEnvironment({ TZ: 'America/Sao_Paulo', PGTZ: 'America/Sao_Paulo' })
    .start();

  const url = container.getConnectionUri();
  const migrations = resolve(process.cwd(), 'prisma/migrations');
  if (existsSync(migrations) && readdirSync(migrations).length > 0) {
    execSync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
    });
  } else {
    console.warn('[global-setup-db] prisma/migrations ausente: schema nao aplicado (esperado no RED).');
  }

  project.provide('databaseUrl', url);
  return async () => {
    await container?.stop();
  };
}
