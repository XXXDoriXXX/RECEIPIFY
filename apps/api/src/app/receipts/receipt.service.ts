import 'multer';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import {PrismaService} from "@src/prisma";
import {StorageService} from "@src/storage";
import {InjectQueue} from "@nestjs/bullmq";
import {Queue} from "bullmq";

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

  async getReceipts(userId: string, search: string | undefined, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId,
      deletedAt: null,
    };

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { merchant: { name: { contains: search, mode: 'insensitive' } } },
        { items: { some: { name: { contains: search, mode: 'insensitive' } } } },
        { items: { some: { category: { name: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    const [total, receipts] = await Promise.all([
      this.prisma.receipt.count({ where: whereClause }),
      this.prisma.receipt.findMany({
        where: whereClause,
        include: {
          merchant: true,
          items: {
            include: { category: true }
          },
        },
        orderBy: { purchaseDate: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: receipts,
    };
  }

  async getReceiptById(userId: string, receiptId: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, userId, deletedAt: null },
      include: {
        images: true,
        merchant: true,
        items: {
          include: { category: true },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    return receipt;
  }

  async createReceiptManual(userId: string, dto: any) {
    return this.prisma.$transaction(async (tx) => {
      let merchantId = null;
      if (dto.merchantName) {
        const normalized = dto.merchantName.trim().toLowerCase();
        let merchant = await tx.merchant.findUnique({
          where: { normalizedName: normalized }
        });
        if (!merchant) {
          merchant = await tx.merchant.create({
            data: {
              name: dto.merchantName.trim(),
              normalizedName: normalized,
            }
          });
        }
        merchantId = merchant.id;
      }

      return tx.receipt.create({
        data: {
          userId,
          merchantId,
          title: dto.title,
          totalAmount: dto.totalAmount,
          currencyCode: dto.currencyCode,
          purchaseDate: new Date(dto.purchaseDate),
          status: 'done',
          source: 'manual',
          notes: dto.notes,
          items: {
            create: dto.items.map((item: any) => ({
              categoryId: item.categoryId,
              name: item.name,
              amount: item.amount,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true, merchant: true },
      });
    });
  }

  async updateReceipt(userId: string, receiptId: string, dto: any) {
    const receipt = await this.getReceiptById(userId, receiptId);

    return this.prisma.$transaction(async (tx) => {
      let merchantId = receipt.merchantId;
      if (dto.merchantName) {
        const normalized = dto.merchantName.trim().toLowerCase();
        let merchant = await tx.merchant.findUnique({
          where: { normalizedName: normalized }
        });
        if (!merchant) {
          merchant = await tx.merchant.create({
            data: {
              name: dto.merchantName.trim(),
              normalizedName: normalized,
            }
          });
        }
        merchantId = merchant.id;
      }

      const updateData: any = {};
      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.totalAmount !== undefined) updateData.totalAmount = dto.totalAmount;
      if (dto.currencyCode !== undefined) updateData.currencyCode = dto.currencyCode;
      if (dto.purchaseDate !== undefined) updateData.purchaseDate = new Date(dto.purchaseDate);
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (merchantId !== receipt.merchantId) updateData.merchantId = merchantId;

      if (dto.items && dto.items.length >= 0) {
        // Find existing items
        const existingItems = await tx.expenseItem.findMany({ where: { receiptId } });
        const existingIds = existingItems.map(i => i.id);
        const newIds = dto.items.map((i:any) => i.id).filter(Boolean);

        const idsToDelete = existingIds.filter(id => !newIds.includes(id));

        // delete removed items
        if (idsToDelete.length) {
          await tx.expenseItem.deleteMany({ where: { id: { in: idsToDelete } } });
        }

        // update or create new items
        for (const item of dto.items) {
          if (item.id) {
            await tx.expenseItem.update({
              where: { id: item.id },
              data: {
                name: item.name,
                amount: item.amount,
                quantity: item.quantity,
                categoryId: item.categoryId,
              }
            });
          } else {
            await tx.expenseItem.create({
              data: {
                receiptId,
                name: item.name,
                amount: item.amount,
                quantity: item.quantity,
                categoryId: item.categoryId,
              }
            });
          }
        }
      }

      const updated = await tx.receipt.update({
        where: { id: receiptId },
        data: updateData,
        include: { items: true, merchant: true },
      });

      return updated;
    });
  }

  async deleteReceipt(userId: string, receiptId: string) {
    // soft delete
    const receipt = await this.getReceiptById(userId, receiptId);

    await this.prisma.receipt.update({
      where: { id: receiptId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
