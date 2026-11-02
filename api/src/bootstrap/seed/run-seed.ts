import { NestFactory } from '@nestjs/core';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { loadEnv } from '../env.js';
import { AppModule } from '../../app.module.js';
import { RefreshDemoDataset } from '../../modules/finance/application/demo/refresh-demo-dataset.js';
import { EnsureDemoUser } from '../../modules/identity/application/use-cases/bootstrap/ensure-demo-user.js';
import { EnsureShowcaseAccount } from '../../modules/identity/application/use-cases/bootstrap/ensure-showcase-account.js';

/**
 * Seed (`prisma db seed`): garante o usuário demo e os dados de exemplo do mês corrente. Idempotente, independe do
 * administrador e NÃO lê `ADMIN_*` (ADR 0005 7.5). Raiz de composição: sobe o contexto da aplicação, sem HTTP.
 */
async function seed(): Promise<void> {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const { created } = await context.get(EnsureDemoUser).execute({});
    const { refreshed } = await context.get(RefreshDemoDataset).execute({ ownerId: DEMO_USER_ID });
    // ADR 0011 5.3: a conta de demonstração do app é ligada/desligada/atualizada pela variável; o valor nunca é logado.
    const { status } = await context.get(EnsureShowcaseAccount).execute({ password: loadEnv().showcaseAccountPassword });
    if (status === 'conflict') console.error('seed: já existe um usuário com o e-mail reservado da conta de demonstração; conta não provisionada.');
    console.log(`seed: conta de demonstração do app: ${status}.`);
    console.log(`seed: usuário demo ${created ? 'criado' : 'existente'}; dados de exemplo ${refreshed ? 'atualizados' : 'em dia'}.`);
  } finally {
    await context.close();
  }
}

await seed();
