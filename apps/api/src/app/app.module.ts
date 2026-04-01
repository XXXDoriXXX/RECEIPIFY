import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '@src/prisma';
import {ConfigModule, ConfigService} from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from '@src/logger';
import { StorageModule } from '@src/storage';
import {ReceiptModule} from "./receipts/receipt.module";
import {BullModule} from "@nestjs/bullmq";
import { CategoryModule } from './categories/category.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    LoggerModule,
    StorageModule,
    ReceiptModule,
    CategoryModule,
    UsersModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
