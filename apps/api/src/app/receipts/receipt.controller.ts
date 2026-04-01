import {
  Body,
  Controller, Delete, FileTypeValidator, Get,
  MaxFileSizeValidator, Param,
  ParseFilePipe, Patch,
  Post, Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { JwtAuthGuard } from "@src/guards";
import { ReceiptService } from "./receipt.service";
import { FileInterceptor } from "@nestjs/platform-express";
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
  @UseInterceptors(FileInterceptor('receiptImage', {
    storage: diskStorage({
      destination: os.tmpdir(),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
      }
    })
  }))
  async uploadReceipt(
    @CurrentUser('id') userid: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/, skipMagicNumbersValidation: true }),
        ],
      })
    ) file: Express.Multer.File
  ) {
    return this.receiptService.processUpload(file, userid);
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
