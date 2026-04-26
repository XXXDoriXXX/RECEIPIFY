import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptUploadService } from './receipt-upload.service';
import { PrismaService } from '@src/prisma';
import { StorageService } from '@src/storage';
import { getQueueToken } from '@nestjs/bullmq';

describe('ReceiptUploadService', () => {
  let service: ReceiptUploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptUploadService,
        { provide: PrismaService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: getQueueToken('ocr-jobs'), useValue: {} },
      ],
    }).compile();

    service = module.get<ReceiptUploadService>(ReceiptUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
