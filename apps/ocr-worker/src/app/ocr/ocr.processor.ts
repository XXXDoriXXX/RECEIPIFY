
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
      this.logger.debug(`[Job ${job.id}] Fetching receipt and user categories...`);
      const receiptRecord = await this.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: { user: true }
      });

      if (!receiptRecord) {
        throw new Error(`Receipt ${receiptId} not found in DB`);
      }

      const existingCategories = await this.prisma.category.findMany({
        where: {
          OR: [
            { isSystem: true },
            { userId: receiptRecord.userId }
          ]
        },
        select: { name: true }
      });
      const categoryNames = existingCategories.map(c => c.name);

      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'processing' }
      });

      this.logger.debug(`[Job ${job.id}] Fetching image buffer from MinIO for key: ${storageKey}`);
      const imageBuffer = await this.storageService.getFileBuffer(storageKey);

      this.logger.debug(`[Job ${job.id}] Passing ${imageBuffer.length} bytes to vision extraction...`);
      const parsedData = await this.visionService.extractText(imageBuffer, categoryNames);

      this.logger.debug(`[Job ${job.id}] Starting transactional DB persistence...`);
      await this.prisma.$transaction(async (tx) => {
        // clear any existing expense items in case this is a job retry
        this.logger.debug(`[Job ${job.id}] Idempotency check: Clearing prior expense items for receipt ${receiptId}`);
        await tx.expenseItem.deleteMany({ where: { receiptId: receiptId } });

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
            title: parsedData.receipt.title || `Receipt from ${merchantName}`,
            merchantId: merchant.id,
            totalAmount: parsedData.receipt.totalAmount || 0,
            currencyCode: parsedData.receipt.currencyCode || 'USD',
            purchaseDate: purchaseDate,
            notes: parsedData.receipt.notes
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
            where: {
              name: categoryName,
              OR: [
                { isSystem: true },
                { userId: receiptRecord.userId }
              ]
            }
          });
          if (!category) {
            category = await tx.category.create({
              data: {
                name: categoryName,
                colorHex: '#0006ff',
                iconSlug: 'tag',
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

      this.logger.log(`[Job ${job.id}] Completed successfully. Inserted ${parsedData.items.length} items for receipt: ${receiptId}`);

    } catch (e) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts || 1;

      this.logger.error(`[Job ${job.id}] Processing failure (Attempt ${attemptsMade}/${maxAttempts}): ${e.message}`, e.stack);

      if (attemptsMade >= maxAttempts) {
        this.logger.error(`[Job ${job.id}] Terminal failure on last attempt. Marking receipt ${receiptId} as failed.`);
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: { status: 'failed' },
        });
      } else {
        this.logger.warn(`[Job ${job.id}] AI call failed or demand spike. Will retry via exponential backoff (Attempt ${attemptsMade}/${maxAttempts})...`);
      }
      throw e;
    }
  }
}

