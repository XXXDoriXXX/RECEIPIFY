import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma';

export interface ParsedReceiptData {
  rawText?: string;
  merchant: {
    name?: string;
    address?: string;
    city?: string;
    countryCode?: string;
    taxId?: string;
  };
  receipt: {
    totalAmount?: number;
    subtotalAmount?: number;
    taxAmount?: number;
    discountAmount?: number;
    currencyCode?: string;
    purchaseDate?: string | Date;
    paymentMethod?: string;
  };
  items: Array<{
    name: string;
    amount: number;
    quantity?: number;
    unit?: string;
    suggestedCategory?: string;
  }>;
  _confidenceScore?: number;
  _reasoning?: string;
}

@Injectable()
export class ReceiptPersistenceService {
  private readonly logger = new Logger(ReceiptPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveExtractedData(
    receiptId: string,
    imageId: string,
    parsedData: ParsedReceiptData
  ): Promise<void> {
    this.logger.debug(`Starting transactional DB persistence for receipt: ${receiptId}`);

    await this.prisma.$transaction(async (tx) => {
      // 1. fetch the original receipt
      const receiptRecord = await tx.receipt.findUnique({ where: { id: receiptId } });
      if (!receiptRecord) {
        throw new Error(`Receipt ${receiptId} not found in DB`);
      }

      // clear any existing expense items in case this is a job retry
      this.logger.debug(`Idempotency check: Clearing prior expense items for receipt ${receiptId}`);
      await tx.expenseItem.deleteMany({ where: { receiptId: receiptId } });

      // 2. find or create merchant
      const merchantName = (parsedData.merchant.name || 'Unknown Merchant').substring(0, 200);
      const merchant = await tx.merchant.upsert({
        where: { normalizedName: merchantName.toLowerCase() },
        update: {
          address: parsedData.merchant.address,
          city: parsedData.merchant.city,
          countryCode: parsedData.merchant.countryCode,
          taxId: parsedData.merchant.taxId,
        },
        create: {
          name: merchantName,
          normalizedName: merchantName.toLowerCase(),
          address: parsedData.merchant.address,
          city: parsedData.merchant.city,
          countryCode: parsedData.merchant.countryCode,
          taxId: parsedData.merchant.taxId,
        }
      });

      // 3. update the receipt header
      const purchaseDate = parsedData.receipt.purchaseDate
        ? new Date(parsedData.receipt.purchaseDate)
        : new Date();

      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          status: "done",
          merchantId: merchant.id,
          totalAmount: parsedData.receipt.totalAmount || 0,
          subtotalAmount: parsedData.receipt.subtotalAmount,
          taxAmount: parsedData.receipt.taxAmount,
          discountAmount: parsedData.receipt.discountAmount,
          paymentMethod: parsedData.receipt.paymentMethod,
          confidence: parsedData._confidenceScore,
          currencyCode: parsedData.receipt.currencyCode || 'USD',
          purchaseDate: purchaseDate
        }
      });

      // 4. save raw text
      await tx.receiptImage.update({
        where: { id: imageId },
        data: {
          ocrStatus: "done",
          ocrRawText: parsedData.rawText,
        }
      });

      // 5. build the expense items
      for (const item of parsedData.items) {
        const categoryName = item.suggestedCategory || 'Other';
        let category = await tx.category.findFirst({
          where: { name: categoryName }
        });
        if (!category) {
          category = await tx.category.create({
            data: {
              name: categoryName,
              colorHex: '#9CA3AF', //default gray
              isSystem: false,
              userId: receiptRecord.userId
            }
          });
        }
        await tx.expenseItem.create({
          data: {
            receiptId: receiptId,
            categoryId: category.id,
            name: item.name,
            amount: item.amount,
            quantity: item.quantity || 1,
            unit: item.unit
          }
        });
      }
    });

    this.logger.log(`Completed successful DB insert of ${parsedData.items.length} items for receipt: ${receiptId}`);
  }
}
