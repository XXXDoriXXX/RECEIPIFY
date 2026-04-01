import { GoogleGenAI } from "@google/genai";
import { SmartReceiptResult, SmartReceiptSchema } from "../interfaces/smart-receipt.interface";
import { OcrStrategy } from "../ocr.strategy";
import { createReceiptExtractionPrompt } from "../prompts/receipt-extraction.prompt";
import { Logger } from "@nestjs/common";
import { ZodError } from "zod";
import { UnrecoverableError } from "bullmq";

export class GeminiMultimodalStrategy implements OcrStrategy {
  private readonly logger = new Logger(`${GeminiMultimodalStrategy.name}`);

  constructor(
    private readonly aiClient: GoogleGenAI,
    public readonly name: string
  ) {}

  async process(
    imageBuffer: Buffer,
    mimeType: string,
    categories: string[],
    signal: AbortSignal,
  ): Promise<SmartReceiptResult> {
    const prompt = createReceiptExtractionPrompt(categories, 'image');

    this.logger.log(`Using ${this.name} for multimodal extraction...`);

    const response = await this.aiClient.models.generateContent({
      model: this.name,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBuffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        abortSignal: signal,
      },
    });

    const jsonString = response.text;
    if (!jsonString?.trim()) {
      throw new Error(`[${this.name}] AI returned an empty response`);
    }

    try {
      const parsedJson = JSON.parse(jsonString);
      return SmartReceiptSchema.parse(parsedJson);
    } catch (e) {
      if (e instanceof ZodError || e instanceof SyntaxError) {
        this.logger.error(`[${this.name}] Permanent data parsing error: ${e.message}`);
        throw new UnrecoverableError(`Deterministic extraction failure with ${this.name}`);
      }
      throw e;
    }
  }
}
