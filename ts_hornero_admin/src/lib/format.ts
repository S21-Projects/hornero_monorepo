import { UNIDAD_ARTICULO } from './domain-ui';
import type { DonacionLinea } from '../types/domain';

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

/**
 * Compact one-line summary of a donación's articulo lines (feature catalogo-articulos, work
 * unit G) — e.g. "5 kg Arroz, 6 paquetes Fideos". `KG`/`LITRO` stay invariant; `PAQUETE`/`UNIDAD`
 * pluralize when `cantidad !== 1`. Returns "—" for an undefined/empty list (pre-catalog
 * donación or one that genuinely carries no lines).
 */
export function formatLineas(lineas?: DonacionLinea[]): string {
  if (!lineas || lineas.length === 0) return '—';
  return lineas
    .map((l) => {
      const base = UNIDAD_ARTICULO[l.unidad] ?? l.unidad;
      const invariable = l.unidad === 'KG' || l.unidad === 'LITRO';
      const unidad = invariable || l.cantidad === 1 ? base : `${base}s`;
      return `${l.cantidad} ${unidad} ${l.nombre}`;
    })
    .join(', ');
}

const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Formats an ISO instant (UTC) as `DD/MM/YYYY HH:mm:ss` in Argentina time; "—" if missing/invalid. */
export function formatFechaHora(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const p = Object.fromEntries(FECHA_HORA.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}
