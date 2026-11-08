/**
 * Demo data for recording the thesis demo end to end. Fictional data only.
 *
 *   make demo-seed        (never run this file directly: scripts/demo/demo.sh guards the stack first)
 *
 * Leaves an EMPTY demo stack (SEED_DEMO_DATA=false) with:
 *   - 3 organizaciones at different levels, each with approved evidence files (N3, N2, N1), plus
 *     pending and observed evidence on the N1 one so the audit queue has work to do on camera;
 *   - 2 donantes, 3 referentes and the admin, all with fictional @example.com addresses;
 *   - open necesidades of every category (NO_PERECEDERO, REFRIGERADO, CONGELADO);
 *   - FONDO_COMUN donations waiting in the pool (no ronda has run yet).
 *
 * Everything goes through the public BFF API (same code paths as the UI), reusing the helpers of
 * src/flows.ts. Evidence PDFs are uploaded to the stack's bucket, which the wrapper verified to be
 * the local MinIO. The only non-API step is marking the demo emails as verified in the demo
 * database: MAIL_LOG_ONLY never sends the OTP.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Actor, BFF_URL, login, retryOn429, type Res } from '../src/client.js';
import {
  REQUISITOS_POR_NIVEL, cargarDeclaracion, subirEvidenciaPdf, type Requisito,
} from '../src/flows.js';

// --- Safety gate: the wrapper verifies the stack; this file refuses to run without its verdict ---

const project = process.env.DEMO_STACK_VERIFIED;
const envFile = process.env.DEMO_ENV_FILE;
const password = process.env.DEMO_PASSWORD;
const adminEmail = process.env.DEMO_ADMIN_EMAIL;
if (!project || project !== process.env.DEMO_PROJECT || !envFile || !password || !adminEmail) {
  console.error('Refusing to run: this seed is started by scripts/demo/demo.sh (make demo-seed), which verifies the stack.');
  process.exit(1);
}
const host = new URL(BFF_URL).hostname;
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
  console.error(`Refusing to run: BFF ${BFF_URL} is not localhost.`);
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** psql inside the demo project's own postgres container (never the default compose project). */
function psql(sql: string): string[] {
  const env: Record<string, string> = {};
  for (const k of ['PATH', 'HOME', 'USER', 'TMPDIR', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
    if (process.env[k]) env[k] = process.env[k]!;
  }
  const out = execFileSync(
    'docker',
    ['compose', '-p', project!, '--env-file', envFile!, '--profile', 'minio', 'exec', '-T', 'postgres', 'sh', '-c',
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tA'],
    { cwd: repoRoot, input: sql, encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  return out.split('\n').filter((l) => l.trim() !== '' && !/^(INSERT|UPDATE|DELETE) /.test(l));
}

// --- Fictional cast ---------------------------------------------------------------------------

const REFERENTES = [
  { key: 'naranjos', nombre: 'Marcela Quiroga', email: 'referente.naranjos@example.com' },
  { key: 'sol', nombre: 'Rubén Almada', email: 'referente.sol@example.com' },
  { key: 'molino', nombre: 'Camila Ortiz', email: 'referente.molino@example.com' },
] as const;
const DONANTES = [
  { key: 'ana', nombre: 'Ana Beltrán', email: 'donante.ana@example.com' },
  { key: 'luis', nombre: 'Luis Ferreyra', email: 'donante.luis@example.com' },
] as const;

interface OrgSpec {
  referente: (typeof REFERENTES)[number]['key'];
  nombre: string;
  tipo: 'COMEDOR' | 'MERENDERO' | 'COPITA';
  descripcion: string;
  direccion: string;
  latitud: number;
  longitud: number;
  nivel: 'N1' | 'N2' | 'N3';
}
const ORGS: OrgSpec[] = [
  {
    referente: 'naranjos', nombre: 'Comedor Los Naranjos', tipo: 'COMEDOR', nivel: 'N3',
    descripcion: 'Organización ficticia de demostración: almuerzo y cena para unas 90 personas por día.',
    direccion: 'Calle Ficticia 100, Córdoba', latitud: -31.4167, longitud: -64.1833,
  },
  {
    referente: 'sol', nombre: 'Merendero Sol de Barrio', tipo: 'MERENDERO', nivel: 'N2',
    descripcion: 'Organización ficticia de demostración: merienda y apoyo escolar de lunes a viernes.',
    direccion: 'Pasaje Imaginario 200, Córdoba', latitud: -31.3980, longitud: -64.2050,
  },
  {
    referente: 'molino', nombre: 'Copa de Leche El Molino', tipo: 'COPITA', nivel: 'N1',
    descripcion: 'Organización ficticia de demostración: copa de leche semanal; está iniciando su acreditación.',
    direccion: 'Avenida Inventada 300, Córdoba', latitud: -31.4350, longitud: -64.1500,
  },
];

// Evidence kind per requisito: DOCUMENTO uploads a generated PDF, the rest are written declarations.
const CON_ARCHIVO = new Set<Requisito>([
  'SERVICIO_REGULAR_GRATUITO', 'SEDE_INSCRIPTA_INDIVIDUALMENTE', 'CONDICIONES_SANITARIAS_ADECUADAS', 'PERSONERIA_JURIDICA_O_AVAL',
]);
const NIVELES = ['N1', 'N2', 'N3'] as const;

// --- Helpers ----------------------------------------------------------------------------------

function must(res: Res, what: string, ok: number[] = [200, 201]): Res {
  if (!ok.includes(res.status)) throw new Error(`${what} failed: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  return res;
}

async function registrar(nombre: string, email: string, tipo: 'REFERENTE' | 'DONANTE'): Promise<Actor> {
  const actor = new Actor(email);
  const res = await retryOn429(() => actor.post('/auth/register', { nombre, email, password, tipo }));
  must(res, `register ${email}`);
  return actor;
}

async function cargarEvidencia(ref: Actor, orgId: number, orgNombre: string, requisito: Requisito) {
  const texto = `Documentación ficticia (${orgNombre}): ${requisito}`;
  if (CON_ARCHIVO.has(requisito)) {
    const objectKey = await subirEvidenciaPdf(ref, orgId, `Evidencia ficticia - ${orgNombre} - ${requisito}`);
    return must(await ref.post(`/organizaciones/${orgId}/acreditacion/evidencias`, {
      requisito, tipoEvidencia: 'DOCUMENTO', declaracion: texto, objectKey,
    }), `evidence ${requisito}`).data as { id: number };
  }
  return must(await cargarDeclaracion(ref, orgId, requisito, texto), `evidence ${requisito}`).data as { id: number };
}

async function acreditarHasta(admin: Actor, ref: Actor, orgId: number, orgNombre: string, hasta: OrgSpec['nivel']) {
  for (const nivel of NIVELES) {
    for (const requisito of REQUISITOS_POR_NIVEL[nivel]) {
      const ev = await cargarEvidencia(ref, orgId, orgNombre, requisito);
      must(await admin.patch(`/organizaciones/${orgId}/acreditacion/evidencias/${ev.id}/aprobar`), `approve ${requisito}`);
    }
    must(await admin.patch(`/organizaciones/${orgId}/acreditacion/nivel`, {
      destino: nivel, motivo: 'Requisitos del nivel auditados (datos de demostración)',
    }), `raise ${orgNombre} to ${nivel}`);
    console.log(`    ${orgNombre}: ${nivel}`);
    if (nivel === hasta) return;
  }
}

// --- Main -------------------------------------------------------------------------------------

async function main() {
  console.log(`Demo seed against ${BFF_URL} (project ${project})\n`);

  const existing = psql(`SELECT count(*) FROM usuarios WHERE email LIKE '%@example.com' AND email <> '${adminEmail}';`)[0];
  if (Number(existing) > 0) {
    throw new Error('The demo data is already there. Run `make demo-reset` for a clean start.');
  }

  console.log('Registering accounts (registration is limited to 3/min per IP: this waits when needed)');
  const refs = new Map<string, Actor>();
  for (const r of REFERENTES) refs.set(r.key, await registrar(r.nombre, r.email, 'REFERENTE'));
  const donantes = new Map<string, Actor>();
  for (const d of DONANTES) donantes.set(d.key, await registrar(d.nombre, d.email, 'DONANTE'));

  // MAIL_LOG_ONLY never sends the OTP; mark the fictional addresses as verified and renew the sessions.
  const emails = [...REFERENTES, ...DONANTES].map((u) => `'${u.email}'`).join(', ');
  psql(`UPDATE usuarios SET email_verificado = true WHERE email IN (${emails});`);
  for (const actor of [...refs.values(), ...donantes.values()]) must(await actor.post('/auth/refresh'), `refresh ${actor.label}`);
  const admin = await login(adminEmail!, password!, 'admin');

  console.log('\nOrganizaciones, evidence and levels');
  const orgIds = new Map<string, number>();
  for (const spec of ORGS) {
    const ref = refs.get(spec.referente)!;
    const created = must(await ref.post('/organizaciones', {
      nombre: spec.nombre, tipo: spec.tipo, descripcion: spec.descripcion, direccion: spec.direccion,
      latitud: spec.latitud, longitud: spec.longitud, aceptaDonaciones: true,
    }), `create ${spec.nombre}`).data as { id: number };
    orgIds.set(spec.referente, created.id);
    await acreditarHasta(admin, ref, created.id, spec.nombre, spec.nivel);
  }

  // The N1 organizacion has N2 evidence waiting for the admin: two pending, one observed.
  const molino = ORGS[2];
  const molinoId = orgIds.get('molino')!;
  const molinoRef = refs.get('molino')!;
  const [sanitarias, kiosco, radio] = REQUISITOS_POR_NIVEL.N2;
  await cargarEvidencia(molinoRef, molinoId, molino.nombre, sanitarias);
  const observada = await cargarEvidencia(molinoRef, molinoId, molino.nombre, kiosco);
  must(await admin.patch(`/organizaciones/${molinoId}/acreditacion/evidencias/${observada.id}/observar`, {
    observacion: 'Falta indicar la dirección del local vecino (observación ficticia de demostración).',
  }), 'observe');
  await cargarEvidencia(molinoRef, molinoId, molino.nombre, radio);
  console.log(`    ${molino.nombre}: N2 evidence pending (1 observed)`);

  console.log('\nNecesidades');
  const catalogo = must(await admin.get('/articulos'), 'GET /articulos').data;
  const articulos = (catalogo?.content ?? catalogo) as { id: number; nombre: string; categoria: string }[];
  const idDe = (nombre: string) => {
    const a = articulos.find((x) => x.nombre === nombre);
    if (!a) throw new Error(`articulo "${nombre}" not in the catalog`);
    return a.id;
  };
  const necesidades: [string, string, 'URGENTE' | 'MEDIA' | 'NORMAL', string[]][] = [
    ['naranjos', 'Carne y pollo para el guiso semanal', 'URGENTE', ['Carne', 'Pollo']],
    ['naranjos', 'Arroz y legumbres para el almuerzo diario', 'NORMAL', ['Arroz', 'Legumbres']],
    ['sol', 'Leche y yogur para la merienda de los chicos', 'MEDIA', ['Leche', 'Yogur']],
    ['sol', 'Fideos y azúcar para los talleres de cocina', 'NORMAL', ['Fideos', 'Azúcar']],
    ['molino', 'Arroz y aceite para la copa de leche', 'URGENTE', ['Arroz', 'Aceite']],
  ];
  for (const [key, descripcion, prioridad, nombres] of necesidades) {
    must(await refs.get(key)!.post('/necesidades', {
      descripcion, prioridad, organizacionId: orgIds.get(key)!, articuloIds: nombres.map(idDe),
    }), `necesidad "${descripcion}"`);
    console.log(`    ${key}: ${descripcion}`);
  }

  console.log('\nDonations in the common pool');
  const pool: [string, string, number][] = [
    ['ana', 'Carne', 8], ['ana', 'Arroz', 20], ['luis', 'Leche', 30], ['luis', 'Fideos', 12], ['luis', 'Aceite', 6],
  ];
  let i = 0;
  for (const [key, articulo, cantidad] of pool) {
    must(await donantes.get(key)!.post('/donaciones', {
      modalidad: 'FONDO_COMUN', observaciones: `demo ${articulo}`,
      latitud: -31.4135 + (i % 4) * 0.004, longitud: -64.1811 - (i % 4) * 0.004,
      lineas: [{ articuloId: idDe(articulo), cantidad }],
    }), `donation ${articulo}`);
    console.log(`    ${key}: ${articulo} x${cantidad}`);
    i++;
  }

  console.log('\nDemo ready. Fictional logins (the same password for all):');
  console.log(`  password        ${password}`);
  console.log(`  admin           ${adminEmail}`);
  for (const r of REFERENTES) console.log(`  referente       ${r.email.padEnd(34)} ${ORGS.find((o) => o.referente === r.key)!.nombre} (${ORGS.find((o) => o.referente === r.key)!.nivel})`);
  for (const d of DONANTES) console.log(`  donante         ${d.email}`);
  console.log('\nURLs: public site http://localhost:4321 · admin/referente/donante panel http://localhost:5173');
  console.log('New accounts you register on camera cannot receive the OTP email (MAIL_LOG_ONLY): run `make demo-verify EMAIL=<address>@example.com`.');
  console.log('To start over: `make demo-reset`.');
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
