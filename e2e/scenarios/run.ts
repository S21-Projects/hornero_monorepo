/**
 * Manual-testing scenarios: put the local stack in a known state, then continue by hand in the UI.
 *
 *   npx tsx scenarios/run.ts <escenario> [--n N] [--force]
 *
 * Reuses the vitest-free helpers of src/flows.ts. Not part of the vitest suite.
 */
import { Actor, BFF_URL, login, type Res } from '../src/client.js';
import {
  anonymous, crearDirecta, llevarAEnCamino, openNecesidades, orgOwners, runId,
  type Necesidad, type Articulo,
} from '../src/flows.js';

// Same demo accounts as src/global-setup.ts (seeded by the MS with SEED_DEMO_DATA=true).
const CREDS = {
  donante: { email: 'donante@hornero.ar', password: 'Don123!' },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@hornero.ar',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!',
  },
  referente: { email: 'referente@hornero.ar', password: 'Ref123!' },
  referente2: { email: 'referente2@hornero.ar', password: 'Ref123!' },
  referente3: { email: 'referente3@hornero.ar', password: 'Ref123!' },
} as const;
type Role = keyof typeof CREDS;

const DEFAULT_N = 3;
const MAX_N = 20;

const SCENARIOS: Record<string, { description: string; run: (n: number) => Promise<void> }> = {
  'fondo-comun': {
    description: 'N FONDO_COMUN donations (OFRECIDA) offering articulos that open necesidades ask for; ready for a ronda.',
    run: fondoComun,
  },
  'directa-ofrecida': {
    description: 'N DIRECTA donations (OFRECIDA) spread across the referentes\' organizaciones, waiting for a decision.',
    run: directaOfrecida,
  },
  'en-camino': {
    description: 'N DIRECTA donations driven to EN_CAMINO, ready to test the delivery code confirmation.',
    run: enCamino,
  },
  'post-ronda': {
    description: 'N fondo-comun donations plus POST /rondas as admin; leaves PROPUESTA asignaciones for a referente (needs the Go worker).',
    run: postRonda,
  },
};

// --- helpers ---------------------------------------------------------------------------------

const tag = (label: string) => `escenario ${runId} ${label}`;

/** Fails with status + body when a response is not one of the expected statuses. */
function must(res: Res, what: string, ok: number[] = [200, 201]): Res {
  if (!ok.includes(res.status)) {
    throw new Error(`${what} failed: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}

const sessions = new Map<Role, Actor>();
/** Logs a demo account in at most once per run (login is limited to 5/min per IP; login() retries on 429). */
async function as(role: Role): Promise<Actor> {
  let actor = sessions.get(role);
  if (!actor) {
    const { email, password } = CREDS[role];
    console.log(`  login ${email}`);
    actor = await login(email, password, role);
    sessions.set(role, actor);
  }
  return actor;
}

/** orgId -> { actor, email } of the referente that owns it. Logs the three referentes in. */
async function owners() {
  const refs = { referente: await as('referente'), referente2: await as('referente2'), referente3: await as('referente3') };
  const byActor = await orgOwners(refs);
  const emailOf = (actor: Actor) => CREDS[actor.label as Role].email;
  return { byActor, emailOf };
}

/** (necesidad, articulo) pairs of open necesidades; fails when there is nothing to offer. */
async function openPairs() {
  const needs = await openNecesidades();
  const pairs = needs.flatMap((n) => n.articulos.map((a) => ({ necesidad: n, articulo: a })));
  if (pairs.length === 0) {
    throw new Error('no open necesidades with articulos; is the demo data present? (make up-local)');
  }
  return { needs, pairs };
}

async function crearFondoComun(donante: Actor, articulo: Articulo, cantidad: number, i: number, label: string) {
  const res = must(
    await donante.post('/donaciones', {
      modalidad: 'FONDO_COMUN',
      observaciones: tag(label),
      // Around central Cordoba, like the e2e test; slightly spread so they are not identical points.
      latitud: -31.4135 + (i % 5) * 0.004,
      longitud: -64.1811 - (i % 5) * 0.004,
      lineas: [{ articuloId: articulo.id, cantidad }],
    }),
    `create FONDO_COMUN donation #${i + 1}`,
  );
  return res.data as { id: number; estado: string };
}

/** Creates n pool donations, varying articulo/cantidad across the open necesidades. */
async function crearPool(n: number, label: string) {
  const donante = await as('donante');
  const { pairs } = await openPairs();
  const created: { id: number; articulo: Articulo; cantidad: number }[] = [];
  for (let i = 0; i < n; i++) {
    const { articulo } = pairs[(i * 2) % pairs.length];
    const cantidad = 1 + (i % 4);
    const d = await crearFondoComun(donante, articulo, cantidad, i, label);
    created.push({ id: d.id, articulo, cantidad });
    console.log(`  donacion ${d.id}  FONDO_COMUN ${d.estado}  ${articulo.nombre} x${cantidad}`);
  }
  return created;
}

/** Open necesidades with a known owner, ordered round-robin across organizaciones. */
function spreadAcrossOrgs(needs: Necesidad[], known: Map<number, Actor>): Necesidad[] {
  const byOrg = new Map<number, Necesidad[]>();
  for (const n of needs) if (known.has(n.organizacionId)) byOrg.set(n.organizacionId, [...(byOrg.get(n.organizacionId) ?? []), n]);
  const queues = [...byOrg.values()];
  const out: Necesidad[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) for (const q of queues) if (i < q.length) out.push(q[i]);
  return out;
}

// --- scenarios -------------------------------------------------------------------------------

async function fondoComun(n: number) {
  const created = await crearPool(n, 'fondo-comun');
  console.log(`\nListo: ${created.length} donaciones FONDO_COMUN en estado OFRECIDA.`);
  console.log(`Ahora ingresa como ${CREDS.admin.email} (${CREDS.admin.password}) y ejecuta una ronda en /rondas.`);
}

async function directaOfrecida(n: number) {
  const donante = await as('donante');
  const { byActor, emailOf } = await owners();
  const { needs } = await openPairs();
  const queue = spreadAcrossOrgs(needs, byActor);
  if (queue.length === 0) throw new Error('no open necesidad belongs to a demo referente');
  for (let i = 0; i < n; i++) {
    const necesidad = queue[i % queue.length];
    const d = await crearDirecta(donante, necesidad, 'directa-ofrecida', 1 + (i % 3), tag);
    console.log(`  donacion ${d.id}  DIRECTA ${d.estado}  org ${d.organizacionId}  -> ingresa como ${emailOf(byActor.get(d.organizacionId)!)}`);
  }
  console.log(`\nListo: ${n} donaciones DIRECTA en OFRECIDA. Ingresa como el referente indicado y decide en sus donaciones.`);
}

async function enCamino(n: number) {
  const donante = await as('donante');
  const { byActor, emailOf } = await owners();
  const { needs } = await openPairs();
  const queue = spreadAcrossOrgs(needs, byActor);
  if (queue.length === 0) throw new Error('no open necesidad belongs to a demo referente');
  for (let i = 0; i < n; i++) {
    const necesidad = queue[i % queue.length];
    const d = await crearDirecta(donante, necesidad, 'en-camino', 1 + (i % 3), tag);
    const referente = byActor.get(d.organizacionId)!;
    await llevarAEnCamino(donante, referente, d.id);
    console.log(`  donacion ${d.id}  DIRECTA EN_CAMINO  donante ${CREDS.donante.email}  referente ${emailOf(referente)}`);
  }
  console.log(`\nListo: ${n} donaciones EN_CAMINO. Cada parte genera su codigo y verifica el del otro (donante y referente indicados).`);
}

async function postRonda(n: number) {
  const created = await crearPool(n, 'post-ronda');
  const admin = await as('admin');
  const { byActor, emailOf } = await owners();

  const ronda = await admin.post('/rondas');
  if (ronda.status === 503) {
    throw new Error('El worker Go no esta disponible (POST /rondas -> 503 WORKER_NO_DISPONIBLE). Revisa: docker compose ps worker');
  }
  must(ronda, 'POST /rondas');
  const r = ronda.data;
  console.log(`\nRonda ${r.id} ${r.estado}: consideradas ${r.donacionesConsideradas}, asignadas ${r.asignadas}, sin asignar ${r.sinAsignar}, descartadas ${r.descartadas}`);
  if (r.estado !== 'COMPLETADA') console.log(`  error: ${r.error ?? '(sin detalle)'}`);

  let propuestas = 0;
  for (const c of created) {
    const asign = must(await admin.get(`/donaciones/${c.id}/asignaciones`), `GET /donaciones/${c.id}/asignaciones`);
    const rows = (asign.data.content ?? asign.data) as any[];
    const prop = rows.find((x) => x.estado === 'PROPUESTA');
    if (!prop) {
      console.log(`  donacion ${c.id}  sin asignacion PROPUESTA (queda en el fondo)`);
      continue;
    }
    propuestas++;
    const owner = byActor.get(prop.organizacionId);
    console.log(
      `  donacion ${c.id}  PROPUESTA asignacion ${prop.id}  -> ${prop.organizacionNombre} (org ${prop.organizacionId})` +
        `  referente ${owner ? emailOf(owner) : '(desconocido)'}`,
    );
  }
  console.log(`\nListo: ${propuestas}/${created.length} donaciones con asignacion PROPUESTA. Ingresa como el referente indicado para aceptar o rechazar.`);
}

function printList() {
  console.log('Escenarios de prueba manual (uso: make escenario ESC=<nombre> [N=<cantidad>])\n');
  for (const [name, s] of Object.entries(SCENARIOS)) console.log(`  ${name.padEnd(18)} ${s.description}`);
  console.log(`\nCantidad por defecto ${DEFAULT_N}, maximo ${MAX_N}. Flags: --n N, --force (permite un BFF no local).`);
  console.log('\nCuentas demo (requieren SEED_DEMO_DATA=true, make up-local):');
  for (const [role, c] of Object.entries(CREDS)) console.log(`  ${role.padEnd(11)} ${c.email.padEnd(24)} ${c.password}`);
}

// --- entry point -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const nIdx = args.indexOf('--n');
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--n');
  const name = positional[0];

  const scenario = name ? SCENARIOS[name] : undefined;
  if (!scenario) {
    if (name && name !== 'list') console.error(`Escenario desconocido: ${name}\n`);
    printList();
    process.exit(name && name !== 'list' ? 1 : 0);
  }

  let n = DEFAULT_N;
  if (nIdx !== -1) {
    n = Number(args[nIdx + 1]);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--n must be a positive integer, got "${args[nIdx + 1]}"`);
  }
  if (n > MAX_N) {
    console.log(`N=${n} supera el maximo; se usa ${MAX_N}.`);
    n = MAX_N;
  }

  const host = new URL(BFF_URL).hostname;
  if (!['localhost', '127.0.0.1'].includes(host) && !force) {
    throw new Error(`BFF ${BFF_URL} no es local; estos escenarios escriben datos. Usa --force si realmente quieres hacerlo.`);
  }
  const ready = await anonymous().get('/necesidades?size=1').catch(() => null);
  if (!ready || ready.status !== 200) throw new Error(`BFF no responde en ${BFF_URL}. Levanta el stack: make up-local`);

  console.log(`Escenario ${name} (n=${n}, run ${runId}) contra ${BFF_URL}`);
  await scenario.run(n);
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
