/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const port = process.env.WORKER_PORT || 3001;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 OCR Worker is running and listening to Redis on port ${port}`);
}

bootstrap();
