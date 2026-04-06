
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma';
import { OcrJobData } from './interfaces/ocr-job.interface';
import { Job } from 'bullmq';
import { ReceiptProcessingService } from './receipt-processing.service';

@Processor('ocr-jobs', {
  concurrency: 5,
  limiter: {
    max: 15,
    duration: 60_000, // max 15 works for 60s
  },
})
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptProcessingService: ReceiptProcessingService,
  ) {
    super();
  }

  async process(job: Job<OcrJobData, any, string>): Promise<void> {
    const { receiptId } = job.data;
    const startedAt = Date.now();
    this.logger.log(`[Job ${job.id}] Started processing receipt: ${receiptId}`);

    let receiptUserId: string | null = null;

    try {
      const result = await this.receiptProcessingService.processReceipt(job);
      receiptUserId = result.receiptUserId;

      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `[Job ${job.id}] Completed in ${totalMs}ms. ` +
        `Items: ${result.totalItems}, new categories: ${result.newCategoriesCount}, receipt: ${receiptId}`
      );
    } catch (e) {
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      this.logger.error(
        `[Job ${job.id}] Failure (attempt ${attemptsMade}/${maxAttempts}): ${e.message}`,
        e.stack,
      );

      if (attemptsMade >= maxAttempts) {
        this.logger.error(`[Job ${job.id}] Terminal failure. Marking receipt ${receiptId} as failed.`);
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: { status: 'failed' },
        }).catch(updateErr => {
          this.logger.error(`[Job ${job.id}] Could not mark receipt as failed: ${updateErr.message}`);
        });
      } else {
        this.logger.warn(`[Job ${job.id}] Will retry via exponential backoff...`);
      }

      throw e;
    }
  }
}
