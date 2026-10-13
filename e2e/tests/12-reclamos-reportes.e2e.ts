import { beforeAll, describe, expect, it } from 'vitest';
import { Actor, retryOn429 } from '../src/client.js';
import {
  actors,
  anonymous,
  cleanupUnclaimedOrgs,
  importUnclaimedOrg,
  markEmailVerified,
  psql,
  runId,
} from '../src/fixtures.js';

/**
 * Claims (reclamos) and reports (reportes) on unclaimed, ReNaCoM-imported organizaciones, their
 * cascades, the anonymization of a user who filed them, and the public map.
 *
 * No API creates SIN_RECLAMAR organizaciones, so the file imports its own through the compose
 * Postgres (`importUnclaimedOrg`) and removes the previous run's rows first (`cleanupUnclaimedOrgs`):
 * that keeps the referente org cap and the 5-claims-per-24h window free on every rerun.
 */
describe('P4. claims, reports, cascades and the public map', () => {
  const a = actors();
  const claimant = new Actor('throwaway-referente');
  const claimantEmail = `e2e-claimant-${runId}@example.com`;
  const phone = '351 555 0199';
  const evidencia = (orgId: number, userId: number) => [`reclamo-evidencia/${orgId}/${userId}/e2e.jpg`];

  let orgA: { id: number; nombre: string }; // two claims, a report; the approval cascade
  let orgB: { id: number }; // rejected claim
  let orgC: { id: number }; // report confirmed -> INACTIVA, pending claim closed
  let orgD1: { id: number }; // claim of the user who gets anonymized
  let orgD2: { id: number }; // report of the user who gets anonymized
  const ids: Record<string, number> = {};
  const userIds: Record<string, number> = {};

  const claim = (who: Actor, org: { id: number }, userId: number) =>
    who.post('/reclamos', {
      organizacionId: org.id,
      rol: 'RESPONSABLE',
      telefono: phone,
      mensaje: 'e2e claim message',
      evidenciaKeys: evidencia(org.id, userId),
    });

  beforeAll(async () => {
    cleanupUnclaimedOrgs();
    orgA = importUnclaimedOrg('a');
    orgB = importUnclaimedOrg('b');
    orgC = importUnclaimedOrg('c');
    orgD1 = importUnclaimedOrg('d1');
    orgD2 = importUnclaimedOrg('d2');
    for (const k of ['referente', 'referente2', 'referente3'] as const) {
      const me = await a[k].get('/auth/me');
      userIds[k] = me.data?.userId ?? me.body?.userId;
    }
  }, 60_000);

  it('claims: a referente files a claim on an unclaimed organizacion; a donante cannot (403)', async () => {
    expect((await claim(a.donante, orgA, 1)).status).toBe(403);

    const r1 = await claim(a.referente, orgA, userIds.referente);
    expect(r1.status).toBe(201);
    expect(r1.data.estado).toBe('PENDIENTE');
    ids.claimA1 = r1.data.id;
    const r2 = await claim(a.referente2, orgA, userIds.referente2);
    expect(r2.status).toBe(201);
    ids.claimA2 = r2.data.id;

    // Foreign / wrong-role access: a claim is private to its claimant and resolving is admin-only.
    expect((await a.referente2.get(`/reclamos/${ids.claimA1}`)).status).toBe(403);
    expect((await a.referente.patch(`/reclamos/${ids.claimA1}/aprobar`)).status).toBe(403);
    expect((await a.donante.patch(`/reclamos/${ids.claimA1}/rechazar`, { motivo: 'x' })).status).toBe(403);
    expect((await a.referente.get('/reclamos/pendientes')).status).toBe(403);
  });

  it('claims: admin approves one claim -> org assigned, rival claim auto-rejected, org reports discarded', async () => {
    const rep = await a.donante.post('/reportes', { organizacionId: orgA.id, motivo: 'INACTIVO', detalle: 'e2e' });
    expect(rep.status).toBe(201);
    ids.reportA = rep.data.id;

    const ok = await a.admin.patch(`/reclamos/${ids.claimA1}/aprobar`);
    expect(ok.status).toBe(200);
    expect(ok.data.estado).toBe('APROBADO');

    const mine = await a.referente.get('/organizaciones/mia');
    expect((mine.data as any[]).some((o) => o.id === orgA.id)).toBe(true);

    const rival = await a.admin.get(`/reclamos/${ids.claimA2}`);
    expect(rival.data.estado).toBe('RECHAZADO');
    expect(rival.data.motivoRechazo).toBe('Se aprobó otro reclamo para este comedor');

    const report = await a.admin.get(`/reportes/${ids.reportA}`);
    expect(report.data.estado).toBe('DESCARTADO');
    expect(report.data.notaResolucion).toBe('La organización fue reclamada');

    // Already resolved: a second resolution is refused.
    expect((await a.admin.patch(`/reclamos/${ids.claimA1}/aprobar`)).status).toBe(409);
  });

  it('claims: admin rejects a claim (reason required); the claimant sees it in their list', async () => {
    const c = await claim(a.referente3, orgB, userIds.referente3);
    expect(c.status).toBe(201);
    expect((await a.admin.patch(`/reclamos/${c.data.id}/rechazar`, {})).status).toBe(400);

    const res = await a.admin.patch(`/reclamos/${c.data.id}/rechazar`, { motivo: 'e2e: sin pruebas suficientes' });
    expect(res.status).toBe(200);
    expect(res.data.estado).toBe('RECHAZADO');

    const mios = await a.referente3.get('/reclamos/mios');
    const row = (mios.data as any[]).find((r) => r.id === c.data.id);
    expect(row.estado).toBe('RECHAZADO');
    expect(row.motivoRechazo).toBe('e2e: sin pruebas suficientes');
  });

  it('reports: any user reports an org, only an admin resolves; marking it inactive confirms the report', async () => {
    const rep = await a.donante.post('/reportes', { organizacionId: orgC.id, motivo: 'INACTIVO', detalle: 'e2e' });
    expect(rep.status).toBe(201);
    expect(rep.data.estado).toBe('PENDIENTE');

    expect((await a.referente.patch(`/reportes/${rep.data.id}/marcar-inactiva`)).status).toBe(403);
    expect((await a.donante.get('/reportes/pendientes')).status).toBe(403);

    // A claim is pending on the same org when the admin closes it down (next test checks it).
    const c = await claim(a.referente3, orgC, userIds.referente3);
    expect(c.status).toBe(201);
    ids.claimC = c.data.id;

    const res = await a.admin.patch(`/reportes/${rep.data.id}/marcar-inactiva`);
    expect(res.status).toBe(200);
    expect(res.data.estado).toBe('CONFIRMADO');
    expect(psql(`SELECT estado FROM organizaciones WHERE id = ${orgC.id};`)).toEqual(['INACTIVA']);
  });

  it('cascade: the pending claim on the organizacion marked inactive is rejected by the system', async () => {
    const res = await a.admin.get(`/reclamos/${ids.claimC}`);
    expect(res.data.estado).toBe('RECHAZADO');
    expect(res.data.motivoRechazo).toBe('La organización fue marcada inactiva');
  });

  it('anonymization: pending claim and report of the user are closed and their personal data scrubbed', { timeout: 150_000 }, async () => {
    const reg = await retryOn429(() =>
      claimant.post('/auth/register', {
        nombre: 'E2E Reclamante',
        email: claimantEmail,
        password: 'cafetera azul canta fuerte',
        tipo: 'REFERENTE',
      }),
    );
    expect(reg.status).toBe(201);
    const claimantId: number = reg.data?.user?.id ?? reg.body?.user?.id;
    markEmailVerified(claimantEmail);

    const c = await claim(claimant, orgD1, claimantId);
    expect(c.status).toBe(201);
    const rep = await claimant.post('/reportes', { organizacionId: orgD2.id, motivo: 'OTRO', detalle: 'e2e personal text' });
    expect(rep.status).toBe(201);

    const anon = await a.admin.post(`/usuarios/${claimantId}/anonimizar`);
    expect(anon.status).toBeLessThan(300);

    const claimAfter = (await a.admin.get(`/reclamos/${c.data.id}`)).data;
    expect(claimAfter.estado).toBe('RECHAZADO');
    expect(claimAfter.motivoRechazo).toBe('El solicitante dio de baja su cuenta');
    expect(claimAfter.mensaje).toBeNull();
    expect(claimAfter.evidenciaKeys).toEqual([]);
    expect(claimAfter.telefono).not.toContain('555');
    expect(JSON.stringify(claimAfter)).not.toContain(claimantEmail);

    const repAfter = (await a.admin.get(`/reportes/${rep.data.id}`)).data;
    expect(repAfter.estado).toBe('DESCARTADO');
    expect(repAfter.notaResolucion).toBe('El reportante dio de baja su cuenta');
    expect(repAfter.detalle).toBeNull();
    expect(JSON.stringify(repAfter)).not.toContain(claimantEmail);
  });

  it('public map: anonymous GET /organizaciones/mapa is 200, lists unclaimed orgs, carries no personal data', async () => {
    const res = await anonymous().get('/organizaciones/mapa');
    expect(res.status).toBe(200);
    const rows = res.data as any[];
    const unclaimed = rows.find((o) => o.id === orgD1.id);
    expect(unclaimed?.estado).toBe('SIN_RECLAMAR');
    const keys = new Set(rows.flatMap((o) => Object.keys(o)));
    for (const k of keys) expect(k).not.toMatch(/email|telefono|referente|password|mensaje|evidencia|usuario/i);
    expect(JSON.stringify(res.body)).not.toContain(phone);
    expect(JSON.stringify(res.body)).not.toContain('@');
  });
});
