import { afterAll, describe, expect, it } from 'vitest';
import { Actor } from '../src/client.js';
import { actors, anonymous, runId } from '../src/fixtures.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** N9/D9: deactivating a user cuts access at once, even though the access token is still valid. */
describe('N9. deactivated user is cut off immediately', () => {
  const a = actors();
  const user = new Actor('to-deactivate');
  let userId: number;

  afterAll(async () => {
    // The user is a throw-away, but leave it active like any other account.
    if (userId) await a.admin.patch(`/usuarios/${userId}/activo`, { activo: true });
  });

  it('registers a throw-away donante (retrying past the 3/min registration throttle)', async () => {
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await user.post('/auth/register', {
        nombre: 'E2E Desactivable',
        email: `e2e-off-${runId}@example.com`,
        password: 'cafetera azul canta fuerte',
        tipo: 'DONANTE',
      });
      if (res.status !== 429) break;
      await sleep(61_000);
    }
    expect(res!.status).toBe(201);
    userId = res!.data?.user?.id ?? res!.body?.user?.id;
    expect(userId).toBeTruthy();
    expect((await user.get('/auth/me')).status).toBe(200);
  }, 150_000);

  it('admin deactivates the user', async () => {
    const res = await a.admin.patch(`/usuarios/${userId}/activo`, { activo: false });
    expect(res.status).toBeLessThan(300);
  });

  it('the still-valid access token is refused on /auth/me with 401 USUARIO_INACTIVO', async () => {
    const res = await user.get('/auth/me');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('USUARIO_INACTIVO');
  });

  it('a protected route that reaches the MS is refused with 401 USUARIO_INACTIVO', async () => {
    const res = await user.get('/donaciones/mias');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('USUARIO_INACTIVO');
  });

  it('the refresh token no longer works', async () => {
    expect((await user.post('/auth/refresh')).status).toBe(401);
  });

  it('login is refused while deactivated', async () => {
    const res = await new Actor('retry-login').post('/auth/login', {
      email: `e2e-off-${runId}@example.com`,
      password: 'cafetera azul canta fuerte',
    });
    expect(res.status).toBe(401);
  });

  it('public routes keep working for anonymous visitors', async () => {
    expect((await anonymous().get('/necesidades')).status).toBe(200);
  });

  it('after reactivation a fresh login works again', async () => {
    const on = await a.admin.patch(`/usuarios/${userId}/activo`, { activo: true });
    expect(on.status).toBeLessThan(300);
    const fresh = new Actor('fresh');
    const res = await fresh.post('/auth/login', {
      email: `e2e-off-${runId}@example.com`,
      password: 'cafetera azul canta fuerte',
    });
    expect(res.status).toBeLessThan(300);
    expect((await fresh.get('/auth/me')).status).toBe(200);
  });
});
