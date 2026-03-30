import {Processor, WorkerHost} from "@nestjs/bullmq";
import {Logger} from "@nestjs/common";
import {PrismaService} from "@src/prisma";
import {StorageService} from "@src/storage";
import {VisionService} from "./vision.service";
import {OcrJobData} from "./interfaces/ocr-job.interface";
import {Job} from "bullmq";

@Processor('ocr-jobs')
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);
  constructor(
    private readonly prisma:PrismaService,
    private readonly storageService:StorageService,
    private readonly visionService:VisionService
  ) {
    super();
  }

  async process(job: Job<OcrJobData, any, string>):Promise<void> {
    const {receiptId, imageId, storageKey} = job.data;
    this.logger.log(`[Job ${job.id}] Started processing receipt: ${receiptId}`);

    try {
      await this.prisma.receipt.update({
        where: {id:receiptId},
        data: {status: 'processing'}
      })
      const imageBuffer = await this.storageService.getFileBuffer(storageKey);

      const parsedData = await this.visionService.extractText(imageBuffer);

      await this.prisma.$transaction(async (tx) => {
       //find or create merchant
        const merchant = await tx.merchant.upsert({
          where:{normalizedName: parsedData.merchantName.toLowerCase()},
          update:{},
          create:{
            name:parsedData.merchantName,
            normalizedName:parsedData.merchantName.toLowerCase(),
          }
        })
        //update receipt
        await tx.receipt.update({
          where:{
            id:receiptId
          },
          data:{
            status:"done",
            merchantId:merchant.id,
            totalAmount: parsedData.totalAmount,
            purchaseDate: parsedData.date
          }
        });
        //save raw text
        await tx.receiptImage.update({
          where:{id:imageId},
          data:{
            ocrStatus:"done",
            ocrRawText:parsedData.rawText,
          }
        });
      });
      this.logger.log(`[Job ${job.id}] Completed successfully for receipt: ${receiptId}`);
    }catch (e) {
      this.logger.error(`[Job ${job.id}] Processing failed`, e.stack);


      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'failed' },
      });
      throw e;
    }






  }

}
