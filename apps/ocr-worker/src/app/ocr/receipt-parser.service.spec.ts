import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptParserService } from './receipt-parser.service';

describe('ReceiptParserService', () => {
  let service: ReceiptParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptParserService],
    }).compile();

    service = module.get<ReceiptParserService>(ReceiptParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
