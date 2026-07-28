/**
 * Formats an ISO date string (YYYY-MM-DD) as DD/MM/YYYY (es-AR calendar format).
 *
 * IMPORTANT: Do NOT use `new Date("YYYY-MM-DD")` — that parses as UTC midnight
 * and shifts the date back one day for users in UTC-3 and similar timezones.
 * Instead, split the string and construct via `new Date(y, m-1, d)` which is
 * always local time.
 *
 * Returns "—" for undefined, empty, or malformed input.
 */
export function formatFecha(iso?: string): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return '—';
  const [yStr, mStr, dStr] = parts;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return '—';
  // Local-time Date to avoid UTC midnight off-by-one.
  const date = new Date(y, m - 1, d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}
