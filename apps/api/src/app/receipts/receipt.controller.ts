import {
  Controller, FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {JwtAuthGuard} from "@src/guards";
import {ReceiptService} from "./receipt.service";
import {FileInterceptor} from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as os from "os";
import {CurrentUser} from "@src/decorators";

@Controller('receipt')
@UseGuards(JwtAuthGuard)
export class ReceiptController {
  constructor(private readonly receiptService:ReceiptService) {
  }
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
    @CurrentUser('id') userid:string,
    @UploadedFile(
    new ParseFilePipe(
      {validators:[
          new MaxFileSizeValidator({
            maxSize:1024*1024*5, // 5MB
          }),
          new FileTypeValidator({
            fileType: '.(jpeg|jpg|png)$',
          }),
        ],
      }),
  ) file: Express.Multer.File) {
    return this.receiptService.processUpload(file, userid);
  }
}
