import { describe, it, expect } from 'vitest';
import { deriveAdminSummary } from '../deriveAdminSummary';
import { makePage } from '../../test/fixtures/page';
import type { OrganizacionAdmin } from '../../types/domain';

function makeOrg(estado: OrganizacionAdmin['estado'] = 'PENDIENTE'): OrganizacionAdmin {
  return {
    id: 1,
    nombre: 'Test Org',
    slug: 'test-org',
    tipo: 'COMEDOR',
    descripcion: 'Descripcion',
    direccion: 'Calle 123',
    estado,
    referenteNombre: 'Ref',
    referenteEmail: 'ref@test.com',
    aceptaDonaciones: false,
  };
}

const sinUsuarios = { porRol: { ADMINISTRADOR: 0, REFERENTE: 0, DONANTE: 0 }, activos: 0 };

describe('deriveAdminSummary', () => {
  it('returns zeros for empty input', () => {
    expect(deriveAdminSummary(makePage([]), sinUsuarios)).toEqual({
      pendingOrgCount: 0,
      totalUserCount: 0,
      activeUserCount: 0,
    });
  });

  it('counts pending orgs from totalElements, not content.length', () => {
    // `content` deliberately has fewer items than `totalElements` so this
    // assertion fails if the implementation regresses to reading `.length`.
    const pendientes = makePage([makeOrg(), makeOrg()], { totalElements: 137 });
    expect(deriveAdminSummary(pendientes, sinUsuarios).pendingOrgCount).toBe(137);
  });

  it('sums the per-role totals into the total user count, beyond any page size', () => {
    const result = deriveAdminSummary(makePage([]), {
      porRol: { ADMINISTRADOR: 3, REFERENTE: 120, DONANTE: 1500 },
      activos: 1400,
    });

    expect(result.totalUserCount).toBe(1623);
    expect(result.activeUserCount).toBe(1400);
  });

  it('combines orgs and users correctly', () => {
    const pendientes = makePage([makeOrg(), makeOrg(), makeOrg()], { totalElements: 3 });
    const result = deriveAdminSummary(pendientes, {
      porRol: { ADMINISTRADOR: 1, REFERENTE: 1, DONANTE: 0 },
      activos: 1,
    });

    expect(result).toEqual({ pendingOrgCount: 3, totalUserCount: 2, activeUserCount: 1 });
  });
});
