import {
  Controller, FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { JwtAuthGuard } from "@src/guards";
import { ReceiptUploadService } from "./receipt-upload.service";
import { ReceiptSearchService } from "./receipt-search.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as os from "os";
import { CurrentUser } from "@src/decorators";
import { SearchReceiptsDto } from "@src/dto";

@Controller('receipt')
@UseGuards(JwtAuthGuard)
export class ReceiptController {
  constructor(
    private readonly receiptUploadService: ReceiptUploadService,
    private readonly receiptSearchService: ReceiptSearchService,
  ) {}
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
      new ParseFilePipe(
        {
          validators: [
            new MaxFileSizeValidator({
              maxSize: 1024 * 1024 * 5, // 5MB
            }),
            new FileTypeValidator({
              fileType: /(jpg|jpeg|png)$/,
              skipMagicNumbersValidation: true,
            }),
          ],
        }),
    ) file: Express.Multer.File) {
    return this.receiptUploadService.processUpload(file, userid);
  }

  @Get()
  async searchReceipts(
    @CurrentUser('id') userid: string,
    @Query() params: SearchReceiptsDto
  ) {
    return this.receiptSearchService.searchReceipts(userid, params);
  }

  @Get(':id')
  async getReceiptDetails(
    @CurrentUser('id') userid: string,
    @Param('id') id: string,
  ) {
    return this.receiptSearchService.getReceiptById(userid, id);
  }
}
