import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';
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

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

  it('uploadReclamoEvidencia() writes under reclamo-evidencia/{orgId}/{userId}/', async () => {
    const file = {
      mimetype: 'image/jpeg',
      buffer: JPEG_BYTES,
    } as Express.Multer.File;

    const key = await service.uploadReclamoEvidencia(5, 7, file);

    expect(key).toMatch(/^reclamo-evidencia\/5\/7\/[0-9a-f-]{36}\.jpg$/);
  });

  it('uploadOrgEvidencia() writes under org-evidencia/{orgId}/', async () => {
    const file = {
      mimetype: 'image/jpeg',
      buffer: JPEG_BYTES,
    } as Express.Multer.File;

    const key = await service.uploadOrgEvidencia(7, file);

    expect(key).toMatch(/^org-evidencia\/7\/[0-9a-f-]{36}\.jpg$/);
    const s3Instance = (S3Client as unknown as jest.Mock).mock.results[0].value;
    expect(s3Instance.send).toHaveBeenCalled();
  });

  const lastSentInput = () => {
    const s3Instance = (S3Client as unknown as jest.Mock).mock.results.at(
      -1,
    )?.value;
    return s3Instance.send.mock.calls.at(-1)[0].input;
  };

  it('derives extension and ContentType from the detected content, not the client mimetype', async () => {
    const file = {
      mimetype: 'image/jpeg', // lies: the bytes are a PNG
      buffer: PNG_BYTES,
    } as Express.Multer.File;

    const key = await service.uploadOrgProfile(3, file);

    expect(key).toMatch(/^org-profile\/3\/[0-9a-f-]{36}\.png$/);
    expect(lastSentInput()).toMatchObject({ ContentType: 'image/png' });
  });

  it('rejects content that is not an allowed image, even with an image mimetype', async () => {
    const file = {
      mimetype: 'image/png',
      buffer: Buffer.from('<html><script>alert(1)</script></html>'),
    } as Express.Multer.File;

    await expect(service.uploadOrgBanner(3, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.uploadOrgBanner(3, file)).rejects.toThrow(
      /content does not match/i,
    );
  });

  describe('PDF evidence', () => {
    const PDF_BYTES = Buffer.from('%PDF-1.7\n%binary');
    const pdfFile = (buffer: Buffer) =>
      ({ mimetype: 'application/pdf', buffer }) as Express.Multer.File;

    it('accepts a PDF on the accreditation-evidence path with its own key and ContentType', async () => {
      const key = await service.uploadOrgEvidencia(7, pdfFile(PDF_BYTES));

      expect(key).toMatch(/^org-evidencia\/7\/[0-9a-f-]{36}\.pdf$/);
      expect(lastSentInput()).toMatchObject({ ContentType: 'application/pdf' });
    });

    it('rejects a PDF on every image-only path', async () => {
      const file = pdfFile(PDF_BYTES);
      await expect(service.uploadOrgProfile(3, file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.uploadOrgBanner(3, file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.uploadReclamoEvidencia(3, 4, file),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a fake PDF (wrong magic bytes) on the evidence path', async () => {
      const fake = pdfFile(Buffer.from('<html>not a pdf</html>'));
      await expect(service.uploadOrgEvidencia(7, fake)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('WebP', () => {
    const WEBP_BYTES = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 '),
    ]);
    const webpFile = {
      mimetype: 'image/webp',
      buffer: WEBP_BYTES,
    } as Express.Multer.File;

    it('is rejected as accreditation evidence', async () => {
      await expect(
        service.uploadOrgEvidencia(7, webpFile),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is still accepted for org profile and banner images', async () => {
      await expect(service.uploadOrgProfile(3, webpFile)).resolves.toMatch(
        /\.webp$/,
      );
      await expect(service.uploadOrgBanner(3, webpFile)).resolves.toMatch(
        /\.webp$/,
      );
    });
  });

  it('rejects an executable renamed .jpg as evidence, before anything is stored', async () => {
    const s3Instance = (S3Client as unknown as jest.Mock).mock.results[0]
      .value as { send: jest.Mock };
    s3Instance.send.mockClear();
    const exe = {
      originalname: 'virus.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0)]),
    } as Express.Multer.File;

    await expect(service.uploadOrgEvidencia(7, exe)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(s3Instance.send).not.toHaveBeenCalled();
  });

  it('never defaults an unknown type to jpg', async () => {
    const file = {
      mimetype: 'application/octet-stream',
      buffer: Buffer.from('GIF89a......'),
    } as Express.Multer.File;
    const s3Instance = (S3Client as unknown as jest.Mock).mock.results[0].value;
    s3Instance.send.mockClear();

    await expect(service.uploadOrgEvidencia(3, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(s3Instance.send).not.toHaveBeenCalled();
  });
});
