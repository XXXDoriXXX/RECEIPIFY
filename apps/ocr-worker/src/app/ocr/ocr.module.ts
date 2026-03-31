
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@src/prisma';
import { StorageModule } from '@src/storage';
import { OcrProcessor } from './ocr.processor';
import { VisionService } from './vision.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    BullModule.registerQueue({ name: 'ocr-jobs' })
  ],
  providers: [OcrProcessor, VisionService],
})
export class OcrModule {}
