import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '@src/prisma';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import {LoggerModule} from "@src/logger";
import {StorageModule} from "@src/storage";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, LoggerModule, StorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
