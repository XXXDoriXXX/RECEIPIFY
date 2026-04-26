
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { PrismaService } from "@src/prisma";
import { StorageService } from "@src/storage";
import { VisionService } from "./vision.service";
import { OcrJobData } from "./interfaces/ocr-job.interface";
import { ReceiptPersistenceService } from "@src/receipt-persistence";
import { Job } from "bullmq";
import { ExtractionContext } from "./prompts/receipt-extraction.prompt";

@Processor('ocr-jobs')
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly visionService: VisionService,
    private readonly persistenceService: ReceiptPersistenceService
  ) {
    super();
  }

  async process(job: Job<OcrJobData, any, string>): Promise<void> {
    const { receiptId, imageId, storageKey } = job.data;
    this.logger.log(`[Job ${job.id}] Started processing receipt: ${receiptId}`);

    try {
      this.logger.debug(`[Job ${job.id}] Updating receipt status to processing...`);
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'processing' }
      });

      this.logger.debug(`[Job ${job.id}] Fetching image buffer from MinIO for key: ${storageKey}`);
      const imageBuffer = await this.storageService.getFileBuffer(storageKey);

      this.logger.debug(`[Job ${job.id}] Fetching user context (categories and currency)...`);
      const receipt = await this.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: {
          user: {
            include: {
              categories: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (!receipt) {
        throw new Error(`Receipt ${receiptId} not found`);
      }

      const context: ExtractionContext = {
        availableCategories: receipt.user.categories.map(c => c.name),
        userCurrencyDefault: receipt.user.currencyCode
      };

      this.logger.debug(`[Job ${job.id}] Passing ${imageBuffer.length} bytes to vision extraction...`);
      const parsedData = await this.visionService.extractText(imageBuffer, context);

      this.logger.debug(`[Job ${job.id}] Starting transactional DB persistence...`);
      await this.persistenceService.saveExtractedData(receiptId, imageId, parsedData);

      this.logger.log(`[Job ${job.id}] Completed successfully. Inserted items for receipt: ${receiptId}`);

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

