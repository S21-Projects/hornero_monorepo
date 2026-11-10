import { beforeAll, describe, expect, it } from 'vitest';
import { actors, anonymous, marker, openNecesidades, orgOwners, type Actors } from '../src/fixtures.js';
import type { Actor } from '../src/client.js';

/**
 * Reassignment of a pool donation (objective 3, RN-08): when the organizacion that was proposed
 * a FONDO_COMUN donation rejects it, the donation goes back to the pool and the next ronda never
 * proposes it to that organizacion again, however many times it is rerun.
 *
 * Not reachable end to end: the "unanswered proposal returns to the pool" path (3 days, daily job
 * `DonacionesEstancadasJob`) has no endpoint and no clock injection, so it is covered at the MS
 * level only. The resulting state (back in the pool, assignment RECHAZADA) is the same one the
 * rejection below produces through the shared `devolverAlFondo` path.
 */
describe('P6. a rejected pool donation returns to the pool and is never re-proposed to the same organizacion', () => {
  let a: Actors;
  let owners: Map<number, Actor>;
  let donacionId: number;
  const proposedTo: number[] = [];

  const asignaciones = async () => {
    const res = await a.admin.get(`/donaciones/${donacionId}/asignaciones`);
    expect(res.status).toBe(200);
    return (res.data.content ?? res.data) as any[];
  };
  const ronda = async () => {
    const res = await a.admin.post('/rondas');
    if (res.status === 503) {
      throw new Error('Go worker unavailable (POST /rondas -> 503 WORKER_NO_DISPONIBLE). Check `docker compose ps worker`.');
    }
    expect(res.status).toBe(201);
    expect(res.data.estado).toBe('COMPLETADA');
    return res.data;
  };

  beforeAll(async () => {
    a = actors();
    owners = await orgOwners(a);
  });

  it('a donante offers to the pool an articulo that open necesidades of several organizaciones ask for', async () => {
    // The articulo asked by the most distinct organizaciones gives the ronda the most places to propose it.
    const byArticulo = new Map<number, Set<number>>();
    for (const n of await openNecesidades()) {
      for (const x of n.articulos) {
        if (x.categoria !== 'NO_PERECEDERO') continue;
        byArticulo.set(x.id, (byArticulo.get(x.id) ?? new Set()).add(n.organizacionId));
      }
    }
    const [articuloId, orgs] = [...byArticulo.entries()].sort((l, r) => r[1].size - l[1].size)[0] ?? [];
    expect(articuloId, 'no NO_PERECEDERO articulo requested by an open necesidad').toBeTruthy();
    expect(orgs!.size).toBeGreaterThan(0);

    const res = await a.donante.post('/donaciones', {
      modalidad: 'FONDO_COMUN', observaciones: marker('reasignacion'),
      latitud: -31.4135, longitud: -64.1811, lineas: [{ articuloId, cantidad: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.data.estado).toBe('OFRECIDA');
    expect(res.data.necesidadId).toBeNull();
    donacionId = res.data.id;
  });

  it('each ronda proposes it to an organizacion that has not rejected it yet, until none is left', async () => {
    const MAX_RONDAS = 6;
    let rondas = 0;
    for (; rondas < MAX_RONDAS; rondas++) {
      await ronda();
      const d = (await anonymous().get(`/donaciones/${donacionId}`)).data;
      if (d.necesidadId == null) break; // nobody left to propose it to

      const org: number = d.organizacionId;
      expect(proposedTo, `ronda ${rondas + 1} proposed the donation again to organizacion ${org}`).not.toContain(org);
      proposedTo.push(org);

      // Exactly one live proposal, to this organizacion.
      const live = (await asignaciones()).filter((x) => x.estado === 'PROPUESTA');
      expect(live).toHaveLength(1);
      expect(live[0].organizacionId).toBe(org);

      // The owner rejects: the donation goes back to the pool in OFRECIDA, with no necesidad.
      const owner = owners.get(org);
      expect(owner, `no seeded referente owns organizacion ${org}`).toBeTruthy();
      const rej = await owner!.patch(`/donaciones/${donacionId}/decision`, { estado: 'RECHAZADA' });
      expect(rej.status).toBe(200);
      const back = (await anonymous().get(`/donaciones/${donacionId}`)).data;
      expect(back.estado).toBe('OFRECIDA');
      expect(back.necesidadId).toBeNull();
      expect((await asignaciones()).filter((x) => x.estado === 'PROPUESTA')).toHaveLength(0);
    }

    expect(proposedTo.length, 'the first ronda left the donation unassigned: nothing to reassign').toBeGreaterThan(0);
    expect(rondas, 'the donation was still being proposed after the safety limit').toBeLessThan(MAX_RONDAS);
  });

  it('the history keeps one RECHAZADA row per rejecting organizacion and no organizacion appears twice', async () => {
    const rows = await asignaciones();
    const rechazadas = rows.filter((x) => x.estado === 'RECHAZADA').map((x) => x.organizacionId);
    expect(rechazadas.sort()).toEqual([...proposedTo].sort());
    expect(new Set(rows.map((x) => x.organizacionId)).size).toBe(rows.length);
  });

  it('a further ronda leaves it in the pool: every organizacion that rejected it stays excluded', async () => {
    await ronda();
    const d = (await anonymous().get(`/donaciones/${donacionId}`)).data;
    expect(d.estado).toBe('OFRECIDA');
    expect(proposedTo).not.toContain(d.organizacionId);
    expect((await asignaciones()).filter((x) => x.estado === 'PROPUESTA' && proposedTo.includes(x.organizacionId))).toHaveLength(0);
  });

  it('cleanup: the donante cancels the donation so it does not compete in later rondas', async () => {
    const res = await a.donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'CANCELADA' });
    expect(res.status).toBe(200);
  });
});
