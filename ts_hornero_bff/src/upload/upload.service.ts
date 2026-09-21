import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_DEFAULT_REGION') ?? 'auto',
      endpoint: this.config.get<string>('AWS_ENDPOINT_URL'),
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.config.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ) as string,
      },
      forcePathStyle: true,
    });
    this.bucket = this.config.get<string>('AWS_S3_BUCKET_NAME') as string;
  }

  async uploadOrgProfile(
    orgId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.upload(`org-profile/${orgId}`, file);
  }

  async uploadOrgBanner(
    orgId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.upload(`org-banner/${orgId}`, file);
  }

  async uploadOrgEvidencia(
    orgId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.upload(`org-evidencia/${orgId}`, file);
  }

  private async upload(
    prefix: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const ext = EXT_MAP[file.mimetype] ?? 'jpg';
    const key = `${prefix}/${Date.now()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return key;
  }
}
