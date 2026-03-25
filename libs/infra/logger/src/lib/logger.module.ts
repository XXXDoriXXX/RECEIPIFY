// libs/infra/logger/src/lib/logger.module.ts
import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import {IncomingMessage, ServerResponse} from "node:http";

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        customProps: (req: IncomingMessage, res: ServerResponse) => ({
          context: 'HTTP',
        }),
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                colorize: true,
              },
            }
            : undefined,
      } as any,
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
