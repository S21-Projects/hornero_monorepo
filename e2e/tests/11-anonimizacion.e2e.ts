import { describe, expect, it } from 'vitest';
import { Actor, registerDonante, retryOn429 } from '../src/client.js';
import { actors, runId } from '../src/fixtures.js';

/** N15/D12: right to erasure. An admin anonymizes a throw-away donante; nothing identifies them after. */
describe('N15. admin anonymization of a user', () => {
  const a = actors();
  const user = new Actor('to-anonymize');
  const email = `e2e-anon-${runId}@example.com`;
  const password = 'cafetera azul canta fuerte';
  let userId: number;

  it('registers a throw-away donante (retrying past the 3/min registration throttle)', { timeout: 150_000 }, async () => {
    const res = await registerDonante(user, { nombre: 'E2E Anonimizable', email, password });
    expect(res.status).toBe(201);
    userId = res.data?.user?.id ?? res.body?.user?.id;
    expect(userId).toBeTruthy();
    expect((await user.get('/auth/me')).status).toBe(200);
  });

  it('a non-admin cannot anonymize (403), not even the user on themselves', async () => {
    expect((await a.donante.post(`/usuarios/${userId}/anonimizar`)).status).toBe(403);
    expect((await user.post(`/usuarios/${userId}/anonimizar`)).status).toBe(403);
    expect((await a.referente.post(`/usuarios/${userId}/anonimizar`)).status).toBe(403);
  });

  it('an admin cannot anonymize their own account (409)', async () => {
    const me = await a.admin.get('/auth/me');
    const adminId = me.data?.userId ?? me.body?.userId;
    expect(adminId).toBeTruthy();
    const res = await a.admin.post(`/usuarios/${adminId}/anonimizar`);
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('ANONIMIZAR_CUENTA_PROPIA');
  });

  it('the idempotency key is required (400)', async () => {
    const res = await a.admin.post(`/usuarios/${userId}/anonimizar`, undefined, { key: null });
    expect(res.status).toBe(400);
  });

  it('admin anonymizes the donante', async () => {
    const res = await a.admin.post(`/usuarios/${userId}/anonimizar`);
    expect(res.status).toBeLessThan(300);
    expect(res.data.nombre).toBe('Usuario eliminado');
    expect(res.data.email).toMatch(/^eliminado-[0-9a-f-]{36}@anonimo\.invalid$/);
    expect(res.data.activo).toBe(false);
  });

  it('the still-valid session and the refresh token are dead', async () => {
    expect((await user.get('/auth/me')).status).toBe(401);
    expect((await user.post('/auth/refresh')).status).toBe(401);
  });

  it('login with the original credentials fails', { timeout: 150_000 }, async () => {
    const res = await retryOn429(() => new Actor('retry-login').post('/auth/login', { email, password }));
    expect(res.status).toBe(401);
  });

  it('the user list shows "Usuario eliminado" and no trace of the original name or email', async () => {
    const res = await a.admin.get('/usuarios?size=100&sort=id,desc');
    expect(res.status).toBe(200);
    const row = (res.data.content as any[]).find((u) => u.id === userId);
    expect(row.nombre).toBe('Usuario eliminado');
    expect(row.email).toMatch(/@anonimo\.invalid$/);
    expect(JSON.stringify(res.data)).not.toContain(email);
  });

  it('a second anonymization is a 409 USUARIO_YA_ANONIMIZADO', async () => {
    const res = await a.admin.post(`/usuarios/${userId}/anonimizar`);
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('USUARIO_YA_ANONIMIZADO');
  });

  it('the activity log records who did it, without the original email', async () => {
    const res = await a.admin.get(`/actividad?accion=USUARIO_ANONIMIZADO&entidadTipo=USUARIO&entidadId=${userId}&size=5`);
    expect(res.status).toBe(200);
    expect(res.data.content.length).toBe(1);
    expect(res.data.content[0].actorTipo).toBe('ADMINISTRADOR');
    expect(JSON.stringify(res.data)).not.toContain(email);
  });
});
