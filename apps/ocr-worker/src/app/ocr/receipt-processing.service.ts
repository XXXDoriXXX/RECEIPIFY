import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma';
import { StorageService } from '@src/storage';
import { OcrOrchestrator } from './ocr-orchestrator.service';
import { OcrJobData } from './interfaces/ocr-job.interface';
import { Job } from 'bullmq';
import * as fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import sharp from 'sharp';
import * as os from 'node:os';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'node:stream/promises';

@Injectable()
export class ReceiptProcessingService {
  private readonly logger = new Logger(ReceiptProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly ocrOrchestrator: OcrOrchestrator,
  ) {}

  async processReceipt(job: Job<OcrJobData, any, string>): Promise<{ receiptUserId: string; totalItems: number; newCategoriesCount: number }> {
    const { receiptId, imageId, storageKey } = job.data;
    let tempFilePath: string | null = null;

    try {
      // 1. Fetch receipt and categories
      this.logger.debug(`[Job ${job.id}] Fetching receipt...`);
      const receiptRecord = await this.prisma.receipt.findUnique({
        where: { id: receiptId },
        select: { id: true, userId: true },
      });

      if (!receiptRecord) {
        throw new Error(`Receipt ${receiptId} not found in DB`);
      }

      const receiptUserId = receiptRecord.userId;

      this.logger.debug(`[Job ${job.id}] Fetching user categories...`);
      const categories = await this.prisma.category.findMany({
        where: {
          OR: [{ isSystem: true }, { userId: receiptUserId }],
        },
        select: { id: true, name: true },
      });

      const categoryMap = new Map(categories.map((c) => [c.name, c]));
      const categoryNames = [...categoryMap.keys()];

      // 2. Mark as processing
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

      // 3. Download and pre-process image (Resizing/Compression)
      this.logger.debug(`[Job ${job.id}] Streaming and pre-processing image from MinIO: ${storageKey}`);

      const tmpDir = os.tmpdir();
      tempFilePath = path.join(tmpDir, `receiptify-proc-${uuidv4()}.jpg`);

      const imageStream = await this.storageService.getObjectStream(storageKey);
      const resizer = sharp()
        .resize(1600, null, { withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true });

      await pipeline(imageStream as any, resizer, createWriteStream(tempFilePath));

      const processedBuffer = await fs.readFile(tempFilePath);
      this.logger.debug(`[Job ${job.id}] Image pre-processed: ${processedBuffer.length} bytes. Path: ${tempFilePath}`);

      const aiStartedAt = Date.now();
      this.logger.debug(`[Job ${job.id}] Sending buffer to OCR Orchestrator (Multi-Tier)...`);

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        this.logger.warn(`[Job ${job.id}] OCR timeout (120s). Aborting request...`);
        controller.abort();
      }, 120_000);

      let parsedData: Awaited<ReturnType<typeof this.ocrOrchestrator.extract>>;
      try {
        parsedData = await this.ocrOrchestrator.extract(
          processedBuffer,
          'image/jpeg',
          categoryNames,
          controller.signal,
        );
      } finally {
        clearTimeout(timeoutHandle);
      }
      this.logger.debug(`[Job ${job.id}] OCR Orchestration finished in ${Date.now() - aiStartedAt}ms`);

      // 4. Resolve or create missing categories
      const uniqueRequestedNames = [...new Set(parsedData.items.map((i) => i.suggestedCategory || 'Other'))];
      const missingNames = uniqueRequestedNames.filter((name) => !categoryMap.has(name));

      if (missingNames.length > 0) {
        this.logger.debug(`[Job ${job.id}] Creating ${missingNames.length} new categories: ${missingNames.join(', ')}`);
        await this.prisma.category.createMany({
          data: missingNames.map((name) => ({
            name,
            colorHex: '#0006ff',
            iconSlug: 'tag',
            isSystem: false,
            userId: receiptUserId,
          })),
          skipDuplicates: true,
        });

        const newCategories = await this.prisma.category.findMany({
          where: { name: { in: missingNames }, userId: receiptUserId },
          select: { id: true, name: true },
        });
        newCategories.forEach((c) => categoryMap.set(c.name, c));
      }

      // 5. Transactional persistence
      this.logger.debug(`[Job ${job.id}] Starting transactional DB persistence...`);
      await this.prisma.$transaction(async (tx) => {
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
          data: parsedData.items.map((item) => {
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
      }, {
        maxWait: 10000,
        timeout: 30000,
      });

      return {
        receiptUserId,
        totalItems: parsedData.items.length,
        newCategoriesCount: missingNames.length,
      };
    } finally {
      if (tempFilePath) {
        this.logger.debug(`[Job ${job.id}] Deleting temp file: ${tempFilePath}`);
        await fs.unlink(tempFilePath).catch((err) => {
          this.logger.warn(`[Job ${job.id}] Failed to delete temp file ${tempFilePath}: ${err.message}`);
        });
      }
    }
  }
}
