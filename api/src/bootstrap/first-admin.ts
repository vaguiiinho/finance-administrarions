import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { FirstAdminConfigError } from '../modules/identity/domain/user/errors/user-errors.js';
import { BootstrapFirstAdmin } from '../modules/identity/application/use-cases/bootstrap/bootstrap-first-admin.js';
import type { Env } from './env.js';

/**
 * Inicialização do primeiro administrador ANTES do `listen` (ADR 0005 7.5): configuração inválida aborta o boot em
 * qualquer forma de execução. Loga só os nomes das variáveis e os códigos, nunca os valores (RNF01).
 */
export async function runFirstAdminBootstrap(app: INestApplication, env: Env, exit: (code: number) => never): Promise<void> {
  const logger = new Logger('FirstAdminBootstrap');
  try {
    const { status } = await app.get(BootstrapFirstAdmin).execute(env.admin);
    if (status !== 'skipped') logger.log(`Primeiro administrador: ${status}.`);
  } catch (error) {
    if (error instanceof FirstAdminConfigError) {
      const variables = (error.details as { variables: { name: string; code: string }[] }).variables;
      logger.error(`${error.message} ${variables.map((v) => `${v.name}=${v.code}`).join(', ')}`);
      await app.close();
      exit(1);
    }
    throw error;
  }
}
