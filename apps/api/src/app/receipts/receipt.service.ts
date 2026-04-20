import 'multer';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from "@src/prisma";
import { StorageService } from "@src/storage";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SearchReceiptsDto } from "@src/dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @InjectQueue('ocr-jobs') private readonly ocrQueue: Queue
  ) {}

  async processUpload(file:Express.Multer.File, userId:string) {
    this.logger.log(`Processing receipt upload: ${userId}, file: ${file.originalname}`);
    try {
      this.logger.debug(`Starting storage upload for ${file.originalname}`);
      //upload s3
      const storageKey = await this.storageService.uploadFile(file, userId);
      this.logger.debug(`Storage upload complete: ${storageKey}. Creating DB record...`);

      //create DB record
      const receipt = await this.prisma.receipt.create({
        data: {
          userId: userId,
          totalAmount: 0,
          currencyCode: 'USD',
          purchaseDate: new Date(),
          images: {
            create: {
              storageKey: storageKey,
              mimeType: file.mimetype,
              fileSizeBytes: file.size,
            }
          }
        },
        include: {
          images: true,
        }
      });
      this.logger.log(`Receipt and image records created successfully: ${receipt.id}`);
      //enqueue ocr job
      await this.ocrQueue.add('process-receipt', {
        receiptId:receipt.id,
        imageId:receipt.images[0].id,
        storageKey:storageKey,
      }, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s base delay
        },
        removeOnComplete: true,
        removeOnFail: false,
      })
      this.logger.log(`Successfully enqueued OCR job for receipt: ${receipt.id}`);

      return {
        message: 'Receipt uploaded successfully. OCR processing pending.',
        receiptId: receipt.id,
        imageId: receipt.images[0].id,
      };
    } finally {
      if (file.path) {
        fs.unlink(file.path, (err) => {
          if (err) this.logger.error(`Failed to delete temp file ${file.path}`, err);
          else this.logger.debug(`Cleaned up temp file ${file.path}`);
        });
      }
    }
  }

  async searchReceipts(userId: string, params: SearchReceiptsDto) {
    const { query, status, minAmount, maxAmount, startDate, endDate, cursor, take = 20 } = params;

    const where: Prisma.ReceiptWhereInput = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {};
      if (minAmount !== undefined) where.totalAmount.gte = minAmount;
      if (maxAmount !== undefined) where.totalAmount.lte = maxAmount;
    }

    if (startDate !== undefined || endDate !== undefined) {
      where.purchaseDate = {};
      if (startDate !== undefined) where.purchaseDate.gte = startDate;
      if (endDate !== undefined) where.purchaseDate.lte = endDate;
    }

    if (query) {
      where.OR = [
        { title: { search: query } as any },
        { merchant: { name: { search: query } as any } },
      ];
    }

    const receipts = await this.prisma.receipt.findMany({
      where,
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { purchaseDate: 'desc' },
      select: {
        id: true,
        title: true,
        totalAmount: true,
        currencyCode: true,
        purchaseDate: true,
        status: true,
        source: true,
        merchant: {
          select: {
            id: true,
            name: true,
          }
        },
        images: {
          select: {
            id: true,
            storageKey: true,
            ocrStatus: true,
          }
        }
      }
    });

    let nextCursor: typeof cursor | null = null;
    if (receipts.length > take) {
      const nextItem = receipts.pop();
      nextCursor = nextItem!.id;
    }

    return {
      data: receipts,
      nextCursor,
    };
  }
}
