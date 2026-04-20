import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';

describe('ReceiptController', () => {
  let controller: ReceiptController;

  const mockReceiptService = {
    processUpload: jest.fn(),
    searchReceipts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptController],
      providers: [
        {
          provide: ReceiptService,
          useValue: mockReceiptService,
        },
      ],
    }).compile();

    controller = module.get<ReceiptController>(ReceiptController);
  });

  it('should call receiptService.searchReceipts with correct parameters', async () => {
    const userId = '123';
    const params = { take: 10, minAmount: 50 };
    const result = { data: [], cursor: null };
    mockReceiptService.searchReceipts.mockResolvedValue(result);

    expect(await controller.searchReceipts(userId, params)).toEqual(result);
    expect(mockReceiptService.searchReceipts).toHaveBeenCalledWith(userId, params);
  });
});
