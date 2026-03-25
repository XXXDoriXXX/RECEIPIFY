import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {PrismaClient} from "@prisma/client";
import { ConfigService} from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if(!connectionString) {
      throw new Error('Critical: DATABASE_URL is missing');
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({adapter});
  }
  async onModuleInit() {
    this.logger.log('[prisma] Initializing database connection pool...');
    await this.$connect();
  }
  async onModuleDestroy() {
    this.logger.log('[prisma] Draining database connections...');
    await this.$disconnect();
  }

}
