import { Module } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
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
  providers: [ReceiptService],
})
export class ReceiptModule {}
