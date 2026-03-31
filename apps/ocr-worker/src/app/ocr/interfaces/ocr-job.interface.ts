export interface OcrJobData {
  receiptId: string; //id from PostgreSQL
  imageId: string;//id from S3
  storageKey: string;//key from S3
}

export interface OcrParsedResult {
  merchantName: string;
  totalAmount: number;
  date: Date;
  rawText: string;
}
