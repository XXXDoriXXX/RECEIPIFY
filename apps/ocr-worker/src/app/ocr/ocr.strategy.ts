import { SmartReceiptResult } from './interfaces/smart-receipt.interface';

export interface OcrStrategy {
  process(imageBuffer: Buffer, mimeType: string, categories: string[]): Promise<SmartReceiptResult>;
  readonly name: string;
}
