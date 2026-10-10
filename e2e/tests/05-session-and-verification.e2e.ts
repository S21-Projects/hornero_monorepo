import { describe, expect, it } from 'vitest';
import { Actor } from '../src/client.js';
import { actors, anonymous, orgOwners, pickNecesidad, runId } from '../src/fixtures.js';

/** One registration per run (limit 3/min per IP): reused for the unverified-user and session checks. */
describe('8 + 10. unverified user and session lifecycle', () => {
  const user = new Actor('fresh-donante');
  let staleRefresh: string;

  it('registers a donante (unverified, no OTP) and gets a session', async () => {
    const res = await user.post('/auth/register', {
      nombre: 'E2E Donante',
      email: `e2e-${runId}@example.com`,
      password: 'E2e-pass-123',
      tipo: 'DONANTE',
    });
    expect(res.status).toBe(201);
    expect(user.jar.access_token).toBeTruthy();
    expect(user.jar.refresh_token).toBeTruthy();
    const me = await user.get('/auth/me');
    expect(me.status).toBe(200);
  });

  it('8. unverified donante cannot create a donation -> 403', async () => {
    const a = actors();
    const owners = await orgOwners(a);
    const { necesidad } = await pickNecesidad(a.referente, owners);
    const res = await user.post('/donaciones', {
      modalidad: 'DIRECTA',
      necesidadId: necesidad.id,
      lineas: [{ articuloId: necesidad.articulos[0].id, cantidad: 1 }],
    });
    expect(res.status).toBe(403);
  });

  it('10. refresh works once with a live session', async () => {
    staleRefresh = user.jar.refresh_token;
    const res = await user.post('/auth/refresh');
    expect(res.status).toBeLessThan(300);
    expect(user.jar.refresh_token).toBeTruthy();
    // After rotation the live session holds a NEW refresh token.
    expect(user.jar.refresh_token).not.toBe(staleRefresh);
  });

  it('10. logout clears cookies and revokes: the old refresh cookie is rejected with 401', async () => {
    const live = user.jar.refresh_token;
    const out = await user.post('/auth/logout');
    expect(out.status).toBeLessThan(300);
    expect(user.jar.access_token).toBeUndefined();
    expect(user.jar.refresh_token).toBeUndefined();

    // Replay what an attacker holding the pre-logout cookie would send.
    const replay = new Actor('replay', { refresh_token: live });
    expect((await replay.post('/auth/refresh')).status).toBe(401);
  });

  it('10. a rotated-away refresh token is rejected after logout (family revoked)', async () => {
    const replay = new Actor('replay-stale', { refresh_token: staleRefresh });
    expect((await replay.post('/auth/refresh')).status).toBe(401);
  });

  it('anonymous /auth/me is 401', async () => {
    expect((await anonymous().get('/auth/me')).status).toBe(401);
  });
});
