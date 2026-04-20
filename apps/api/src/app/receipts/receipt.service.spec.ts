import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptService } from './receipt.service';

import { PrismaService } from '@src/prisma';
import { StorageService } from '@src/storage';
import { getQueueToken } from '@nestjs/bullmq';

describe('ReceiptService', () => {
  let service: ReceiptService;
  let prisma: PrismaService;

  const mockPrismaService = {
    receipt: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: {} },
        { provide: getQueueToken('ocr-jobs'), useValue: {} },
      ],
    }).compile();

    service = module.get<ReceiptService>(ReceiptService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should generate correct prisma parameters for search with cursor and omit ocrRawText', async () => {
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    const params = { take: 2, query: 'food', cursor: '123-abc' };
    
    await service.searchReceipts('u1', params);

    expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1' }),
      take: 3, // take + 1 to check next page
      cursor: { id: '123-abc' },
      skip: 1,
      select: expect.not.objectContaining({ images: expect.objectContaining({ select: { ocrRawText: true } }) })
    }));
  });
});
