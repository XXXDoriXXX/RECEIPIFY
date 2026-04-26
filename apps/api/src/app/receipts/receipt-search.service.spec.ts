import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptSearchService } from './receipt-search.service';
import { PrismaService } from '@src/prisma';

describe('ReceiptSearchService', () => {
  let service: ReceiptSearchService;
  let prisma: PrismaService;

  const mockPrismaService = {
    receipt: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptSearchService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReceiptSearchService>(ReceiptSearchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should generate correct prisma parameters for search with cursor and omit ocrRawText', async () => {
    mockPrismaService.receipt.findMany.mockResolvedValue([]);
    const params = { take: 2, query: 'food', cursor: '123-abc' };
    
    await service.searchReceipts('u1', params);

    expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1' }),
      take: 3, 
      cursor: { id: '123-abc' },
      skip: 1,
      select: expect.not.objectContaining({ images: expect.objectContaining({ select: { ocrRawText: true } }) })
    }));
  });
});
