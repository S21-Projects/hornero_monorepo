import { beforeAll, describe, expect, it } from 'vitest';
import {
  actors, crearDirecta, estadoDe, llevarAEnCamino, orgOwners, pickNecesidad, type Actors, type Necesidad,
} from '../src/fixtures.js';

describe('Exceptional donation paths', () => {
  let a: Actors;
  let necesidad: Necesidad;

  beforeAll(async () => {
    a = actors();
    const owners = await orgOwners(a);
    ({ necesidad } = await pickNecesidad(a.referente, owners));
  });

  it('3. referente rejects a DIRECTA donation -> RECHAZADA, and nothing moves afterwards', async () => {
    const d = await crearDirecta(a.donante, necesidad, 'reject');
    const res = await a.referente.patch(`/donaciones/${d.id}/decision`, { estado: 'RECHAZADA' });
    expect(res.status).toBe(200);
    expect(await estadoDe(d.id)).toBe('RECHAZADA');

    expect((await a.referente.patch(`/donaciones/${d.id}/decision`, { estado: 'ACEPTADA' })).status).toBe(400);
    expect((await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'EN_CAMINO' })).status).toBe(400);
    expect((await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'CANCELADA' })).status).toBe(400);
    expect((await a.admin.patch(`/donaciones/${d.id}/estado-admin`, { estado: 'ACEPTADA', motivo: 'e2e' })).status).toBe(400);
    expect(await estadoDe(d.id)).toBe('RECHAZADA');
  });

  it('4. donante cancels -> CANCELADA, terminal', async () => {
    const d = await crearDirecta(a.donante, necesidad, 'cancel');
    const res = await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'CANCELADA' });
    expect(res.status).toBe(200);
    expect(await estadoDe(d.id)).toBe('CANCELADA');

    expect((await a.referente.patch(`/donaciones/${d.id}/decision`, { estado: 'ACEPTADA' })).status).toBe(400);
    expect((await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'EN_CAMINO' })).status).toBe(400);
    expect(await estadoDe(d.id)).toBe('CANCELADA');
  });

  it('5. wrong delivery code is rejected (400) and the donation state is unchanged', async () => {
    const d = await crearDirecta(a.donante, necesidad, 'wrong-code');
    await llevarAEnCamino(a.donante, a.referente, d.id);
    const issued = await a.referente.post(`/donaciones/${d.id}/entrega/codigo`);
    expect(issued.status).toBe(201);
    const wrong = issued.data.codigo === '000000' ? '111111' : '000000';

    const res = await a.donante.post(`/donaciones/${d.id}/entrega/verificar`, { codigo: wrong });
    expect(res.status).toBe(400);
    expect(await estadoDe(d.id)).toBe('EN_CAMINO');

    // Malformed codes never reach the service.
    const malformed = await a.donante.post(`/donaciones/${d.id}/entrega/verificar`, { codigo: '12ab' });
    expect(malformed.status).toBe(400);

    expect((await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'CANCELADA' })).status).toBe(200);
  });

  it('5c. the 5th wrong code locks the delivery code (429) and the right code is then refused', async () => {
    const d = await crearDirecta(a.donante, necesidad, 'lockout');
    await llevarAEnCamino(a.donante, a.referente, d.id);
    const issued = await a.referente.post(`/donaciones/${d.id}/entrega/codigo`);
    const wrong = issued.data.codigo === '000000' ? '111111' : '000000';
    try {
      for (let i = 1; i <= 4; i++) {
        expect((await a.donante.post(`/donaciones/${d.id}/entrega/verificar`, { codigo: wrong })).status).toBe(400);
      }
      expect((await a.donante.post(`/donaciones/${d.id}/entrega/verificar`, { codigo: wrong })).status).toBe(429);
      // Burnt: even the right code is refused now.
      expect((await a.donante.post(`/donaciones/${d.id}/entrega/verificar`, { codigo: issued.data.codigo })).status).toBe(400);
    } finally {
      await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'CANCELADA' });
    }
  });

  it('5b. verifying before the counterpart generated a code is rejected', async () => {
    const d = await crearDirecta(a.donante, necesidad, 'no-code');
    await llevarAEnCamino(a.donante, a.referente, d.id);
    const res = await a.donante.post(`/donaciones/${d.id}/entrega/verificar`, { codigo: '123456' });
    expect(res.status).toBe(400);
    await a.donante.patch(`/donaciones/${d.id}/estado`, { estado: 'CANCELADA' });
  });
});
