/** Shared definitions for the vulnerability map (`/mapa`). */

export interface DepartamentoProps {
  codigo: string;
  nombre: string | null;
  provincia: string | null;
  habitantes: number | null;
  comedores: number;
  necesidadesAbiertas: number;
  habitantesPorComedor: number | null;
  deficitCobertura: number | null;
  /** Null when the departamento has no comedores in the registry. */
  vulnerabilidad: number | null;
}

/** Upper bounds (exclusive) of each step; the last colour is open-ended (>= 4). */
export const BREAKS = [0.5, 0.8, 1.25, 2, 4] as const;

/** Diverging scale, centred on the national median (1.0). */
export const COLORS = ['#1C6E96', '#8CC3E3', '#F1E4D2', '#E8A060', '#C85A20', '#7A2A08'] as const;

export const BREAK_LABELS = ['Menos de 0,5', '0,5 a 0,8', '0,8 a 1,25', '1,25 a 2', '2 a 4', '4 o más'] as const;

export const NULL_FILL = '#DAD3C8';
export const NULL_STROKE = '#9B8E7E';

export function colorFor(v: number | null | undefined): string {
  if (v == null) return NULL_FILL;
  const i = BREAKS.findIndex((b) => v < b);
  return COLORS[i === -1 ? COLORS.length - 1 : i];
}

const nf = new Intl.NumberFormat('es-AR');
const nf2 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

export const fmtInt = (n: number | null | undefined) => (n == null ? '—' : nf.format(Math.round(n)));
export const fmtRatio = (n: number | null | undefined) => (n == null ? '—' : nf2.format(n));
