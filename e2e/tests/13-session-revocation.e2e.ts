import { describe, expect, it } from 'vitest';
import { Actor, registerDonante, retryOn429 } from '../src/client.js';
import { actors, runId } from '../src/fixtures.js';

/** Finds the raw Set-Cookie line for `name`, or undefined. */
const cookieLine = (setCookies: string[], name: string) => setCookies.find((c) => c.startsWith(`${name}=`));
const hasAttr = (line: string, attr: RegExp) => line.split(';').slice(1).some((p) => attr.test(p.trim()));

/**
 * C2: cookie attributes as the running stack really sends them, and refresh-token revocation after
 * an admin forces the logout. Secure + SameSite=None are production-only (NODE_ENV=production), so
 * on `make up-local` they are asserted only as a consistent pair; the exact production values are
 * pinned by the BFF unit test `session cookie attributes (C2)` in auth.service.spec.ts.
 */
describe('C2. session cookies and admin-forced revocation', () => {
  const a = actors();
  const email = `e2e-sesion-${runId}@example.com`;
  const password = 'cafetera azul canta fuerte';
  const user = new Actor('revocable');
  let userId: number;
  let loginCookies: string[];

  it('registers a throw-away donante and logs in again', { timeout: 220_000 }, async () => {
    const reg = await registerDonante(user, { nombre: 'E2E Sesion', email, password });
    expect(reg.status).toBe(201);
    userId = reg.data?.user?.id ?? reg.body?.user?.id;
    expect(userId).toBeTruthy();
    await user.post('/auth/logout');

    const res = await retryOn429(() => user.post('/auth/login', { email, password }));
    expect(res.status).toBeLessThan(300);
    loginCookies = res.setCookies;
  });

  it('login sets HttpOnly access and refresh cookies with a SameSite value and a path', () => {
    for (const name of ['access_token', 'refresh_token']) {
      const line = cookieLine(loginCookies, name);
      expect(line, name).toBeTruthy();
      expect(hasAttr(line!, /^HttpOnly$/i), `${name} HttpOnly`).toBe(true);
      expect(hasAttr(line!, /^Path=\//i), `${name} Path`).toBe(true);
      expect(hasAttr(line!, /^SameSite=(Lax|None)$/i), `${name} SameSite`).toBe(true);
    }
  });

  it('login lifetimes: access 15 min, refresh 7 days', () => {
    const maxAge = (name: string) => Number(/Max-Age=(\d+)/i.exec(cookieLine(loginCookies, name)!)?.[1]);
    expect(maxAge('access_token')).toBe(900);
    expect(maxAge('refresh_token')).toBe(604_800);
  });

  it('session_hint is readable by JS (no HttpOnly) and carries no role', () => {
    const line = cookieLine(loginCookies, 'session_hint');
    expect(line).toBeTruthy();
    expect(line).toMatch(/^session_hint=1;/);
    expect(hasAttr(line!, /^HttpOnly$/i)).toBe(false);
  });

  it('Secure and SameSite=None come as a pair: local dev sends SameSite=Lax without Secure', () => {
    for (const name of ['access_token', 'refresh_token', 'session_hint']) {
      const line = cookieLine(loginCookies, name)!;
      const secure = hasAttr(line, /^Secure$/i);
      const none = hasAttr(line, /^SameSite=None$/i);
      expect(secure, `${name}: Secure iff SameSite=None`).toBe(none);
    }
  });

  it('a non-admin cannot revoke sessions (403), not even the owner', async () => {
    expect((await a.donante.post(`/usuarios/${userId}/sesiones/revocar`)).status).toBe(403);
    expect((await a.referente.post(`/usuarios/${userId}/sesiones/revocar`)).status).toBe(403);
    expect((await user.post(`/usuarios/${userId}/sesiones/revocar`)).status).toBe(403);
  });

  it('admin revokes every session of the user', async () => {
    const res = await a.admin.post(`/usuarios/${userId}/sesiones/revocar`);
    expect(res.status).toBe(204);
  });

  it('the revoked refresh cookie is rejected with 401', async () => {
    const replay = new Actor('replay-revoked', { refresh_token: user.jar.refresh_token });
    expect((await replay.post('/auth/refresh')).status).toBe(401);
  });

  it('an access token already issued keeps working until it expires (documented limit)', async () => {
    expect((await user.get('/auth/me')).status).toBe(200);
  });

  it('the activity log records the admin as actor', async () => {
    const res = await a.admin.get(`/actividad?accion=SESIONES_REVOCADAS&entidadTipo=USUARIO&entidadId=${userId}&size=5`);
    expect(res.status).toBe(200);
    expect(res.data.content.length).toBe(1);
    expect(res.data.content[0].actorTipo).toBe('ADMINISTRADOR');
  });

  it('the user can log in again after the revocation (no lock-out)', { timeout: 150_000 }, async () => {
    const res = await retryOn429(() => user.post('/auth/login', { email, password }));
    expect(res.status).toBeLessThan(300);
    expect((await user.post('/auth/refresh')).status).toBeLessThan(300);
  });
});
