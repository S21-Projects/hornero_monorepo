import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { UploadService } from './upload.service';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest
      .fn()
      .mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  };
});

describe('UploadService', () => {
  let service: UploadService;

  const config: Record<string, string> = {
    AWS_DEFAULT_REGION: 'auto',
    AWS_ENDPOINT_URL: 'http://localhost:9000',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_S3_BUCKET_NAME: 'hornero-images',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('uploadOrgEvidencia() writes under org-evidencia/{orgId}/', async () => {
    const file = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    const key = await service.uploadOrgEvidencia(7, file);

    expect(key).toMatch(/^org-evidencia\/7\/\d+\.jpg$/);
    const s3Instance = (S3Client as unknown as jest.Mock).mock.results[0].value;
    expect(s3Instance.send).toHaveBeenCalled();
  });
});
