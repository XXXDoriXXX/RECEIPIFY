
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma';
import { StorageService } from '@src/storage';
import { OcrOrchestrator } from './ocr-orchestrator.service';
import { OcrJobData } from './interfaces/ocr-job.interface';
import { Job, UnrecoverableError } from 'bullmq';

@Processor('ocr-jobs', { concurrency: 5 })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly ocrOrchestrator: OcrOrchestrator,
  ) {
    super();
  }

  async process(job: Job<OcrJobData, any, string>): Promise<void> {
    const { receiptId, imageId, storageKey } = job.data;
    const startedAt = Date.now();
    this.logger.log(`[Job ${job.id}] Started processing receipt: ${receiptId}`);

    let receiptUserId: string | null = null;

    try {
      //1 fetch receipt, then categories
      this.logger.debug(`[Job ${job.id}] Fetching receipt...`);
      const receiptRecord = await this.prisma.receipt.findUnique({
        where: { id: receiptId },
        select: { id: true, userId: true },
      });

      if (!receiptRecord) {
        throw new Error(`Receipt ${receiptId} not found in DB`);
      }

      receiptUserId = receiptRecord.userId;

      this.logger.debug(`[Job ${job.id}] Fetching user categories...`);
      const categories = await this.prisma.category.findMany({
        where: {
          OR: [{ isSystem: true }, { userId: receiptRecord.userId }],
        },
        select: { id: true, name: true },
      });


      const categoryMap = new Map(categories.map(c => [c.name, c]));
      const categoryNames = [...categoryMap.keys()];

      // 2 mark sa proccesing
      const [, imageRecord] = await Promise.all([
        this.prisma.receipt.update({
          where: { id: receiptId },
          data: { status: 'processing' },
        }),
        this.prisma.receiptImage.findUnique({
          where: { id: imageId },
          select: { mimeType: true },
        }),
      ]);

      const mimeType = imageRecord?.mimeType ?? 'image/jpeg';

      //3 download image, send directly to Gemini
      this.logger.debug(`[Job ${job.id}] Fetching image buffer from MinIO: ${storageKey}`);
      const imageBuffer = await this.storageService.getFileBuffer(storageKey);

      const aiStartedAt = Date.now();
      this.logger.debug(`[Job ${job.id}] Sending ${imageBuffer.length} bytes to OCR Orchestrator (Multi-Tier)...`);

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        this.logger.warn(`[Job ${job.id}] OCR timeout (120s). Aborting request...`);
        controller.abort();
      }, 120_000);

      let parsedData: Awaited<ReturnType<typeof this.ocrOrchestrator.extract>>;
      try {
        parsedData = await this.ocrOrchestrator.extract(
          imageBuffer, mimeType, categoryNames, controller.signal,
        );
      } finally {
        clearTimeout(timeoutHandle);
      }
      this.logger.debug(`[Job ${job.id}] OCR Orchestration finished in ${Date.now() - aiStartedAt}ms`);

      // 4 resolve or create missing categories
      const uniqueRequestedNames = [...new Set(parsedData.items.map(i => i.suggestedCategory || 'Other'))];
      const missingNames = uniqueRequestedNames.filter(name => !categoryMap.has(name));

      if (missingNames.length > 0) {
        this.logger.debug(`[Job ${job.id}] Creating ${missingNames.length} new categories: ${missingNames.join(', ')}`);
        await this.prisma.category.createMany({
          data: missingNames.map(name => ({
            name,
            colorHex: '#0006ff',
            iconSlug: 'tag',
            isSystem: false,
            userId: receiptRecord.userId,
          })),
          skipDuplicates: true,
        });

        const newCategories = await this.prisma.category.findMany({
          where: { name: { in: missingNames }, userId: receiptRecord.userId },
          select: { id: true, name: true },
        });
        newCategories.forEach(c => categoryMap.set(c.name, c));
      }

      // 5 transactional persistence
      this.logger.debug(`[Job ${job.id}] Starting transactional DB persistence...`);
      await this.prisma.$transaction(async tx => {

        if (job.attemptsMade > 0) {
          await tx.expenseItem.deleteMany({ where: { receiptId } });
        }
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
          },
        });

        const purchaseDate = parsedData.receipt.purchaseDate
          ? new Date(parsedData.receipt.purchaseDate)
          : new Date();

        await Promise.all([
          tx.receipt.update({
            where: { id: receiptId },
            data: {
              status: 'done',
              title: parsedData.receipt.title || `Receipt from ${merchantName}`,
              merchantId: merchant.id,
              totalAmount: parsedData.receipt.totalAmount || 0,
              currencyCode: parsedData.receipt.currencyCode || 'USD',
              purchaseDate,
              notes: parsedData.receipt.notes,
            },
          }),
          tx.receiptImage.update({
            where: { id: imageId },
            data: { ocrStatus: 'done', ocrRawText: parsedData.rawText },
          }),
        ]);

        await tx.expenseItem.createMany({
          data: parsedData.items.map(item => {
            const categoryName = item.suggestedCategory || 'Other';
            const category = categoryMap.get(categoryName);
            return {
              receiptId,
              categoryId: category!.id,
              name: item.name,
              amount: item.amount,
              quantity: item.quantity || 1,
              unit: item.unit,
            };
          }),
        });
      });

      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `[Job ${job.id}] Completed in ${totalMs}ms. ` +
        `Items: ${parsedData.items.length}, new categories: ${missingNames.length}, receipt: ${receiptId}`
      );

    } catch (e) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      this.logger.error(
        `[Job ${job.id}] Failure (attempt ${attemptsMade}/${maxAttempts}): ${e.message}`,
        e.stack,
      );

      if (attemptsMade >= maxAttempts && receiptUserId !== null) {
        this.logger.error(`[Job ${job.id}] Terminal failure. Marking receipt ${receiptId} as failed.`);
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: { status: 'failed' },
        }).catch(updateErr => {
          this.logger.error(`[Job ${job.id}] Could not mark receipt as failed: ${updateErr.message}`);
        });
      } else if (attemptsMade < maxAttempts) {
        this.logger.warn(`[Job ${job.id}] Will retry via exponential backoff...`);
      }

      throw e;
    }
  }
}
