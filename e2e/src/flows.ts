import { Actor } from './client.js';

/**
 * Vitest-free flow helpers shared by the e2e tests (via fixtures.ts) and the manual-testing
 * scenario scripts (scenarios/). Must not import from 'vitest'.
 */

export const anonymous = () => new Actor('anonymous');

/** The referente actors needed to resolve organizacion ownership. */
export interface ReferenteActors {
  referente: Actor;
  referente2: Actor;
  referente3: Actor;
}

export const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const marker = (label: string) => `e2e ${runId} ${label}`;

export interface Articulo {
  id: number;
  nombre: string;
  categoria: string;
}
export interface Necesidad {
  id: number;
  estado: string;
  organizacionId: number;
  articulos: Articulo[];
}

/** Maps organizacionId -> the referente actor that owns it (resolved through GET /organizaciones/mia). */
export async function orgOwners(a: ReferenteActors): Promise<Map<number, Actor>> {
  const owners = new Map<number, Actor>();
  for (const ref of [a.referente, a.referente2, a.referente3]) {
    const res = await ref.get('/organizaciones/mia');
    for (const org of res.data ?? []) owners.set(org.id, ref);
  }
  return owners;
}

/** All open needs (public endpoint). */
export async function openNecesidades(): Promise<Necesidad[]> {
  const res = await anonymous().get('/necesidades?size=100');
  return (res.data.content as Necesidad[]).filter((n) => n.estado === 'ABIERTA' && n.articulos.length > 0);
}

/** An open need whose owner referente is `owner`, plus an articulo that need does NOT ask for. */
export async function pickNecesidad(owner: Actor, owners: Map<number, Actor>) {
  const all = await openNecesidades();
  const necesidad = all.find((n) => owners.get(n.organizacionId) === owner);
  if (!necesidad) throw new Error(`no open necesidad for ${owner.label}; is the seed data present?`);
  const wanted = new Set(necesidad.articulos.map((x) => x.id));
  const foreign = all.flatMap((n) => n.articulos).find((x) => !wanted.has(x.id));
  if (!foreign) throw new Error('no articulo outside the necesidad found');
  return { necesidad, foreignArticulo: foreign };
}

/** `tag` builds the observaciones marker (defaults to the e2e marker; scenarios pass their own). */
export async function crearDirecta(
  donante: Actor,
  necesidad: Necesidad,
  label: string,
  cantidad = 2,
  tag: (label: string) => string = marker,
) {
  const res = await donante.post('/donaciones', {
    modalidad: 'DIRECTA',
    necesidadId: necesidad.id,
    observaciones: tag(label),
    lineas: [{ articuloId: necesidad.articulos[0].id, cantidad }],
  });
  if (res.status !== 201) throw new Error(`crearDirecta failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.data as { id: number; estado: string; organizacionId: number };
}

export async function estadoDe(id: number): Promise<string> {
  const res = await anonymous().get(`/donaciones/${id}`);
  if (res.status !== 200) throw new Error(`GET /donaciones/${id} -> ${res.status}`);
  return res.data.estado;
}

/** OFRECIDA -> ACEPTADA -> EN_CAMINO, asserting nothing (callers assert what they care about). */
export async function llevarAEnCamino(donante: Actor, referente: Actor, donacionId: number) {
  const dec = await referente.patch(`/donaciones/${donacionId}/decision`, { estado: 'ACEPTADA' });
  if (dec.status !== 200) throw new Error(`accept failed: ${dec.status} ${JSON.stringify(dec.body)}`);
  const go = await donante.patch(`/donaciones/${donacionId}/estado`, { estado: 'EN_CAMINO' });
  if (go.status !== 200) throw new Error(`EN_CAMINO failed: ${go.status} ${JSON.stringify(go.body)}`);
}

/** Both parties exchange codes; returns the final verify response. */
export async function completarEntrega(donante: Actor, referente: Actor, donacionId: number) {
  const codRef = await referente.post(`/donaciones/${donacionId}/entrega/codigo`);
  const codDon = await donante.post(`/donaciones/${donacionId}/entrega/codigo`);
  if (codRef.status !== 201 || codDon.status !== 201) {
    throw new Error(`code generation failed: ${codRef.status}/${codDon.status}`);
  }
  const v1 = await donante.post(`/donaciones/${donacionId}/entrega/verificar`, { codigo: codRef.data.codigo });
  const v2 = await referente.post(`/donaciones/${donacionId}/entrega/verificar`, { codigo: codDon.data.codigo });
  return { v1, v2 };
}
