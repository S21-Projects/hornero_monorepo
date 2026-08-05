import type { UserRole } from '../store/auth.store';

export const ESTADO_NECESIDAD_LABELS: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_PROGRESO: 'En progreso',
  CUMPLIDA: 'Cumplida',
  VENCIDA: 'Vencida',
};

export const ESTADO_DONACION_LABELS: Record<string, string> = {
  OFRECIDA: 'Ofrecida',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  EN_CAMINO: 'En camino',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: 'Administrador',
  REFERENTE: 'Referente',
  DONANTE: 'Donante',
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

export function necesidadesPorEstado(
  necesidades: Array<{ estado: string }>,
): CountItem[] {
  return countByField(necesidades, 'estado', ESTADO_NECESIDAD_LABELS);
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
