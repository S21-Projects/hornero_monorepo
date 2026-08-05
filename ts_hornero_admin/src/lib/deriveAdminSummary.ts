import type { PageData } from '../types/api';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

export interface AdminSummary {
  /** Count of orgs in the pendientes list (already filtered by BFF). */
  pendingOrgCount: number;
  totalUserCount: number;
  /** Active count computed over the fetched page only — see `activeUserCountIsPartial`. */
  activeUserCount: number;
  /**
   * True when `usuarios.totalElements > usuarios.content.length`, i.e.
   * `activeUserCount` only reflects the fetched page, not every user in the
   * DB. No MS `?activo=` filter exists yet (tracked as BACKLOG-01); callers
   * must render an honest caveat instead of a confidently wrong number.
   */
  activeUserCountIsPartial: boolean;
}

/**
 * Pure helper — derives admin dashboard summary counts from already-fetched
 * page data. No network calls here; `totalElements` comes free from the same
 * paginated response that feeds the charts.
 */
export function deriveAdminSummary(
  pendientes: PageData<OrganizacionAdmin>,
  usuarios: PageData<Usuario>,
): AdminSummary {
  return {
    pendingOrgCount: pendientes.totalElements,
    totalUserCount: usuarios.totalElements,
    activeUserCount: usuarios.content.filter((u) => u.activo).length,
    activeUserCountIsPartial: usuarios.totalElements > usuarios.content.length,
  };
}
