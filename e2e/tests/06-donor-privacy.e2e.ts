import { beforeAll, describe, expect, it } from 'vitest';
import {
  actors, anonymous, crearDirecta, orgOwners, pickNecesidad, type Actors, type Necesidad,
} from '../src/fixtures.js';
import type { Actor } from '../src/client.js';

/** D5/N2: donor identity is visible only to admin, the donor and the receiving referente. */
describe('Donor privacy on public donation reads', () => {
  let a: Actors;
  let necesidad: Necesidad;
  let owner: Actor;
  let donacionId: number;

  beforeAll(async () => {
    a = actors();
    const owners = await orgOwners(a);
    ({ necesidad } = await pickNecesidad(a.referente, owners));
    owner = owners.get(necesidad.organizacionId)!;
    donacionId = (await crearDirecta(a.donante, necesidad, 'privacy')).id;
  });

  const detail = async (who: Actor) => {
    const res = await who.get(`/donaciones/${donacionId}`);
    expect(res.status).toBe(200);
    return res.data;
  };

  it('anonymous sees the donation without donor identity', async () => {
    const d = await detail(anonymous());
    expect(d.id).toBe(donacionId);
    expect(d.donanteName).toBeNull();
    expect(d.donanteId).toBeNull();
  });

  it('anonymous list by organization masks the donor on every row', async () => {
    const res = await anonymous().get(`/donaciones?organizacionId=${necesidad.organizacionId}&size=100`);
    expect(res.status).toBe(200);
    const rows: any[] = res.data.content;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.donanteName).toBeNull();
      expect(r.donanteId).toBeNull();
    }
  });

  it('the receiving referente sees the donor', async () => {
    const d = await detail(owner);
    expect(d.donanteName).toBeTruthy();
    expect(d.donanteId).toBeTruthy();
  });

  it('a referente of another organization does not', async () => {
    const other = [a.referente, a.referente2, a.referente3].find((r) => r !== owner)!;
    const d = await detail(other);
    expect(d.donanteName).toBeNull();
    expect(d.donanteId).toBeNull();
  });

  it('the donor sees their own donation', async () => {
    expect((await detail(a.donante)).donanteName).toBeTruthy();
  });

  it('an admin sees the donor', async () => {
    expect((await detail(a.admin)).donanteName).toBeTruthy();
  });
});
