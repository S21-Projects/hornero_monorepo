import {
  Controller,
  INestApplication,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  resolveMaxUploadBytes,
  uploadMulterOptions,
} from './upload-limits';

describe('resolveMaxUploadBytes', () => {
  it('defaults to 5 MB when UPLOAD_MAX_MB is unset or blank', () => {
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(resolveMaxUploadBytes(undefined)).toBe(5 * 1024 * 1024);
    expect(resolveMaxUploadBytes('')).toBe(5 * 1024 * 1024);
  });

  it('reads a positive number of megabytes', () => {
    expect(resolveMaxUploadBytes('2')).toBe(2 * 1024 * 1024);
    expect(resolveMaxUploadBytes('1.5')).toBe(Math.floor(1.5 * 1024 * 1024));
  });

  it('falls back to the default on nonsense instead of disabling the limit', () => {
    for (const bad of ['abc', '0', '-3', 'Infinity', 'NaN']) {
      expect(resolveMaxUploadBytes(bad)).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    }
  });
});

describe('upload size limit (HTTP)', () => {
  @Controller('probe')
  class ProbeController {
    @Post()
    @UseInterceptors(FileInterceptor('image'))
    ok() {
      return { ok: true };
    }
  }

  let app: INestApplication;

  const boot = async (maxMb?: string) => {
    const module = await Test.createTestingModule({
      imports: [
        MulterModule.registerAsync({
          useFactory: () =>
            uploadMulterOptions({
              get: () => maxMb,
            } as unknown as ConfigService),
        }),
      ],
      controllers: [ProbeController],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  };

  afterEach(async () => {
    await app.close();
  });

  it('rejects a 6 MB file with 413 under the default limit', async () => {
    await boot();
    await request(app.getHttpServer())
      .post('/probe')
      .attach('image', Buffer.alloc(6 * 1024 * 1024, 1), 'big.jpg')
      .expect(413);
  });

  it('accepts a 4 MB file under the default limit', async () => {
    await boot();
    await request(app.getHttpServer())
      .post('/probe')
      .attach('image', Buffer.alloc(4 * 1024 * 1024, 1), 'ok.jpg')
      .expect(201);
  });

  it('honours a configured limit (1 MB rejects 2 MB)', async () => {
    await boot('1');
    await request(app.getHttpServer())
      .post('/probe')
      .attach('image', Buffer.alloc(2 * 1024 * 1024, 1), 'big.jpg')
      .expect(413);
  });
});
