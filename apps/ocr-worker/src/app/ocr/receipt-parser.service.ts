import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { SmartReceiptResult, SmartReceiptSchema } from './interfaces/smart-receipt.interface';
import { createReceiptExtractionPrompt } from './prompts/receipt-extraction.prompt';

@Injectable()
export class ReceiptParserService {
  private readonly logger = new Logger(ReceiptParserService.name);
  private readonly aiClient: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.aiClient = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY')
    });
  }

  async parse(rawText: string, existingCategories: string[]): Promise<SmartReceiptResult> {
    this.logger.log('Sending raw OCR text to LLM for deep extraction...');

    try {
      const prompt = createReceiptExtractionPrompt(existingCategories);
      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: prompt + '\n\nRAW TEXT:\n' + rawText }] }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const jsonString = response.text;

      if (!jsonString) {
        throw new Error('LLM returned an empty response');
      }

      this.logger.debug('Parsing JSON string from LLM...');
      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonString);
      } catch (parseError) {
        this.logger.error('LLM output was not valid JSON', parseError.stack);
        throw parseError;
      }

      this.logger.debug('Validating extracted data against strict Zod schema...');
      const structuredData: SmartReceiptResult = SmartReceiptSchema.parse(parsedJson);

      this.logger.log(`LLM extracted ${structuredData.items.length} expense items successfully.`);
      return structuredData;

    } catch (error) {
      this.logger.error(`Failed to parse text via LLM: ${error.message}`, error.stack);
      throw new InternalServerErrorException('AI Parsing Engine Failure');
    }
  }
}
