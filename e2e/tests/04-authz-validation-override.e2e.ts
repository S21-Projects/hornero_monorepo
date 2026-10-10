import { beforeAll, describe, expect, it } from 'vitest';
import {
  actors, anonymous, crearDirecta, estadoDe, llevarAEnCamino, marker, openNecesidades, orgOwners, pickNecesidad, type Actors, type Necesidad,
  type Articulo,
} from '../src/fixtures.js';

describe('Authorization, validation and admin override', () => {
  let a: Actors;
  let necesidad: Necesidad;
  let foreignArticulo: Articulo;
  let donacionId: number;

  beforeAll(async () => {
    a = actors();
    const owners = await orgOwners(a);
    ({ necesidad, foreignArticulo } = await pickNecesidad(a.referente, owners));
    donacionId = (await crearDirecta(a.donante, necesidad, 'authz')).id;
  });

  describe('6. authorization', () => {
    it('referente of ANOTHER org cannot decide -> 403 and state untouched', async () => {
      const res = await a.referente2.patch(`/donaciones/${donacionId}/decision`, { estado: 'ACEPTADA' });
      expect(res.status).toBe(403);
      expect(await estadoDe(donacionId)).toBe('OFRECIDA');
    });

    it('referente of another org cannot generate/verify codes or read delivery status', async () => {
      expect((await a.referente2.post(`/donaciones/${donacionId}/entrega/codigo`)).status).toBe(403);
      expect((await a.referente2.get(`/donaciones/${donacionId}/entrega`)).status).toBe(403);
      expect((await a.referente2.get(`/donaciones/${donacionId}/asignaciones`)).status).toBe(403);
    });

    it('a different donante cannot move or delete someone else donation', async () => {
      // referente role is rejected by the BFF role guard; both layers end in 403.
      expect((await a.referente.patch(`/donaciones/${donacionId}/estado`, { estado: 'CANCELADA' })).status).toBe(403);
      expect((await a.referente.del(`/donaciones/${donacionId}`)).status).toBe(403);
    });

    it('a DONANTE hitting admin endpoints gets 403', async () => {
      expect((await a.donante.get('/donaciones/activas')).status).toBe(403);
      expect((await a.donante.post('/rondas')).status).toBe(403);
      expect((await a.donante.patch(`/donaciones/${donacionId}/estado-admin`, { estado: 'ACEPTADA', motivo: 'x' })).status).toBe(403);
    });

    it('a REFERENTE cannot create donations or trigger rondas', async () => {
      expect((await a.referente.post('/rondas')).status).toBe(403);
      const res = await a.referente.post('/donaciones', {
        necesidadId: necesidad.id, lineas: [{ articuloId: necesidad.articulos[0].id, cantidad: 1 }],
      });
      expect(res.status).toBe(403);
    });

    it('anonymous requests are 401', async () => {
      const anon = anonymous();
      const res = await anon.post('/donaciones', {
        necesidadId: necesidad.id, lineas: [{ articuloId: necesidad.articulos[0].id, cantidad: 1 }],
      });
      expect(res.status).toBe(401);
      expect((await anon.patch(`/donaciones/${donacionId}/decision`, { estado: 'ACEPTADA' })).status).toBe(401);
      expect((await anon.post('/rondas')).status).toBe(401);
    });
  });

  describe('7. invalid input', () => {
    const base = () => ({ modalidad: 'DIRECTA', necesidadId: necesidad.id, observaciones: marker('invalid') });
    const line = (cantidad: number, articuloId = necesidad?.articulos[0].id) => ({ articuloId, cantidad });

    it('cantidad 0 -> 400', async () => {
      expect((await a.donante.post('/donaciones', { ...base(), lineas: [line(0)] })).status).toBe(400);
    });
    it('negative cantidad -> 400', async () => {
      expect((await a.donante.post('/donaciones', { ...base(), lineas: [line(-5)] })).status).toBe(400);
    });
    it('empty lineas -> 400', async () => {
      expect((await a.donante.post('/donaciones', { ...base(), lineas: [] })).status).toBe(400);
    });
    it('unknown body field -> 400 (forbidNonWhitelisted)', async () => {
      const res = await a.donante.post('/donaciones', { ...base(), lineas: [line(1)], isAdmin: true });
      expect(res.status).toBe(400);
    });
    it('DIRECTA without necesidadId -> 400', async () => {
      const res = await a.donante.post('/donaciones', { modalidad: 'DIRECTA', lineas: [line(1)] });
      expect(res.status).toBe(400);
    });
    it('articulo the necesidad did not ask for -> 400 ARTICULO_INCOMPATIBLE', async () => {
      const res = await a.donante.post('/donaciones', {
        ...base(), lineas: [{ articuloId: foreignArticulo.id, cantidad: 1 }],
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('ARTICULO_INCOMPATIBLE');
    });
    it('unknown necesidad -> 404 and unknown articulo -> 400', async () => {
      expect((await a.donante.post('/donaciones', { modalidad: 'DIRECTA', necesidadId: 999999999, lineas: [line(1)] })).status).toBe(404);
      expect((await a.donante.post('/donaciones', { ...base(), lineas: [line(1, 999999999)] })).status).toBe(400);
    });
    it('invalid decision value -> 400', async () => {
      expect((await a.referente.patch(`/donaciones/${donacionId}/decision`, { estado: 'ENTREGADA' })).status).toBe(400);
    });
  });

  describe('9. admin override', () => {
    it('without motivo -> 400, state untouched', async () => {
      expect((await a.admin.patch(`/donaciones/${donacionId}/estado-admin`, { estado: 'ACEPTADA' })).status).toBe(400);
      expect((await a.admin.patch(`/donaciones/${donacionId}/estado-admin`, { estado: 'ACEPTADA', motivo: '' })).status).toBe(400);
      expect((await a.admin.patch(`/donaciones/${donacionId}/estado-admin`, { estado: 'ACEPTADA', motivo: '   ' })).status).toBe(400);
      expect(await estadoDe(donacionId)).toBe('OFRECIDA');
    });

    it('with motivo -> state changes and the override is recorded', async () => {
      const motivo = marker('override motivo');
      const res = await a.admin.patch(`/donaciones/${donacionId}/estado-admin`, { estado: 'ACEPTADA', motivo });
      expect(res.status).toBe(200);
      expect(await estadoDe(donacionId)).toBe('ACEPTADA');

      const activas = await a.admin.get(`/donaciones/activas?size=100&sort=id,desc`);
      expect(activas.status).toBe(200);
      const row = (activas.data.content as any[]).find((d) => d.id === donacionId);
      expect(row, 'overridden donation not listed in /donaciones/activas').toBeTruthy();
      expect(row.overrideMotivo).toBe(motivo);
      expect(row.overrideAdminId).toBeTruthy();
      expect(row.overrideEn).toBeTruthy();
    });

    it('overriding to the same state is refused; cleanup by cancelling', async () => {
      expect((await a.admin.patch(`/donaciones/${donacionId}/estado-admin`, { estado: 'ACEPTADA', motivo: 'again' })).status).toBe(400);
      expect((await a.donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'CANCELADA' })).status).toBe(200);
    });
  });

  describe('D1. donating to an organization that is not approved (N0)', () => {
    it('DIRECTA donation to an N0 organization -> 409 ORGANIZACION_NO_APROBADA, nothing persisted', async () => {
      // Precondition built through the API: a fresh org reaches N1 (validar), publishes a
      // necesidad, then an admin lowers it back to N0 (the only way an N0 org owns a necesidad).
      const articulo = (await openNecesidades())
        .flatMap((n) => n.articulos)
        .find((x) => x.categoria === 'NO_PERECEDERO');
      expect(articulo, 'no NO_PERECEDERO articulo in seed data').toBeTruthy();

      const org = await a.referente3.post('/organizaciones', {
        nombre: marker('org-n0'), tipo: 'OTRO', latitud: -31.4, longitud: -64.19,
      });
      expect(org.status).toBe(201);
      const orgId = org.data.id as number;
      try {
        expect((await a.admin.patch(`/organizaciones/${orgId}/validar`)).status).toBe(200);
        const nec = await a.referente3.post('/necesidades', {
          descripcion: marker('necesidad-n0'), prioridad: 'NORMAL', organizacionId: orgId, articuloIds: [articulo!.id],
        });
        expect(nec.status).toBe(201);
        const lower = await a.admin.patch(`/organizaciones/${orgId}/acreditacion/nivel`, {
          destino: 'N0', motivo: marker('lower to N0'),
        });
        expect(lower.status).toBe(200);

        const res = await a.donante.post('/donaciones', {
          modalidad: 'DIRECTA', necesidadId: nec.data.id, lineas: [{ articuloId: articulo!.id, cantidad: 1 }],
        });
        expect(res.status).toBe(409);
        expect(JSON.stringify(res.body)).toContain('ORGANIZACION_NO_APROBADA');
      } finally {
        // Free the referente's 3-organizacion cap for the next run.
        await a.admin.patch(`/organizaciones/${orgId}/rechazar`);
      }
    });
  });

  describe('D2/N3. donating to an expired necesidad', () => {
    const fetchPublicNecesidades = async (orgId: number) =>
      (await anonymous().get(`/necesidades?organizacionId=${orgId}&size=100`)).data.content as any[];
    const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

    it('DIRECTA donation to a VENCIDA / past-date necesidad -> 409 NECESIDAD_NO_DISPONIBLE; in-flight donations keep moving', async () => {
      const articulo = (await openNecesidades())
        .flatMap((n) => n.articulos)
        .find((x) => x.categoria === 'NO_PERECEDERO');
      expect(articulo, 'no NO_PERECEDERO articulo in seed data').toBeTruthy();
      const donar = (necesidadId: number) => a.donante.post('/donaciones', {
        modalidad: 'DIRECTA', necesidadId, lineas: [{ articuloId: articulo!.id, cantidad: 1 }],
      });

      const org = await a.referente3.post('/organizaciones', {
        nombre: marker('org-expiry'), tipo: 'OTRO', latitud: -31.4, longitud: -64.19,
      });
      expect(org.status).toBe(201);
      const orgId = org.data.id as number;
      try {
        expect((await a.admin.patch(`/organizaciones/${orgId}/validar`)).status).toBe(200);
        const crear = (label: string, fechaVencimiento?: string) => a.referente3.post('/necesidades', {
          descripcion: marker(label), prioridad: 'NORMAL', organizacionId: orgId,
          articuloIds: [articulo!.id], ...(fechaVencimiento ? { fechaVencimiento } : {}),
        });

        // N4: a past expiry date is refused at creation, and can't be set on an open necesidad.
        const pastCreate = await crear('necesidad-past-date', isoDay(-3));
        expect(pastCreate.status).toBe(400);
        expect(JSON.stringify(pastCreate.body)).toContain('FECHA_VENCIMIENTO_PASADA');

        // A live necesidad with a donation already in flight, then closed as VENCIDA.
        const live = await crear('necesidad-live', isoDay(30));
        expect(live.status).toBe(201);
        const inFlight = await donar(live.data.id);
        expect(inFlight.status).toBe(201);
        expect((await a.referente3.patch(`/necesidades/${live.data.id}`, { estado: 'VENCIDA' })).status).toBe(200);

        const r2 = await donar(live.data.id);
        expect(r2.status).toBe(409);
        expect(JSON.stringify(r2.body)).toContain('NECESIDAD_NO_DISPONIBLE');

        // In-flight donations are untouched (D2 default): they can still be accepted and sent.
        await llevarAEnCamino(a.donante, a.referente3, inFlight.data.id);
        expect(await estadoDe(inFlight.data.id)).toBe('EN_CAMINO');
        expect((await a.donante.patch(`/donaciones/${inFlight.data.id}/estado`, { estado: 'CANCELADA' })).status).toBe(200);

        // D2/N4: taken down publicly (listing) but still readable by id and visible to its owner.
        const necId = live.data.id as number;
        const publicIds = async () => (await fetchPublicNecesidades(orgId)).map((n: any) => n.id);
        expect(await publicIds()).not.toContain(necId);
        expect((await a.referente3.get(`/necesidades?organizacionId=${orgId}&size=100`)).data.content.map((n: any) => n.id))
          .toContain(necId);
        expect((await a.donante.get(`/necesidades/${necId}`)).data.estado).toBe('VENCIDA');

        // Leaving VENCIDA through the generic update is refused; relanzar has its own rules.
        const reopen = await a.referente3.patch(`/necesidades/${necId}`, { estado: 'ABIERTA', fechaVencimiento: isoDay(10) });
        expect(reopen.status).toBe(409);
        expect(JSON.stringify(reopen.body)).toContain('NECESIDAD_VENCIDA_USAR_RELANZAR');
        const pastRelaunch = await a.referente3.post(`/necesidades/${necId}/relanzar`, { fechaVencimiento: isoDay(-1) });
        expect(pastRelaunch.status).toBe(400);
        expect((await a.referente3.post(`/necesidades/${necId}/relanzar`, {})).status).toBe(400);
        expect((await a.donante.post(`/necesidades/${necId}/relanzar`, { fechaVencimiento: isoDay(10) })).status).toBe(403);

        // Relaunch -> open again, donations accepted, listed publicly.
        const relaunched = await a.referente3.post(`/necesidades/${necId}/relanzar`, { fechaVencimiento: isoDay(10) });
        expect(relaunched.status).toBe(200);
        expect(relaunched.data.estado).toBe('ABIERTA');
        expect((await donar(necId)).status).toBe(201);
        expect(await publicIds()).toContain(necId);
        const again = await a.referente3.post(`/necesidades/${necId}/relanzar`, { fechaVencimiento: isoDay(10) });
        expect(again.status).toBe(409);
        expect(JSON.stringify(again.body)).toContain('NECESIDAD_NO_VENCIDA');
      } finally {
        await a.admin.patch(`/organizaciones/${orgId}/rechazar`);
      }
    });
  });
});
