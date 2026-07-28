import type { OrganizacionAdmin, Usuario } from '../types/domain';

export interface AdminSummary {
  /** Count of orgs in the pendientes list (already filtered by BFF). */
  pendingOrgCount: number;
  totalUserCount: number;
  activeUserCount: number;
}

/**
 * Pure helper — derives admin dashboard summary counts from already-fetched data.
 * Both arrays come from their respective query hooks; no network calls here.
 */
export function deriveAdminSummary(
  orgs: OrganizacionAdmin[],
  users: Usuario[],
): AdminSummary {
  return {
    pendingOrgCount: orgs.length,
    totalUserCount: users.length,
    activeUserCount: users.filter((u) => u.activo).length,
  };
}
