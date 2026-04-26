import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma';
import { ReceiptPersistenceService } from './receipt-persistence.service';

@Module({
  imports: [PrismaModule],
  providers: [ReceiptPersistenceService],
  exports: [ReceiptPersistenceService],
})
export class ReceiptPersistenceModule {}
