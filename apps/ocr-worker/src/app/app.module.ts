import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@src/prisma';
import { StorageModule } from '@src/storage';
import { LoggerModule } from '@src/logger';
import { OcrModule } from './ocr/ocr.module';
import { AppController } from './app.controller';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    PrismaModule,
    StorageModule,
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
    OcrModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
