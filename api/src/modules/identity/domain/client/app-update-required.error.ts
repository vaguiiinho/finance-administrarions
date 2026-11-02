import { AppError } from '@shared/domain/app-error.js';

export class AppUpdateRequiredError extends AppError {
  readonly code = 'APP_UPDATE_REQUIRED';
  readonly kind = 'upgrade_required' as const;
  constructor(minimumVersion: string, storeUrl: string | null) {
    super('Atualize o aplicativo para continuar.', { minimumVersion, storeUrl });
  }
}
