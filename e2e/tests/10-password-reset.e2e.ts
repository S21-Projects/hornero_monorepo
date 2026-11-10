import { describe, expect, it } from 'vitest';
import { retryOn429 } from '../src/client.js';
import { anonymous, runId } from '../src/fixtures.js';

/**
 * Forgot-password at the API level. The reset token is delivered ONLY by email (and the log-only
 * mailer never prints it), so the happy path (token -> new password -> sessions revoked) is covered
 * by the MS integration test with a capturing Mailer bean (PasswordResetIntegrationTest), not
 * here: production code carries no test backdoor to read the token. This suite checks what is
 * observable through the BFF: the generic answer, the token failure contract and the throttles.
 *
 * Budgets are per IP per minute: olvido 3, restablecer 5. The throttle assertion runs last.
 */
describe('11. password reset (BFF contract)', () => {
  const GENERICO = 'Si el email está registrado, te enviamos un enlace';
  const passwordOk = 'la cafetera azul canta fuerte';

  it('olvido answers 202 with the same body for a registered and an unknown email', { timeout: 150_000 }, async () => {
    const conocido = await retryOn429(() => anonymous().post('/auth/password/olvido', { email: 'admin@hornero.ar' }));
    const desconocido = await retryOn429(() =>
      anonymous().post('/auth/password/olvido', { email: `nadie-${runId}@example.com` }),
    );

    expect(conocido.status).toBe(202);
    expect(desconocido.status).toBe(202);
    expect(conocido.body).toEqual(desconocido.body);
    expect(JSON.stringify(conocido.body)).toContain(GENERICO);
  });

  it('olvido rejects a malformed email with 400', { timeout: 150_000 }, async () => {
    const res = await retryOn429(() => anonymous().post('/auth/password/olvido', { email: 'no-es-email' }));
    expect(res.status).toBe(400);
  });

  it('restablecer with an unknown token is 400 TOKEN_INVALIDO', async () => {
    const res = await anonymous().post('/auth/password/restablecer', {
      token: `token-inexistente-${runId}`,
      password: passwordOk,
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('TOKEN_INVALIDO');
  });

  it('restablecer rejects a short password at the BFF with PASSWORD_DEMASIADO_CORTA', async () => {
    const res = await anonymous().post('/auth/password/restablecer', { token: 'x', password: 'corta' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('PASSWORD_DEMASIADO_CORTA');
  });

  it('restablecer rejects unknown properties (forbidNonWhitelisted)', async () => {
    const res = await anonymous().post('/auth/password/restablecer', {
      token: 'x',
      password: passwordOk,
      email: 'otro@example.com',
    });
    expect(res.status).toBe(400);
  });

  it('olvido is throttled per IP (429 within a few attempts)', { timeout: 150_000 }, async () => {
    let limited = false;
    for (let i = 0; i < 6 && !limited; i++) {
      const res = await anonymous().post('/auth/password/olvido', { email: `rate-${runId}-${i}@example.com` });
      limited = res.status === 429;
    }
    expect(limited).toBe(true);
  });
});
