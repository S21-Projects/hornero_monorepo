import type { PageData } from '../types/api';
import type { OrganizacionAdmin } from '../types/domain';
import type { UserRole } from '../store/auth.store';

/** User totals read from `totalElements` of filtered `/usuarios` queries (no rows are fetched). */
export interface UsuarioCounts {
  porRol: Record<UserRole, number>;
  activos: number;
}

export interface AdminSummary {
  /** Count of orgs in the pendientes list (already filtered by BFF). */
  pendingOrgCount: number;
  /** Sum of the per-role totals. */
  totalUserCount: number;
  activeUserCount: number;
}

/**
 * Pure helper — derives admin dashboard summary counts from already-fetched
 * data. No network calls here; every number comes from a `totalElements`.
 */
export function deriveAdminSummary(
  pendientes: PageData<OrganizacionAdmin>,
  usuarios: UsuarioCounts,
): AdminSummary {
  return {
    pendingOrgCount: pendientes.totalElements,
    totalUserCount: Object.values(usuarios.porRol).reduce((sum, n) => sum + n, 0),
    activeUserCount: usuarios.activos,
  };
}
