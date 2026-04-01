import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@src/prisma';
import { StorageModule } from '@src/storage';
import { OcrProcessor } from './ocr.processor';
import { OcrOrchestrator } from './ocr-orchestrator.service';
import { VisionService } from './vision.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    BullModule.registerQueue({
      name: 'ocr-jobs',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000, // 3s 6s 12s
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      },
    }),
  ],
  providers: [
    OcrProcessor,
    OcrOrchestrator,
    VisionService
  ],
})
export class OcrModule {}
