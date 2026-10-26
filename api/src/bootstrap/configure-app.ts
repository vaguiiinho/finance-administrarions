import type { INestApplication } from '@nestjs/common';
import { HttpErrorFilter } from '@shared/presentation/filters/http-error.filter.js';

/** Configuração compartilhada pela aplicação real (main.ts) e pelos testes e2e. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
}
