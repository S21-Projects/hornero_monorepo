import { beforeAll, describe, expect, it } from 'vitest';
import {
  actors, anonymous, completarEntrega, estadoDe, marker, openNecesidades, orgOwners, type Actors,
} from '../src/fixtures.js';
import type { Actor } from '../src/client.js';

describe('Scenario 2 - FONDO_COMUN donation: ronda assigns it, referente accepts, delivery completes', () => {
  let a: Actors;
  let donacionId: number;
  let owner: Actor;

  beforeAll(async () => {
    a = actors();
  });

  it('donante creates a pool donation (no necesidad) -> OFRECIDA', async () => {
    // Offer an NO_PERECEDERO articulo that some open necesidad asks for, so the worker has a match.
    const needs = await openNecesidades();
    const articulo = needs.flatMap((n) => n.articulos).find((x) => x.categoria === 'NO_PERECEDERO');
    expect(articulo, 'no NO_PERECEDERO articulo requested by any open necesidad').toBeTruthy();
    const res = await a.donante.post('/donaciones', {
      modalidad: 'FONDO_COMUN',
      observaciones: marker('pool'),
      latitud: -31.4135,
      longitud: -64.1811,
      lineas: [{ articuloId: articulo!.id, cantidad: 3 }],
    });
    expect(res.status).toBe(201);
    expect(res.data.estado).toBe('OFRECIDA');
    expect(res.data.modalidad).toBe('FONDO_COMUN');
    expect(res.data.necesidadId).toBeNull();
    donacionId = res.data.id;
  });

  it('a referente cannot decide on it while it waits in the pool', async () => {
    const res = await a.referente.patch(`/donaciones/${donacionId}/decision`, { estado: 'ACEPTADA' });
    expect(res.status).toBe(403);
  });

  it('admin triggers a ronda and the donation gets assigned to a compatible necesidad', async () => {
    const ronda = await a.admin.post('/rondas');
    if (ronda.status === 503) {
      throw new Error('Go worker unavailable (POST /rondas -> 503 WORKER_NO_DISPONIBLE). Check `docker compose ps worker`.');
    }
    expect(ronda.status).toBe(201);
    expect(ronda.data.estado).toBe('COMPLETADA');

    const d = await anonymous().get(`/donaciones/${donacionId}`);
    expect(d.data.necesidadId, 'ronda left the donation unassigned').not.toBeNull();
    expect(d.data.estado).toBe('OFRECIDA');

    const asign = await a.admin.get(`/donaciones/${donacionId}/asignaciones`);
    expect(asign.status).toBe(200);
    const list = (asign.data.content ?? asign.data) as any[];
    expect(list.some((x) => x.estado === 'PROPUESTA')).toBe(true);

    const owners = await orgOwners(a);
    owner = owners.get(d.data.organizacionId)!;
    expect(owner, `no seeded referente owns org ${d.data.organizacionId}`).toBeTruthy();
  });

  it('the owning referente accepts -> ACEPTADA and the asignacion resolves', async () => {
    const res = await owner.patch(`/donaciones/${donacionId}/decision`, { estado: 'ACEPTADA' });
    expect(res.status).toBe(200);
    expect(await estadoDe(donacionId)).toBe('ACEPTADA');
    const asign = await a.admin.get(`/donaciones/${donacionId}/asignaciones`);
    const list = (asign.data.content ?? asign.data) as any[];
    expect(list.some((x) => x.estado === 'ACEPTADA')).toBe(true);
    expect(list.some((x) => x.estado === 'PROPUESTA')).toBe(false);
  });

  it('continues EN_CAMINO -> ENTREGADA with the mutual codes', async () => {
    const go = await a.donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'EN_CAMINO' });
    expect(go.status).toBe(200);
    expect(await estadoDe(donacionId)).toBe('EN_CAMINO');
    const { v1, v2 } = await completarEntrega(a.donante, owner, donacionId);
    expect(v1.status).toBe(200);
    expect(v2.status).toBe(200);
    expect(await estadoDe(donacionId)).toBe('ENTREGADA');
  });
});
