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
    filePath: string,
    mimeType: string,
    categories: string[],
    signal: AbortSignal,
  ): Promise<SmartReceiptResult> {
    const prompt = createReceiptExtractionPrompt(categories, 'image');

    this.logger.log(`Using ${this.name} for multimodal extraction (File API)...`);

    // 1 upload to Gemini
    const uploadResult = await this.aiClient.files.upload({
      file: filePath,
      config: { mimeType }
    });

    try {
      this.logger.debug(`[${this.name}] File uploaded to Gemini: ${uploadResult.uri}`);

      const response = await this.aiClient.models.generateContent({
        model: this.name,
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: uploadResult.uri!,
                  mimeType: uploadResult.mimeType!,
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
          this.logger.error(`[${this.name}] Data parsing error: ${e.message}`);
          throw new Error(`Data parsing or validation failure with ${this.name}`);
        }
        throw e;
      }
    } finally {
      // 2 clean up Gemini file
      if (uploadResult.name) {
        this.aiClient.files.delete({ name: uploadResult.name }).catch(err => {
          this.logger.warn(`[${this.name}] Failed to delete Gemini file ${uploadResult.name}: ${err.message}`);
        });
      }
    }
  }
}
