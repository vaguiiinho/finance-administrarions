import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { RecoverAdminAccess } from '../../modules/identity/application/use-cases/bootstrap/recover-admin-access.js';

/**
 * Recuperação operacional (ADR 0005 7.7, T15): `npm run admin:recover -- --email <email>`, dentro do container.
 * A senha temporária vem de RECOVERY_PASSWORD ou da entrada padrão, NUNCA de argumento (argv aparece em `ps`).
 */
function emailFromArgs(argv: string[]): string | null {
  const index = argv.indexOf('--email');
  return index >= 0 ? (argv[index + 1] ?? null) : null;
}

async function passwordFromEnvOrStdin(): Promise<string> {
  if (process.env.RECOVERY_PASSWORD) return process.env.RECOVERY_PASSWORD;
  if (process.stdin.isTTY) process.stderr.write('Senha temporária: ');
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function main(): Promise<void> {
  const email = emailFromArgs(process.argv.slice(2));
  if (!email) {
    console.error('Uso: npm run admin:recover -- --email <email>   (senha em RECOVERY_PASSWORD ou na entrada padrão)');
    process.exit(2);
  }
  const temporaryPassword = await passwordFromEnvOrStdin();

  const context = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const { userId } = await context.get(RecoverAdminAccess).execute({ email, temporaryPassword });
    console.log(`Acesso recuperado para o usuário ${userId}: administrador ativo, com troca de senha obrigatória.`);
  } catch (error) {
    // Mensagens de AppError não contêm a senha; qualquer outra é reduzida a um texto fixo.
    const known = error as { code?: string; message?: string };
    console.error(known.code ? `${known.code}: ${known.message}` : 'Falha inesperada na recuperação.');
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

await main();
