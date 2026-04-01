
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { SmartReceiptResult } from "./interfaces/smart-receipt.interface";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { ReceiptParserService } from "./receipt-parser.service";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly client = new ImageAnnotatorClient();

  constructor(private readonly parserService: ReceiptParserService) {}

  async extractText(imageBuffer: Buffer, existingCategories: string[]): Promise<SmartReceiptResult> {
    this.logger.log(`Sending image (${imageBuffer.length} bytes) to Google Vision API...`);
    try {
      const [result] = await this.client.documentTextDetection(imageBuffer);
      const rawText = result.fullTextAnnotation?.text || '';
      if (!rawText) {
        throw new Error('Google Vision returned no text.');
      }

      this.logger.log('Successfully extracted raw text. Delegating to AI Parser...');

      const parsedData = await this.parserService.parse(rawText, existingCategories);
      parsedData.rawText = rawText;

      return parsedData;

    } catch (e) {
      this.logger.error('Google Vision API failed', e.stack);
      throw new InternalServerErrorException('Failed to process image with AI');
    }
  }
}
