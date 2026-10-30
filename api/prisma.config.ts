import 'dotenv/config'
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // O seed é JS compilado (a imagem de runtime não tem devDependencies): `nest build` gera dist/bootstrap/seed/run-seed.js.
  migrations: { path: 'prisma/migrations', seed: 'node dist/bootstrap/seed/run-seed.js' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://root:password@127.0.0.1:5432/finance',
  },
});
