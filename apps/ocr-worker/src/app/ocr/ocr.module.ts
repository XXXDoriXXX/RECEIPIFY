import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@src/prisma';
import { StorageModule } from '@src/storage';
import { OcrProcessor } from './ocr.processor';
import { VisionService } from './vision.service';
import { ReceiptParserService } from './receipt-parser.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    BullModule.registerQueue({ name: 'ocr-jobs' }),
  ],
  providers: [OcrProcessor, VisionService, ReceiptParserService],
})
export class OcrModule {}
