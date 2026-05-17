import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageAdapter } from './adapter';

export class R2Storage implements StorageAdapter {
  private client: S3Client;
  private bucket = process.env.R2_BUCKET!;
  private base = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '');
  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  async putUrl(key: string, contentType: string): Promise<string> {
    return getSignedUrl(this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 });
  }
  publicUrl(key: string): string { return `${this.base}/${key}`; }
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
