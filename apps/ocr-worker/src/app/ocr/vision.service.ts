import {Injectable, Logger} from "@nestjs/common";
import {OcrParsedResult} from "./interfaces/ocr-job.interface";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);


  async extractText(imageBuffer: Buffer): Promise<OcrParsedResult> {
    this.logger.log(`Analyzing image buffer of size: ${imageBuffer.length} bytes`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    //TODO: replace with real @google-cloud/vision SDK logic
    const mockExtractedText = "KFC \n Total: 15.99 \n Date: 2026-03-30";
    this.logger.log('OCR text extraction complete. Parsing financial data...');
    return {
      merchantName: 'KFC',
      totalAmount: 15.99,
      date: new Date(),
      rawText: mockExtractedText
    };
  }

}
