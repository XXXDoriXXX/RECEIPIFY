import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptController } from './receipt.controller';
import { ReceiptUploadService } from './receipt-upload.service';
import { ReceiptSearchService } from './receipt-search.service';

describe('ReceiptController', () => {
  let controller: ReceiptController;

  const mockReceiptUploadService = {
    processUpload: jest.fn(),
  };
  const mockReceiptSearchService = {
    searchReceipts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptController],
      providers: [
        {
          provide: ReceiptUploadService,
          useValue: mockReceiptUploadService,
        },
        {
          provide: ReceiptSearchService,
          useValue: mockReceiptSearchService,
        },
      ],
    }).compile();

    controller = module.get<ReceiptController>(ReceiptController);
  });

  it('should call receiptSearchService.searchReceipts with correct parameters', async () => {
    const userId = '123';
    const params = { take: 10, minAmount: 50 };
    const result = { data: [], cursor: null };
    mockReceiptSearchService.searchReceipts.mockResolvedValue(result);

    expect(await controller.searchReceipts(userId, params)).toEqual(result);
    expect(mockReceiptSearchService.searchReceipts).toHaveBeenCalledWith(userId, params);
  });
});
