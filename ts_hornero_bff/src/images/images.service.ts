import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

@Injectable()
export class ImagesService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_DEFAULT_REGION') ?? 'auto',
      endpoint: this.config.get<string>('AWS_ENDPOINT_URL'),
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') as string,
      },
      forcePathStyle: true,
    });
    this.bucket = this.config.get<string>('AWS_S3_BUCKET_NAME') as string;
  }

  async getObject(key: string): Promise<{ body: Readable; contentType?: string }> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        body: response.Body as Readable,
        contentType: response.ContentType,
      };
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey') {
        throw new NotFoundException(`Image not found: ${key}`);
      }
      throw err;
    }
  }
}
