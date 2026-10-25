import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

/** Único ponto de criação do PrismaClient (adapter-pg). Lê DATABASE_URL do ambiente. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL não definida.');
    // Sessão sempre em UTC e DateStyle ISO (leituras ::text de DATE não dependem da config do banco):
    // o adapter serializa/parseia timestamptz sem offset, então o fuso da
    // sessão do banco não pode influenciar (datas em UTC no banco/API).
    super({ adapter: new PrismaPg({ connectionString, options: '-c timezone=UTC -c datestyle=ISO' }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
