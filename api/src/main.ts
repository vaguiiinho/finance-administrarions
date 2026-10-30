import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import { EnvError, loadEnv } from './bootstrap/env.js';
import { runFirstAdminBootstrap } from './bootstrap/first-admin.js';

async function bootstrap() {
  // RNF03: a API não sobe com configuração ausente ou inválida.
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.init();
  await runFirstAdminBootstrap(app, env, (code) => process.exit(code));
  await app.listen(env.port);
}
await bootstrap();
