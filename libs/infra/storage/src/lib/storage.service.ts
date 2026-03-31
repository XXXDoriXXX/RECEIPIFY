import 'multer';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
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
    this.logger.log(`Checking MinIO bucket existence: ${this.bucketName}`);
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'eu-central-1');
        this.logger.log(`Created new MinIO bucket: ${this.bucketName}`);
      }
    } catch (e) {
      this.logger.error(`Failed to initialize MinIO bucket: ${this.bucketName}`, e);
      throw e;
    }
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    const extension = file.originalname.split('.').pop();
    const storageKey = `receipts/${userId}/${uuidv4()}.${extension}`;

    if (file.path) {
      this.logger.debug(`Streaming file from disk to MinIO: ${file.path}`);
      await this.minioClient.fPutObject(
        this.bucketName,
        storageKey,
        file.path,
        { 'Content-Type': file.mimetype }
      );
    } else {
      this.logger.debug(`Uploading file out of memory to MinIO: ${file.size} bytes`);
      await this.minioClient.putObject(
        this.bucketName,
        storageKey,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype }
      );
    }

    this.logger.log(`File uploaded to MinIO successfully: ${storageKey} (${file.size} bytes)`);

    return storageKey;
  }
  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const dataStream = await this.minioClient.getObject(this.bucketName, storageKey);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      dataStream.on('data',(chunk)=>chunks.push(chunk));
      dataStream.on('end',() => resolve(Buffer.concat(chunks)));
      dataStream.on('error',(err)=>reject(err));
    })
  }
}
