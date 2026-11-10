import { afterAll, describe, expect, it } from 'vitest';
import { Actor, registerDonante, retryOn429 } from '../src/client.js';
import { actors, anonymous, runId } from '../src/fixtures.js';

/** N10/D10: the append-only activity log records security events and admin actions. */
describe('N10. activity log', () => {
  const a = actors();
  const user = new Actor('audited-donante');
  const email = `e2e-audit-${runId}@example.com`;
  const wrongPassword = `wrong-${runId}-password`;
  let userId: number;
  let adminId: number;

  afterAll(async () => {
    if (userId) await a.admin.patch(`/usuarios/${userId}/activo`, { activo: true });
  });

  it('a failed login is recorded with the attempted email and the client ip, never the password', { timeout: 150_000 }, async () => {
    const intento = await retryOn429(() =>
      new Actor('attacker').post('/auth/login', { email: `nadie-${runId}@example.com`, password: wrongPassword }),
    );
    expect(intento.status).toBe(401);

    const res = await a.admin.get('/actividad?accion=LOGIN&resultado=FALLO&size=100');
    expect(res.status).toBe(200);
    const fila = (res.data.content as any[]).find((r) => r.emailIntento === `nadie-${runId}@example.com`);
    expect(fila).toBeTruthy();
    expect(fila.accion).toBe('LOGIN');
    expect(fila.resultado).toBe('FALLO');
    expect(fila.actorTipo).toBe('ANONIMO');
    expect(fila.actorUsuarioId).toBeNull();
    expect(typeof fila.ip).toBe('string');
    expect(fila.ip.length).toBeGreaterThan(1);
    expect(JSON.stringify(res.body)).not.toContain(wrongPassword);
  });

  it('registers a throw-away donante (its registration is recorded too)', { timeout: 150_000 }, async () => {
    const res = await registerDonante(user, { nombre: 'E2E Auditado', email });
    expect(res.status).toBe(201);
    userId = res.data?.user?.id ?? res.body?.user?.id;
    expect(userId).toBeTruthy();
    const me = await a.admin.get('/auth/me');
    adminId = Number(me.data?.userId ?? me.body?.userId);
    expect(adminId).toBeTruthy();

    const log = await a.admin.get(`/actividad?accion=REGISTRO&actorUsuarioId=${userId}`);
    expect(log.data.content).toHaveLength(1);
    expect(log.data.content[0].entidadId).toBe(userId);
  });

  it('an admin deactivation is recorded with the admin as actor, before/after and the reason', async () => {
    const off = await a.admin.patch(`/usuarios/${userId}/activo`, { activo: false, motivo: 'e2e: prueba de auditoría' });
    expect(off.status).toBeLessThan(300);

    const res = await a.admin.get(`/actividad?accion=USUARIO_DESACTIVADO&entidadTipo=USUARIO&entidadId=${userId}`);
    expect(res.status).toBe(200);
    expect(res.data.content).toHaveLength(1);
    const fila = res.data.content[0];
    expect(fila.actorUsuarioId).toBe(adminId);
    expect(fila.actorTipo).toBe('ADMINISTRADOR');
    expect(fila.resultado).toBe('EXITO');
    expect(fila.antes).toBe('activo');
    expect(fila.despues).toBe('inactivo');
    expect(fila.motivo).toBe('e2e: prueba de auditoría');
    expect(fila.ip).toBeTruthy();
  });

  it('the log is paginated and filterable by actor', async () => {
    const res = await a.admin.get(`/actividad?actorUsuarioId=${adminId}&size=1`);
    expect(res.status).toBe(200);
    expect(res.data.size).toBe(1);
    expect(res.data.content).toHaveLength(1);
    expect(res.data.totalElements).toBeGreaterThanOrEqual(1);
  });

  it('only an administrator can read it: donante and referente get 403, anonymous 401', async () => {
    expect((await a.donante.get('/actividad')).status).toBe(403);
    expect((await a.referente.get('/actividad')).status).toBe(403);
    expect((await anonymous().get('/actividad')).status).toBe(401);
  });

  it('there is no way to modify or delete entries through the API', async () => {
    for (const method of ['post', 'patch', 'del'] as const) {
      const res = await a.admin[method]('/actividad/1');
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});
