import { Module } from '@nestjs/common';
import {PrismaModule} from "@src/prisma";
import {AuthController} from "./auth.controller";
import {AuthService} from "./auth.service";
import {JwtModule} from "@nestjs/jwt";
import {ConfigModule, ConfigService} from "@nestjs/config";

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET','fallback_secret'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_ACCESS_EXPIRY', 900) //900 seconds = 15 minutes
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],



})
export class AuthModule {}
