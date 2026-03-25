/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */


import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import {Logger} from "nestjs-pino";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
