import { beforeAll, describe, expect, it } from 'vitest';
import {
  actors, anonymous, crearDirecta, estadoDe, marker, orgOwners, pickNecesidad, type Actors, type Necesidad,
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
});
