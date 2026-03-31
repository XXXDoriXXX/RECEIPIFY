import {Injectable, InternalServerErrorException, Logger} from "@nestjs/common";
import {OcrParsedResult} from "./interfaces/ocr-job.interface";
import {ImageAnnotatorClient} from "@google-cloud/vision";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly client = new ImageAnnotatorClient();

  async extractText(imageBuffer: Buffer): Promise<OcrParsedResult> {
    this.logger.log(`Sending image (${imageBuffer.length} bytes) to Google Vision API...`);
    try {
      const [result] = await this.client.documentTextDetection(imageBuffer);
      const rawText = result.fullTextAnnotation?.text || '';
      if (!rawText) {
        throw new Error('Google Vision returned no text.');
      }

      this.logger.log('Successfully extracted raw text from Google Vision.');
      return this.parseRawText(rawText);

    } catch (e) {
      this.logger.error('Google Vision API failed', e.stack);
      throw new InternalServerErrorException('Failed to process image with AI');
    }
  }
  private parseRawText(rawText: string): OcrParsedResult {
    // TODO:we will build a smart parser here to find the Merchant, Total, and Date  from the chaotic raw text string
    return {
      merchantName: 'Unknown Merchant',
      totalAmount: 0,
      date: new Date(),
      rawText: rawText,
    };
  }
}
