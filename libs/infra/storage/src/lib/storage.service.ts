
import 'multer';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(
    @InjectPinoLogger(StorageService.name) private readonly logger: PinoLogger,
    private readonly configService: ConfigService
  ) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'fallback_bucket');
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minio_access_key'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minio_secret_key'),
    });
  }

  async onModuleInit() {
    this.logger.info({ bucketName: this.bucketName }, 'Checking MinIO bucket existence');
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'eu-central-1');
        this.logger.info({ bucketName: this.bucketName }, 'Created new MinIO bucket');
      }
    } catch (e) {
      this.logger.error({ err: e, bucketName: this.bucketName }, 'Failed to initialize MinIO bucket');
      throw e;
    }
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    const extension = file.originalname.split('.').pop();
    const storageKey = `receipts/${userId}/${uuidv4()}.${extension}`;

    await this.minioClient.putObject(
      this.bucketName,
      storageKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype }
    );

    this.logger.info({ storageKey, size: file.size }, 'File uploaded to MinIO successfully');

    return storageKey;
  }
}
