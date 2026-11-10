import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject } from 'vitest';
import { Actor, BFF_URL } from './client.js';
import { marker, runId } from './flows.js';

export const actors = () => {
  const s = inject('sessions');
  return {
    donante: new Actor('donante', { ...s.donante }),
    admin: new Actor('admin', { ...s.admin }),
    referente: new Actor('referente', { ...s.referente }),
    referente2: new Actor('referente2', { ...s.referente2 }),
    referente3: new Actor('referente3', { ...s.referente3 }),
  };
};
export type Actors = ReturnType<typeof actors>;

/**
 * Retires an e2e organizacion so it stops counting toward the referente's organizacion cap:
 * `rechazar` only accepts PENDIENTE, and an org at N1+ is APROBADA, so lower it to N0 first
 * (which projects it back to PENDIENTE). Both calls are best-effort.
 */
export async function retireOrg(admin: Actor, orgId: number) {
  await admin.patch(`/organizaciones/${orgId}/acreditacion/nivel`, { destino: 'N0', motivo: 'e2e cleanup' });
  await admin.patch(`/organizaciones/${orgId}/rechazar`);
}

/** Retires organizaciones left behind by earlier e2e runs (name starts with the e2e marker). */
export async function retireLeftoverOrgs(admin: Actor, referente: Actor) {
  const res = await referente.get('/organizaciones/mia');
  const orgs = (Array.isArray(res.data) ? res.data : res.data?.content ?? []) as any[];
  for (const org of orgs) {
    if (typeof org.nombre === 'string' && org.nombre.startsWith('e2e ') && org.estado !== 'RECHAZADA') {
      await retireOrg(admin, org.id);
    }
  }
}

// Vitest-free flow helpers live in ./flows.ts (shared with scripts/); re-exported for the tests.
export * from './flows.js';

export { BFF_URL };

// --- Direct DB access (claims/reports need ReNaCoM-imported organizaciones, which no API creates) ---

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Runs SQL inside the compose Postgres (same path as `make migrate`); returns the unaligned rows. */
export function psql(sql: string): string[] {
  const out = execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tA'],
    { cwd: repoRoot, input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  return out.split('\n').filter((l) => l.trim() !== '' && !/^(INSERT|UPDATE|DELETE) /.test(l));
}

const E2E_ORIGEN = "origen_id LIKE 'e2e-%'";

/**
 * Removes the organizaciones (and their claims, reports and events) that earlier runs imported, so a
 * rerun starts with free referente caps and an empty 24 h claim window. Only touches `e2e-` rows.
 */
export function cleanupUnclaimedOrgs() {
  const orgs = `SELECT id FROM organizaciones WHERE ${E2E_ORIGEN}`;
  psql(`
    DELETE FROM reclamo_organizacion_evidencias WHERE reclamo_id IN
      (SELECT id FROM reclamos_organizacion WHERE organizacion_id IN (${orgs}));
    DELETE FROM reclamos_organizacion WHERE organizacion_id IN (${orgs});
    DELETE FROM reportes_organizacion WHERE organizacion_id IN (${orgs}) OR organizacion_duplicada_id IN (${orgs});
    DELETE FROM organizacion_evento WHERE organizacion_id IN (${orgs});
    DELETE FROM organizaciones WHERE ${E2E_ORIGEN};
  `);
}

/** Imports one unclaimed (SIN_RECLAMAR, origen RENACOM) organizacion, like `make importar-renacom` does. */
export function importUnclaimedOrg(label: string): { id: number; nombre: string } {
  const nombre = marker(label);
  const key = `e2e-${runId}-${label}`;
  const [id] = psql(`
    INSERT INTO organizaciones (nombre, slug, tipo, direccion, latitud, longitud, validada, estado, nivel,
                                referente_id, acepta_donaciones, origen, origen_id, version)
    VALUES ('${nombre}', '${key}', 'COMEDOR', 'Calle E2E 123', -31.42, -64.19, false, 'SIN_RECLAMAR', 'N0',
            NULL, false, 'RENACOM', '${key}', 0)
    RETURNING id;
  `);
  return { id: Number(id), nombre };
}

/** The register flow leaves the email unverified (OTP); claims require it, so mark it directly. */
export function markEmailVerified(email: string) {
  psql(`UPDATE usuarios SET email_verificado = true WHERE email = '${email}';`);
}
