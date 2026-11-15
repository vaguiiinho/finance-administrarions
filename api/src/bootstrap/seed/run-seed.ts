import { NestFactory } from '@nestjs/core';
import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { loadEnv } from '../env.js';
import { AppModule } from '../../app.module.js';
import { ResetOwnerData } from '../../modules/finance/application/use-cases/maintenance/reset-owner-data.js';
import { EnsureShowcaseAccount } from '../../modules/identity/application/use-cases/bootstrap/ensure-showcase-account.js';
import { GetShowcaseAccountState } from '../../modules/identity/application/use-cases/bootstrap/get-showcase-account-state.js';

/**
 * Seed (`prisma db seed`): garante a conta demo (ligada/desligada/atualizada pela variável) e, se ela estiver ativa, o
 * dataset de exemplo do mês corrente (`sample-stale`: só regrava se a âncora ou a versão mudaram). Idempotente, independe do
 * administrador e NÃO lê `ADMIN_*` (ADR 0005 7.5; ADR 0013 5.8). Raiz de composição: sobe o contexto da aplicação, sem HTTP.
 */
async function seed(): Promise<void> {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    // ADR 0011 5.3: a senha nunca é logada.
    const { status } = await context.get(EnsureShowcaseAccount).execute({ password: loadEnv().showcaseAccountPassword });
    if (status === 'conflict') console.error('seed: já existe um usuário com o e-mail reservado da conta de demonstração; conta não provisionada.');

    // Desligar a conta não apaga dados (RF14): inativa ou ausente, o dataset não é tocado.
    const { state } = await context.get(GetShowcaseAccountState).execute({});
    let dataset = 'não aplicado';
    if (state === 'active') {
      const result = await context.get(ResetOwnerData).execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: { kind: 'sample-stale' } });
      dataset = result.status === 'reset' ? 'restaurado' : 'em dia';
    }
    console.log(`seed: conta de demonstração: ${status}; dataset de exemplo: ${dataset}.`);
  } finally {
    await context.close();
  }
}

await seed();
