import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { SmartReceiptResult } from "./interfaces/smart-receipt.interface";
import { OcrStrategy } from "./ocr.strategy";
import { GeminiMultimodalStrategy } from "./strategies/gemini-multimodal.strategy";
import { VisionGemmaHybridStrategy } from "./strategies/vision-gemma-hybrid.strategy";
import { VisionService } from "./vision.service";
import { UnrecoverableError } from "bullmq";

@Injectable()
export class OcrOrchestrator {
  private readonly logger = new Logger(OcrOrchestrator.name);
  private readonly aiClient: GoogleGenAI;
  private readonly tiers: OcrStrategy[];

  constructor(
    private readonly configService: ConfigService,
    private readonly visionService: VisionService
  ) {
    this.aiClient = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY')
    });

    this.tiers = [
      new GeminiMultimodalStrategy(this.aiClient, 'gemini-3.1-flash-lite-preview'), // Tier 1
      new GeminiMultimodalStrategy(this.aiClient, 'gemini-2.5-flash'), // Tier 2
      new VisionGemmaHybridStrategy(this.aiClient, this.visionService), // Tier 3
    ];
  }


  async extract(
    filePath: string,
    mimeType: string,
    categories: string[],
    signal: AbortSignal,
  ): Promise<SmartReceiptResult> {
    for (const strategy of this.tiers) {
      try {
        return await strategy.process(filePath, mimeType, categories, signal);
      } catch (e) {

        if (e instanceof UnrecoverableError) {
          this.logger.error(`[${strategy.name}] Permanent error. Stopping.`);
          throw e;
        }


        if (e instanceof Error && e.name === 'AbortError') {
          this.logger.error(`[${strategy.name}] Request aborted (timeout). Stopping pipeline.`);
          throw e;
        }

        if (this.isQuotaError(e)) {
          this.logger.warn(`[${strategy.name}] Rate limit (429). Trying next tier...`);
          continue;
        }

        this.logger.warn(`[${strategy.name}] Failed. Attempting fallback to next tier...`);
      }
    }

    throw new Error('All OCR extraction tiers exhausted (likely rate limited). Delegating to BullMQ retry.');
  }

  private isQuotaError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message || '';
    const asAny = err as any;
    return (
      asAny.status === 429 ||
      asAny.httpErrorCode === 429 ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('429')
    );
  }
}
