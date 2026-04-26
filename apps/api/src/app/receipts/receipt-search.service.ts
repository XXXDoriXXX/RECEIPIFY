import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from "@src/prisma";
import { SearchReceiptsDto } from "@src/dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ReceiptSearchService {
  constructor(private readonly prisma: PrismaService) {}

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
        subtotalAmount: true,
        taxAmount: true,
        discountAmount: true,
        paymentMethod: true,
        confidence: true,
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
        },
        items: {
          select: {
            id: true,
            name: true,
            amount: true,
            quantity: true,
            category: {
              select: {
                id: true,
                name: true,
                colorHex: true,
                iconSlug: true,
              }
            }
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

  async getReceiptById(userId: string, receiptId: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: {
        id: receiptId,
        userId,
        deletedAt: null,
      },
      include: {
        merchant: true,
        items: {
          include: {
            category: true,
          },
        },
        images: {
          select: {
            id: true,
            storageKey: true,
            ocrStatus: true,
            ocrRawText: true,
            createdAt: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
    }

    return receipt;
  }
}
