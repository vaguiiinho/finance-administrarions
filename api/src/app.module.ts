import { Module } from '@nestjs/common';
import { FinanceModule } from './modules/finance/finance.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { SharedModule } from './shared/shared.module.js';

@Module({
  imports: [PrismaModule, SharedModule, FinanceModule],
})
export class AppModule {}
