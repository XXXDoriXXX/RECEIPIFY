import { SmartReceiptResult } from './interfaces/smart-receipt.interface';

export interface OcrStrategy {
  process(
    filePath: string,
    mimeType: string,
    categories: string[],
    signal: AbortSignal,
  ): Promise<SmartReceiptResult>;
  readonly name: string;
}
