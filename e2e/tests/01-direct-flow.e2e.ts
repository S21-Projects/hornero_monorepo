import { beforeAll, describe, expect, it } from 'vitest';
import { actors, crearDirecta, estadoDe, orgOwners, pickNecesidad, anonymous, type Actors } from '../src/fixtures.js';

describe('Scenario 1 - DIRECTA donation, happy path to ENTREGADA', () => {
  let a: Actors;
  let donacionId: number;
  let codigoReferente: string;
  let codigoDonante: string;
  let referente: Actors['referente'];

  beforeAll(async () => {
    a = actors();
    const owners = await orgOwners(a);
    referente = a.referente;
    const { necesidad } = await pickNecesidad(referente, owners);
    const d = await crearDirecta(a.donante, necesidad, 'direct-happy');
    donacionId = d.id;
    expect(d.estado).toBe('OFRECIDA');
  });

  it('is OFRECIDA and visible to the referente of the target org', async () => {
    expect(await estadoDe(donacionId)).toBe('OFRECIDA');
    // Paged now (newest first); size=100 keeps the fresh donation on the first page.
    const res = await referente.get('/donaciones/mi-organizacion?size=100');
    expect(res.status).toBe(200);
    expect(((res.data.content ?? res.data) as any[]).map((d) => d.id)).toContain(donacionId);
  });

  it('appears in the donante own list', async () => {
    const res = await a.donante.get('/donaciones/mias?size=100&sort=id,desc');
    expect(res.status).toBe(200);
    const ids = (res.data.content ?? res.data).map((d: any) => d.id);
    expect(ids).toContain(donacionId);
  });

  it('referente accepts -> ACEPTADA', async () => {
    const res = await referente.patch(`/donaciones/${donacionId}/decision`, { estado: 'ACEPTADA' });
    expect(res.status).toBe(200);
    expect(await estadoDe(donacionId)).toBe('ACEPTADA');
  });

  it('donante cannot jump to a state outside the table (ACEPTADA -> ENTREGADA via estado) ', async () => {
    const res = await a.donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'ENTREGADA' });
    expect(res.status).toBe(400);
    expect(await estadoDe(donacionId)).toBe('ACEPTADA');
  });

  it('donante moves to EN_CAMINO', async () => {
    const res = await a.donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'EN_CAMINO' });
    expect(res.status).toBe(200);
    expect(await estadoDe(donacionId)).toBe('EN_CAMINO');
  });

  it('each party generates its own code (shown once, 6 digits)', async () => {
    const r = await a.referente.post(`/donaciones/${donacionId}/entrega/codigo`);
    const d = await a.donante.post(`/donaciones/${donacionId}/entrega/codigo`);
    expect(r.status).toBe(201);
    expect(d.status).toBe(201);
    expect(r.data.codigo).toMatch(/^\d{6}$/);
    expect(d.data.codigo).toMatch(/^\d{6}$/);
    codigoReferente = r.data.codigo;
    codigoDonante = d.data.codigo;
  });

  it('donante verifies the referente code -> PENDIENTE_CONFIRMACION', async () => {
    const res = await a.donante.post(`/donaciones/${donacionId}/entrega/verificar`, { codigo: codigoReferente });
    expect(res.status).toBe(200);
    expect(res.data.confirmadaDonanteEn).toBeTruthy();
    expect(res.data.confirmadaReferenteEn).toBeNull();
    expect(await estadoDe(donacionId)).toBe('PENDIENTE_CONFIRMACION');
  });

  it('referente verifies the donante code -> ENTREGADA', async () => {
    const res = await a.referente.post(`/donaciones/${donacionId}/entrega/verificar`, { codigo: codigoDonante });
    expect(res.status).toBe(200);
    expect(res.data.estado).toBe('ENTREGADA');
    expect(await estadoDe(donacionId)).toBe('ENTREGADA');
    const status = await a.donante.get(`/donaciones/${donacionId}/entrega`);
    expect(status.data.confirmadaDonanteEn).toBeTruthy();
    expect(status.data.confirmadaReferenteEn).toBeTruthy();
  });

  it('ENTREGADA is terminal: cancel is refused', async () => {
    const res = await a.donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'CANCELADA' });
    expect(res.status).toBe(400);
    expect(await estadoDe(donacionId)).toBe('ENTREGADA');
  });

  it('anonymous cannot read delivery status', async () => {
    const res = await anonymous().get(`/donaciones/${donacionId}/entrega`);
    expect(res.status).toBe(401);
  });
});
