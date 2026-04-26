import { Module } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import { ReceiptUploadService } from './receipt-upload.service';
import { ReceiptSearchService } from './receipt-search.service';
import { PrismaModule } from '@src/prisma';
import {BullModule} from "@nestjs/bullmq";

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'ocr-jobs',
    }),
  ],
  controllers: [ReceiptController],
  providers: [ReceiptUploadService, ReceiptSearchService],
})
export class ReceiptModule {}
