import { NestFactory } from '@nestjs/core';
import { AppError } from '@shared/domain/app-error.js';
import { AppModule } from '../../app.module.js';
import { DemoAccountResetRoutine } from '../demo-account/demo-account-reset.routine.js';

/**
 * Execução manual da rotina da conta demo (ADR 0013 5.7; RF17): `npm run demo:reset`, dentro do container. Sem HTTP e sem
 * iniciar o agendador. Saída: uma linha legível e uma linha JSON. Código de saída 1 em falha, sem a mensagem crua do banco.
 */
async function main(): Promise<void> {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const report = await context.get(DemoAccountResetRoutine).run('manual');
    const { origin, accountState, outcome, deleted, restored, revokedSessions } = report;
    console.log(
      `Conta demo (${accountState}): ${outcome}. Apagados: ${deleted.entries} lançamentos e ${deleted.cards} cartões; restaurados: ${restored.entries} lançamentos e ${restored.cards} cartões.`,
    );
    console.log(JSON.stringify({ origin, accountState, outcome, deleted, restored, revokedSessions }));
  } catch (error) {
    // O relatório 'failed' já foi registrado pela rotina; aqui só um texto seguro (AppError tem mensagem controlada).
    console.error(error instanceof AppError ? `${error.code}: ${error.message}` : 'Falha inesperada ao redefinir a conta demo.');
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

await main();
