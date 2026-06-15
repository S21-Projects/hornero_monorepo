import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadTarget, AllowedContentType } from './dto/presign-query.dto.js';

const PRESIGN_EXPIRY_SECONDS = 300;
const MAX_CONTENT_LENGTH_BYTES = 5 * 1024 * 1024; // 5 MB

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
}

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly endpointUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.endpointUrl = this.configService.get<string>('AWS_ENDPOINT_URL') as string;
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME') as string;

    this.s3Client = new S3Client({
      endpoint: this.endpointUrl,
      region: this.configService.get<string>('AWS_DEFAULT_REGION') ?? 'auto',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') as string,
      },
      forcePathStyle: false,
    });
  }

  async presign(
    target: UploadTarget,
    entityId: number,
    filename: string,
    contentType: AllowedContentType,
  ): Promise<PresignResult> {
    const ext = this.extractExtension(filename);
    const key = `${target}/${entityId}/${Date.now()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: MAX_CONTENT_LENGTH_BYTES,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });

    // Virtual-hosted-style URL: https://{bucket}.{host}/{key}
    const endpointHost = new URL(this.endpointUrl).host;
    const publicUrl = `https://${this.bucket}.${endpointHost}/${key}`;

    return { uploadUrl, publicUrl };
  }

  private extractExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg';
  }
}
