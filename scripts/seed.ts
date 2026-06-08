/**
 * Seed script — registers N referentes with orgs and validates them as admin.
 * Run: make seed  (from polyrepo root)
 * Requires a running stack: make dev (or docker compose up)
 *
 * Config via environment variables:
 *   BFF_URL      — default http://localhost:3001
 *   SEED_COUNT   — default 3 (max 5)
 */

const BFF_URL = process.env.BFF_URL ?? 'http://localhost:3001';
const SEED_COUNT = Math.min(Number(process.env.SEED_COUNT ?? 3), 5);
const ADMIN_EMAIL = 'admin@hornero.ar';
const ADMIN_PASSWORD = 'Admin123!';

interface JsonResponse<T> {
  data: T;
  setCookieHeader: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[seed] Network error reaching ${url}: ${msg}`);
    console.error(`[seed] Is BFF running at ${BFF_URL}?`);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${body}`);
  }

  const data = (await res.json()) as T;
  const setCookieHeader = res.headers.get('set-cookie');
  return { data, setCookieHeader };
}

function extractToken(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    console.error(
      `[seed] Set-Cookie missing after auth — is BFF running at ${BFF_URL}?`
    );
    process.exit(1);
  }

  // Set-Cookie may contain multiple directives: "access_token=<val>; Path=/; HttpOnly; ..."
  const match = setCookieHeader.match(/access_token=([^;]+)/);
  if (!match) {
    console.error(
      `[seed] access_token not found in Set-Cookie — is BFF running at ${BFF_URL}?`
    );
    process.exit(1);
  }

  return match[1];
}

interface RegisterPayload {
  nombre: string;
  email: string;
  password: string;
}

interface OrgPayload {
  nombre: string;
  tipo: string;
  descripcion: string;
  direccion: string;
  latitud: number;
  longitud: number;
}

interface ReferenteSlot {
  user: RegisterPayload;
  org: OrgPayload;
}

// 5 pre-defined slots — Córdoba capital area (~lat -31.4, lng -64.2)
const REFERENTE_SLOTS: ReferenteSlot[] = [
  {
    user: { nombre: 'Ana Rodríguez', email: 'ref1@test.ar', password: 'Ref123!' },
    org: {
      nombre: 'Comedor San Martín',
      tipo: 'COMEDOR',
      descripcion: 'Comedor comunitario del barrio San Martín',
      direccion: 'Av. San Martín 1200, Córdoba',
      latitud: -31.4135,
      longitud: -64.1872,
    },
  },
  {
    user: { nombre: 'Carlos López', email: 'ref2@test.ar', password: 'Ref123!' },
    org: {
      nombre: 'Merendero Los Pinos',
      tipo: 'MERENDERO',
      descripcion: 'Merendero barrial Los Pinos',
      direccion: 'Bv. Los Pinos 450, Córdoba',
      latitud: -31.4251,
      longitud: -64.1953,
    },
  },
  {
    user: { nombre: 'María González', email: 'ref3@test.ar', password: 'Ref123!' },
    org: {
      nombre: 'Comedor Esperanza',
      tipo: 'COMEDOR',
      descripcion: 'Comedor Esperanza — barrio Villa El Libertador',
      direccion: 'Calle Esperanza 320, Córdoba',
      latitud: -31.4389,
      longitud: -64.2105,
    },
  },
  {
    user: { nombre: 'Pedro Díaz', email: 'ref4@test.ar', password: 'Ref123!' },
    org: {
      nombre: 'Comedor La Unión',
      tipo: 'COMEDOR',
      descripcion: 'Comedor comunitario La Unión',
      direccion: 'Ruta 9 km 745, Córdoba',
      latitud: -31.3965,
      longitud: -64.2234,
    },
  },
  {
    user: { nombre: 'Laura Fernández', email: 'ref5@test.ar', password: 'Ref123!' },
    org: {
      nombre: 'Merendero Arcoíris',
      tipo: 'MERENDERO',
      descripcion: 'Merendero Arcoíris — barrio IPV',
      direccion: 'Pasaje Azul 88, Córdoba',
      latitud: -31.4512,
      longitud: -64.1788,
    },
  },
];

function authHeader(token: string): Record<string, string> {
  return { Cookie: `access_token=${token}` };
}

async function main() {
  const slots = REFERENTE_SLOTS.slice(0, SEED_COUNT);

  console.log(`[seed] BFF_URL=${BFF_URL}  SEED_COUNT=${SEED_COUNT}`);
  console.log('[seed] Phase 1: registering referentes + creating orgs...');

  for (const slot of slots) {
    let token: string;

    // Register referente — 409 means already exists, fall back to login
    try {
      const { setCookieHeader } = await fetchJson<unknown>(`${BFF_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot.user),
      });
      token = extractToken(setCookieHeader);
      console.log(`  [+] Registered ${slot.user.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('HTTP 409')) {
        console.log(`  [~] ${slot.user.email} already exists — logging in`);
        const { setCookieHeader } = await fetchJson<unknown>(`${BFF_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: slot.user.email, password: slot.user.password }),
        });
        token = extractToken(setCookieHeader);
      } else {
        console.error(`[seed] Failed to register/login ${slot.user.email}: ${msg}`);
        process.exit(1);
      }
    }

    // Create organization
    try {
      await fetchJson<unknown>(`${BFF_URL}/organizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(token) },
        body: JSON.stringify(slot.org),
      });
      console.log(`  [+] Created org "${slot.org.nombre}" for ${slot.user.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 409 = org already exists for this referente — treat as OK and continue
      if (msg.includes('HTTP 409')) {
        console.log(`  [~] Org for ${slot.user.email} already exists — skipping`);
      } else {
        console.error(`[seed] Failed to create org for ${slot.user.email}: ${msg}`);
        process.exit(1);
      }
    }
  }

  console.log('[seed] Phase 2: admin login...');
  const { setCookieHeader: adminCookieHeader } = await fetchJson<unknown>(
    `${BFF_URL}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    }
  );
  const adminToken = extractToken(adminCookieHeader);
  console.log(`  [+] Admin logged in`);

  console.log('[seed] Phase 3: fetching pending orgs...');
  const { data: pendingOrgs } = await fetchJson<Array<{ id: number; nombre: string }>>(
    `${BFF_URL}/organizaciones/pendientes`,
    {
      headers: authHeader(adminToken),
    }
  );
  console.log(`  [+] Found ${pendingOrgs.length} pending org(s)`);

  console.log('[seed] Phase 4: validating pending orgs...');
  for (const org of pendingOrgs) {
    try {
      await fetchJson<unknown>(`${BFF_URL}/organizaciones/${org.id}/validar`, {
        method: 'PATCH',
        headers: authHeader(adminToken),
      });
      console.log(`  [+] Validated org #${org.id} "${org.nombre}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('HTTP 409')) {
        console.log(`  [~] Org #${org.id} already validated — skipping`);
      } else {
        console.error(`[seed] Failed to validate org #${org.id}: ${msg}`);
        process.exit(1);
      }
    }
  }

  console.log('[seed] Seed complete.');
  process.exit(0);
}

main();
