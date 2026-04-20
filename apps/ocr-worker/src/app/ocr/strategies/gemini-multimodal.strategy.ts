import { GoogleGenAI } from "@google/genai";
import { SmartReceiptResult, SmartReceiptSchema } from "../interfaces/smart-receipt.interface";
import { OcrStrategy } from "../ocr.strategy";
import { createReceiptExtractionPrompt, EXTRACTION_SYSTEM_INSTRUCTION } from "../prompts/receipt-extraction.prompt";
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

    this.logger.log(`Using ${this.name} for multimodal extraction (inlineData)...`);

    try {
      const response = await this.aiClient.models.generateContent({
        model: this.name,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: imageBuffer.toString('base64'),
                  mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              merchant: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  address: { type: 'STRING' },
                  city: { type: 'STRING' },
                  country_code: { type: 'STRING' },
                },
                required: ["name"],
              },
              receipt: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  totalAmount: { type: 'NUMBER' },
                  currencyCode: { type: 'STRING' },
                  purchaseDate: { type: 'STRING' },
                  notes: { type: 'STRING' },
                },
                required: ["totalAmount", "currencyCode"],
              },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    amount: { type: 'NUMBER' },
                    quantity: { type: 'NUMBER' },
                    unit: { type: 'STRING' },
                    suggestedCategory: { type: 'STRING' },
                  },
                  required: ["name", "amount", "quantity", "suggestedCategory"],
                },
              },
              rawText: { type: 'STRING' },
            },
            required: ["merchant", "receipt", "items"],
          },
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
          this.logger.error(`[${this.name}] Data parsing error: ${e.message}`);
          throw new Error(`Data parsing or validation failure with ${this.name}`);
        }
        throw e;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw e;
      }
      this.logger.error(`[${this.name}] Model execution failed: ${e.message}`, e.stack);
      throw e;
    }
  }
}
