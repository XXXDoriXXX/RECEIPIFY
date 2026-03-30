
import { Module } from '@nestjs/common';
import { OcrProcessor } from './ocr.processor';
import { VisionService } from './vision.service';

@Module({
  providers: [OcrProcessor, VisionService],
})
export class OcrModule {}
