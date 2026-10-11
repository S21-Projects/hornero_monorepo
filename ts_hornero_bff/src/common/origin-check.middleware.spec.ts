import express from 'express';
import request from 'supertest';
import { createOriginCheckMiddleware } from './origin-check.middleware';

describe('createOriginCheckMiddleware', () => {
  const app = express();
  app.use(createOriginCheckMiddleware(['https://app.elhornero.org']));
  app.all('/x', (_req, res) => {
    res.json({ ok: true });
  });

  const OK = 'https://app.elhornero.org';
  const EVIL = 'https://evil.example';

  it('lets an allowed Origin through', async () => {
    await request(app).post('/x').set('Origin', OK).expect(200);
  });

  it('rejects a foreign Origin with a 403 envelope', async () => {
    const res = await request(app).post('/x').set('Origin', EVIL).expect(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 403,
        data: null,
        errors: expect.any(Array),
      }),
    );
  });

  it.each(['put', 'patch', 'delete'] as const)(
    'checks %s too',
    async (method) => {
      await request(app)[method]('/x').set('Origin', EVIL).expect(403);
    },
  );

  it('rejects the opaque "null" Origin', async () => {
    await request(app).post('/x').set('Origin', 'null').expect(403);
  });

  it('uses the Referer origin when Origin is absent', async () => {
    await request(app)
      .post('/x')
      .set('Referer', `${OK}/some/page?q=1`)
      .expect(200);
    await request(app).post('/x').set('Referer', `${EVIL}/page`).expect(403);
  });

  it('rejects an unparseable Referer', async () => {
    await request(app).post('/x').set('Referer', 'not a url').expect(403);
  });

  it('lets requests with neither Origin nor Referer through (non-browser clients)', async () => {
    await request(app).post('/x').expect(200);
  });

  it('does not check safe methods', async () => {
    await request(app).get('/x').set('Origin', EVIL).expect(200);
    await request(app).options('/x').set('Origin', EVIL).expect(200);
  });
});
