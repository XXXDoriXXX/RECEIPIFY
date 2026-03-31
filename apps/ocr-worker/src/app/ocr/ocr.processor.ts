
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { PrismaService } from "@src/prisma";
import { StorageService } from "@src/storage";
import { VisionService } from "./vision.service";
import { OcrJobData } from "./interfaces/ocr-job.interface";
import { Job } from "bullmq";

@Processor('ocr-jobs')
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly visionService: VisionService
  ) {
    super();
  }

  async process(job: Job<OcrJobData, any, string>): Promise<void> {
    const { receiptId, imageId, storageKey } = job.data;
    this.logger.log(`[Job ${job.id}] Started processing receipt: ${receiptId}`);

    try {
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'processing' }
      });

      const imageBuffer = await this.storageService.getFileBuffer(storageKey);
      const parsedData = await this.visionService.extractText(imageBuffer);

      await this.prisma.$transaction(async (tx) => {
        // 1 fetch the original receipt
        const receiptRecord = await tx.receipt.findUnique({ where: { id: receiptId } });

        // 2 find or create merchant
        const merchantName = parsedData.merchant.name || 'Unknown Merchant';
        const merchant = await tx.merchant.upsert({
          where: { normalizedName: merchantName.toLowerCase() },
          update: {
            address: parsedData.merchant.address,
            city: parsedData.merchant.city,
            countryCode: parsedData.merchant.country_code,
          },
          create: {
            name: merchantName,
            normalizedName: merchantName.toLowerCase(),
            address: parsedData.merchant.address,
            city: parsedData.merchant.city,
            countryCode: parsedData.merchant.country_code,
          }
        });

        // 3 update the receipt header
        const purchaseDate = parsedData.receipt.purchaseDate
          ? new Date(parsedData.receipt.purchaseDate)
          : new Date();

        await tx.receipt.update({
          where: { id: receiptId },
          data: {
            status: "done",
            merchantId: merchant.id,
            totalAmount: parsedData.receipt.totalAmount || 0,
            currencyCode: parsedData.receipt.currencyCode || 'USD',
            purchaseDate: purchaseDate
          }
        });

        // 4 save raw text
        await tx.receiptImage.update({
          where: { id: imageId },
          data: {
            ocrStatus: "done",
            ocrRawText: parsedData.rawText,
          }
        });

        // 5 build the expense items
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
              quantity: item.quantity || 1
            }
          });
        }
      });

      this.logger.log(`[Job ${job.id}] Completed successfully. Inserted ${parsedData.items.length} items for receipt: ${receiptId}`);

    } catch (e) {
      this.logger.error(`[Job ${job.id}] Processing failed`, e.stack);
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'failed' },
      });
      throw e;
    }
  }
}
