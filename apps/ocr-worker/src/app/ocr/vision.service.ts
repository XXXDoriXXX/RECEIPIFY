import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ImageAnnotatorClient } from "@google-cloud/vision";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly client = new ImageAnnotatorClient();

  async extractRawText(filePath: string): Promise<string> {
    this.logger.log(`Performing traditional OCR with Google Vision for ${filePath}...`);
    try {
      const [result] = await this.client.documentTextDetection({
        image: { source: { filename: filePath } },
      });
      const rawText = result.fullTextAnnotation?.text || '';

      if (!rawText) {
        this.logger.warn('Google Vision returned no text from image.');
      }

      return rawText;
    } catch (e) {
      this.logger.error('Google Vision API failed', e.stack);
      throw new InternalServerErrorException('Google Vision OCR Failed');
    }
  }
}
