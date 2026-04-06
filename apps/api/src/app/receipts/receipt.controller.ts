import {
  Body,
  Controller, Delete, FileTypeValidator, Get,
  HttpCode, HttpStatus,
  MaxFileSizeValidator, Param,
  ParseFilePipe, Patch,
  Post, Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { JwtAuthGuard } from "@src/guards";
import { ReceiptService } from "./receipt.service";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as os from "os";
import { CurrentUser } from "@src/decorators";
import { ZodValidationPipe } from "@src/pipes";
import {
  CreateReceiptManualDto, CreateReceiptManualSchema,
  UpdateReceiptDto, UpdateReceiptSchema,
  ReceiptFilterDto, ReceiptFilterSchema
} from "@src/dto";

@Controller('receipt')
@UseGuards(JwtAuthGuard)
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FilesInterceptor('receiptImages', 20, {
    storage: diskStorage({
      destination: os.tmpdir(),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
      }
    })
  }))
  async uploadReceipts(
    @CurrentUser('id') userId: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),          // 5 MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/, skipMagicNumbersValidation: true }),
        ],
      })
    ) files: Express.Multer.File[]
  ) {
    return this.receiptService.processUpload(files, userId);
  }

  @Post()
  async createReceipt(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreateReceiptManualSchema)) dto: CreateReceiptManualDto
  ) {
    return this.receiptService.createReceiptManual(userId, dto);
  }

  @Get()
  async getReceipts(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(ReceiptFilterSchema)) query: ReceiptFilterDto
  ) {
    return this.receiptService.getReceipts(userId, query.search, query.page, query.limit);
  }

  @Get(':id')
  async getReceiptById(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string
  ) {
    return this.receiptService.getReceiptById(userId, receiptId);
  }

  @Patch(':id')
  async updateReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string,
    @Body(new ZodValidationPipe(UpdateReceiptSchema)) dto: UpdateReceiptDto
  ) {
    return this.receiptService.updateReceipt(userId, receiptId, dto);
  }

  @Delete(':id')
  async deleteReceipt(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string
  ) {
    return this.receiptService.deleteReceipt(userId, receiptId);
  }
}
