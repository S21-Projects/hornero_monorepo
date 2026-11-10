import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { actors, crearDirecta, llevarAEnCamino, marker, orgOwners, pickNecesidad, type Actors } from '../src/fixtures.js';

/** N11: Idempotency-Key on business POSTs (draft-ietf-httpapi-idempotency-key-header-07). */
describe('N11. idempotency keys', () => {
  let a: Actors;
  let necesidad: Awaited<ReturnType<typeof pickNecesidad>>['necesidad'];

  const body = (label: string, cantidad = 1) => ({
    modalidad: 'DIRECTA',
    necesidadId: necesidad.id,
    observaciones: marker(label),
    lineas: [{ articuloId: necesidad.articulos[0].id, cantidad }],
  });

  // The list is capped at 100 rows, so compare ids (newest first) instead of lengths.
  const misIds = async (): Promise<number[]> => {
    const res = await a.donante.get('/donaciones/mias?size=100&sort=id,desc');
    return (res.data.content ?? res.data).map((d: any) => d.id);
  };
  const nuevos = async (antes: number[]) => (await misIds()).filter((id) => !antes.includes(id));

  beforeAll(async () => {
    a = actors();
    const owners = await orgOwners(a);
    ({ necesidad } = await pickNecesidad(a.referente, owners));
  });

  it('a missing key is 400 IDEMPOTENCY_KEY_REQUERIDA and creates nothing', async () => {
    const antes = await misIds();
    const res = await a.donante.post('/donaciones', body('idem-missing'), { key: null });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('IDEMPOTENCY_KEY_REQUERIDA');
    expect(await misIds()).toEqual(antes);
  });

  it('a key that is not a UUID is 400 IDEMPOTENCY_KEY_INVALIDA', async () => {
    const res = await a.donante.post('/donaciones', body('idem-bad'), { key: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('IDEMPOTENCY_KEY_INVALIDA');
  });

  it('replaying the same key and body returns the original resource and creates no duplicate', async () => {
    const key = randomUUID();
    const payload = body('idem-replay');
    const antes = await misIds();

    const first = await a.donante.post('/donaciones', payload, { key });
    const second = await a.donante.post('/donaciones', payload, { key });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.data.id).toBe(first.data.id);
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(await nuevos(antes)).toHaveLength(1);
  });

  it('the same key with a different body is 422 IDEMPOTENCIA_PAYLOAD_DISTINTO', async () => {
    const key = randomUUID();
    const first = await a.donante.post('/donaciones', body('idem-422-a'), { key });
    const second = await a.donante.post('/donaciones', body('idem-422-b', 2), { key });

    expect(first.status).toBe(201);
    expect(second.status).toBe(422);
    expect(second.body.message).toBe('IDEMPOTENCIA_PAYLOAD_DISTINTO');
  });

  it('a business error is a result too: the same key replays the same 4xx', async () => {
    const key = randomUUID();
    // Valid for the BFF, rejected by the MS: the necesidad does not exist.
    const missing = { ...body('idem-4xx'), necesidadId: 2_000_000_000 };
    const first = await a.donante.post('/donaciones', missing, { key });
    const second = await a.donante.post('/donaciones', missing, { key });

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(second.headers['idempotent-replayed']).toBe('true');
  });

  it('two simultaneous requests with the same key run the operation once', async () => {
    const key = randomUUID();
    const payload = body('idem-concurrent');
    const antes = await misIds();

    const [x, y] = await Promise.all([
      a.donante.post('/donaciones', payload, { key }),
      a.donante.post('/donaciones', payload, { key }),
    ]);

    // Allowed outcomes: one 201 plus a 409 (the other arrived while the first was running), or a
    // 201 plus its replay (the other arrived after it finished).
    const statuses = [x.status, y.status].sort();
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    if (statuses[1] === 409) {
      const loser = x.status === 409 ? x : y;
      expect(loser.body.message).toBe('IDEMPOTENCIA_EN_PROCESO');
    } else {
      expect(x.data.id).toBe(y.data.id);
    }
    expect(await nuevos(antes)).toHaveLength(1);
  });

  it('a delivery code request replays the same code instead of issuing another', async () => {
    const d = await crearDirecta(a.donante, necesidad, 'idem-codigo');
    await llevarAEnCamino(a.donante, a.referente, d.id);
    const key = randomUUID();

    const first = await a.donante.post(`/donaciones/${d.id}/entrega/codigo`, undefined, { key });
    const second = await a.donante.post(`/donaciones/${d.id}/entrega/codigo`, undefined, { key });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.data.codigo).toBe(first.data.codigo);
    expect(second.headers['idempotent-replayed']).toBe('true');

    // The same UUID used by another user is an independent key: it runs and issues its own code.
    const other = await a.referente.post(`/donaciones/${d.id}/entrega/codigo`, undefined, { key });
    expect(other.status).toBe(201);
    expect(other.headers['idempotent-replayed']).toBeUndefined();
    expect(other.data.codigo).not.toBe(first.data.codigo);
  });

  it('the same key on another route is another operation', async () => {
    const key = randomUUID();
    const d = await a.donante.post('/donaciones', body('idem-route'), { key });
    expect(d.status).toBe(201);
    const verificar = await a.donante.post(`/donaciones/${d.data.id}/entrega/verificar`, { codigo: '000000' }, { key });
    expect(verificar.headers['idempotent-replayed']).toBeUndefined();
  });

  it('auth endpoints do not need a key', async () => {
    const res = await a.donante.post('/auth/refresh');
    expect(res.status).not.toBe(400);
  });
});
