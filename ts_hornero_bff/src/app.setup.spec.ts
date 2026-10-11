import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from './app.setup';

@Controller()
class ProbeController {
  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Post('ping')
  post() {
    return { ok: true };
  }
}

describe('configureApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { allowedOrigins: ['https://app.elhornero.org'] });
    await app.init();
  });

  afterAll(() => app.close());

  it('sets helmet security headers', async () => {
    const res = await request(app.getHttpServer()).get('/ping').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['strict-transport-security']).not.toContain(
      'includeSubDomains',
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('keeps images embeddable cross-origin (Astro and admin SPA load them)', async () => {
    const res = await request(app.getHttpServer()).get('/ping');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('still answers CORS for an allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/ping')
      .set('Origin', 'https://app.elhornero.org');
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://app.elhornero.org',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows the Idempotency-Key header in preflights and exposes Idempotent-Replayed', async () => {
    const pre = await request(app.getHttpServer())
      .options('/ping')
      .set('Origin', 'https://app.elhornero.org')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key');
    expect(
      String(pre.headers['access-control-allow-headers']).toLowerCase(),
    ).toContain('idempotency-key');
    const res = await request(app.getHttpServer())
      .get('/ping')
      .set('Origin', 'https://app.elhornero.org');
    expect(
      String(res.headers['access-control-expose-headers']).toLowerCase(),
    ).toContain('idempotent-replayed');
  });

  it('rejects a state-changing request from a foreign origin', async () => {
    await request(app.getHttpServer())
      .post('/ping')
      .set('Origin', 'https://evil.example')
      .expect(403);
  });

  it('accepts a state-changing request from an allowed origin', async () => {
    await request(app.getHttpServer())
      .post('/ping')
      .set('Origin', 'https://app.elhornero.org')
      .expect(201);
  });
});
