
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { SmartReceiptResult } from './interfaces/smart-receipt.interface';
import { RECEIPT_EXTRACTION_PROMPT } from './prompts/receipt-extraction.prompt';

@Injectable()
export class ReceiptParserService {
  private readonly logger = new Logger(ReceiptParserService.name);
  private readonly aiClient: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.aiClient = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY')
    });
  }

  async parse(rawText: string): Promise<SmartReceiptResult> {
    this.logger.log('Sending raw OCR text to LLM for deep extraction...');

    try {
      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: RECEIPT_EXTRACTION_PROMPT + '\n\nRAW TEXT:\n' + rawText }] }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const jsonString = response.text;

      if (!jsonString) {
        throw new Error('LLM returned an empty response');
      }

      const structuredData: SmartReceiptResult = JSON.parse(jsonString);

      this.logger.log(`LLM extracted ${structuredData.items.length} expense items.`);
      return structuredData;

    } catch (error) {
      this.logger.error('Failed to parse text via LLM', error.stack);
      throw new InternalServerErrorException('AI Parsing Engine Failure');
    }
  }
}
