import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@src/prisma';
import { StorageModule } from '@src/storage';
import { OcrProcessor } from './ocr.processor';
import { VisionService } from './vision.service';
import { ReceiptParserService } from './receipt-parser.service';
import { ReceiptPersistenceModule } from '@src/receipt-persistence';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    ReceiptPersistenceModule,
    BullModule.registerQueue({ name: 'ocr-jobs' }),
  ],
  providers: [OcrProcessor, VisionService, ReceiptParserService],
})
export class OcrModule {}
