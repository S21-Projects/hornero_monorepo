import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Readable } from 'stream';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

/**
 * Slice A pre-commitment guard (Threat Matrix "Evidence key smuggling" row): the authenticated,
 * ownership-checked route for evidence files does not exist until Slice B, so no evidence object
 * may be readable through this public route in the meantime. The deny-list below must survive the
 * obvious normalization bypass attempts, not just an exact-string match.
 */
describe('ImagesController — org-evidencia deny-list', () => {
  let app: INestApplication<App>;
  let getObjectMock: jest.Mock;

  beforeEach(async () => {
    getObjectMock = jest.fn().mockResolvedValue({
      body: Readable.from([Buffer.from('fake-image')]),
      contentType: 'image/jpeg',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        { provide: ImagesService, useValue: { getObject: getObjectMock } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a plain org-evidencia key with 403, unauthenticated', async () => {
    await request(app.getHttpServer())
      .get('/images')
      .query({ key: 'org-evidencia/1/x.jpg' })
      .expect(403);

    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('also denies the claim-evidence prefix, including bypass attempts', async () => {
    for (const key of [
      'reclamo-evidencia/1/7/x.jpg',
      '/reclamo-evidencia/1/7/x.jpg',
      'org-profile/../reclamo-evidencia/1/7/x.jpg',
      'Reclamo-Evidencia/1/7/x.jpg',
    ]) {
      await request(app.getHttpServer())
        .get('/images')
        .query({ key })
        .expect(403);
    }
    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('rejects a leading-slash bypass attempt', async () => {
    await request(app.getHttpServer())
      .get('/images')
      .query({ key: '/org-evidencia/1/x.jpg' })
      .expect(403);

    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('rejects a URL-encoded separator bypass attempt', async () => {
    await request(app.getHttpServer())
      .get('/images?key=org-evidencia%2F1%2Fx.jpg')
      .expect(403);

    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('rejects a path-traversal bypass attempt', async () => {
    await request(app.getHttpServer())
      .get('/images')
      .query({ key: 'org-profile/../org-evidencia/1/x.jpg' })
      .expect(403);

    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('rejects a case-variation bypass attempt', async () => {
    await request(app.getHttpServer())
      .get('/images')
      .query({ key: 'Org-Evidencia/1/x.jpg' })
      .expect(403);

    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it('still serves an ordinary, unrelated key', async () => {
    await request(app.getHttpServer())
      .get('/images')
      .query({ key: 'org-profile/1/x.jpg' })
      .expect(200);

    expect(getObjectMock).toHaveBeenCalledWith('org-profile/1/x.jpg');
  });

  it('lets browsers and Cloudflare cache public images for a year (keys are immutable UUIDs)', async () => {
    await request(app.getHttpServer())
      .get('/images')
      .query({ key: 'org-banner/1/0b1e.jpg' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=31536000, immutable');
  });
});
