import { TIPO_ORGANIZACION_LABELS, type TipoOrganizacion } from '@/lib/tipos-organizacion';
import { ROLE_LABELS, type UserRole } from '@/lib/roles';

export const ESTADO_NECESIDAD_LABELS: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_PROGRESO: 'En progreso',
  CUMPLIDA: 'Cumplida',
  VENCIDA: 'Vencida',
};

export const PRIORIDAD_NECESIDAD_LABELS: Record<string, string> = {
  URGENTE: 'Urgente',
  MEDIA: 'Media',
  NORMAL: 'Normal',
};

export const ESTADO_DONACION_LABELS: Record<string, string> = {
  OFRECIDA: 'Ofrecida',
  EN_CAMINO: 'En camino',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};

export interface CountItem {
  key: string;
  label: string;
  value: number;
}

/** Counts occurrences of `field` across `items`, returning one entry per known label (zero-filled). */
export function countByField<T>(
  items: T[],
  field: keyof T,
  labels: Record<string, string>,
): CountItem[] {
  const counts: Record<string, number> = {};
  for (const key of Object.keys(labels)) counts[key] = 0;

  for (const item of items) {
    const raw = item[field];
    const key = String(raw);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.entries(counts).map(([key, value]) => ({
    key,
    label: labels[key] ?? key,
    value,
  }));
}

export function organizacionesPorTipo(
  organizaciones: Array<{ tipo: TipoOrganizacion }>,
): CountItem[] {
  return countByField(organizaciones, 'tipo', TIPO_ORGANIZACION_LABELS);
}

export function necesidadesPorEstado(
  necesidades: Array<{ estado: string }>,
): CountItem[] {
  return countByField(necesidades, 'estado', ESTADO_NECESIDAD_LABELS);
}

export function necesidadesPorPrioridad(
  necesidades: Array<{ prioridad: string }>,
): CountItem[] {
  return countByField(necesidades, 'prioridad', PRIORIDAD_NECESIDAD_LABELS);
}

export function donacionesPorEstado(
  donaciones: Array<{ estado: string }>,
): CountItem[] {
  return countByField(donaciones, 'estado', ESTADO_DONACION_LABELS);
}

export function usuariosPorRol(
  usuarios: Array<{ tipo: UserRole }>,
): CountItem[] {
  return countByField(usuarios, 'tipo', ROLE_LABELS);
}
