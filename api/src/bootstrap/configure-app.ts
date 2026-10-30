import type { INestApplication } from '@nestjs/common';
import { HttpErrorFilter } from '@shared/presentation/filters/http-error.filter.js';
import { parseTrustProxy } from './env.js';

/** Configuração compartilhada pela aplicação real (main.ts) e pelos testes e2e. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpErrorFilter());
  // O IP do cliente (limites de tentativas, auditoria) vem do X-Forwarded-For repassado pelo BFF (ADR 0005 6.2).
  (app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void }).set(
    'trust proxy',
    parseTrustProxy(process.env.TRUST_PROXY),
  );
  app.enableShutdownHooks();
}
