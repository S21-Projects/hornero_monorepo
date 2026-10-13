/**
 * Formats a date-only ISO string ("2026-12-01", optionally followed by a time part) as
 * dd/mm/yyyy by reading its calendar fields directly.
 *
 * Never go through `new Date(iso)` + toLocaleDateString for a date-only value: it parses as
 * UTC midnight and renders in the runtime's timezone, so the SSR container (UTC) and a
 * browser in Argentina (UTC-3) disagree by one day — a React hydration mismatch (#418) and
 * a wrong day on screen.
 */
export function formatFechaISO(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
