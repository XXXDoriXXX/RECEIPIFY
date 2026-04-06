import { GoogleGenAI } from "@google/genai";
import { SmartReceiptResult, SmartReceiptSchema } from "../interfaces/smart-receipt.interface";
import { OcrStrategy } from "../ocr.strategy";
import { createReceiptExtractionPrompt } from "../prompts/receipt-extraction.prompt";
import { VisionService } from "../vision.service";
import { Logger } from "@nestjs/common";
import { ZodError } from "zod";
import { UnrecoverableError } from "bullmq";

export class VisionGemmaHybridStrategy implements OcrStrategy {
  private readonly logger = new Logger(`${VisionGemmaHybridStrategy.name}`);
  public readonly name = 'VisionGemmaHybrid';

  constructor(
    private readonly aiClient: GoogleGenAI,
    private readonly visionService: VisionService
  ) {}

  async process(
    filePath: string,
    mimeType: string,
    categories: string[],
    signal: AbortSignal,
  ): Promise<SmartReceiptResult> {
    this.logger.log('Starting hybrid extraction (Vision OCR + Gemma 3)...');

    // step 1: google vision ocr
    const rawText = await this.visionService.extractRawText(filePath);

    if (!rawText?.trim()) {
      throw new Error('[HybridStrategy] Google Vision returned no text, cannot proceed with Gemma extraction');
    }


    if (signal.aborted) {
      const abortError = new Error('Request aborted before Gemma step');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // step 2: extract json text using Gemma 3
    const prompt = createReceiptExtractionPrompt(categories, 'text');
    this.logger.log('Delegating text analysis to Gemma 3 27B...');

    const response = await this.aiClient.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${prompt}\n\nRAW TEXT FROM RECEIPT:\n${rawText}` }],
        },
      ],
      config: {
        abortSignal: signal
      },
    });

    const rawResponse = response.text || '';
    const jsonString = this.cleanJsonString(rawResponse);

    if (!jsonString?.trim()) {
      throw new Error('[HybridStrategy] Gemma 3 returned an empty/invalid response');
    }

    try {
      const parsedJson = JSON.parse(jsonString);
      const structured = SmartReceiptSchema.parse(parsedJson);
      structured.rawText = rawText;
      return structured;
    } catch (e) {
      if (e instanceof ZodError || e instanceof SyntaxError) {
        this.logger.error(`[HybridStrategy] Gemma 3 extraction error: ${e.message}. Raw output: ${rawResponse.substring(0, 100)}...`);
        throw new UnrecoverableError('Deterministic extraction failure with Gemma 3');
      }
      throw e;
    }
  }

  private cleanJsonString(input: string): string {
    return input
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }
}
