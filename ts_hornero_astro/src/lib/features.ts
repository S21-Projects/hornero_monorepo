/**
 * Runtime feature flags for the public site. Server-side only: read from process.env on each
 * request (the site runs with `output: 'server'`), so toggling one needs a container restart,
 * not a rebuild.
 */

/** The "Nosotros" page and its nav/footer links. Hidden unless NOSOTROS_ENABLED=true. */
export function nosotrosHabilitado(): boolean {
  return process.env.NOSOTROS_ENABLED === 'true';
}
