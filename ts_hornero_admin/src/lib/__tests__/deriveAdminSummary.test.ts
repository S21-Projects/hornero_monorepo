import { describe, it, expect } from 'vitest';
import { deriveAdminSummary } from '../deriveAdminSummary';
import { makePage } from '../../test/fixtures/page';
import type { OrganizacionAdmin, Usuario } from '../../types/domain';

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

function makeUser(activo: boolean, id = 1): Usuario {
  return { id, nombre: 'User', email: 'u@test.com', tipo: 'DONANTE', activo };
}

describe('deriveAdminSummary', () => {
  it('returns zeros for empty input', () => {
    const result = deriveAdminSummary(makePage([]), makePage([]));
    expect(result).toEqual({
      pendingOrgCount: 0,
      totalUserCount: 0,
      activeUserCount: 0,
      activeUserCountIsPartial: false,
    });
  });

  it('counts pending orgs from totalElements, not content.length', () => {
    // `content` deliberately has fewer items than `totalElements` so this
    // assertion fails if the implementation regresses to reading `.length`.
    const pendientes = makePage([makeOrg(), makeOrg()], { totalElements: 137 });
    const result = deriveAdminSummary(pendientes, makePage([]));
    expect(result.pendingOrgCount).toBe(137);
  });

  it('counts total users from totalElements, not content.length', () => {
    // `content` deliberately has fewer items than `totalElements` so this
    // assertion fails if the implementation regresses to reading `.length`.
    const users = [makeUser(true, 1), makeUser(false, 2), makeUser(true, 3)];
    const usuarios = makePage(users, { totalElements: 250 });
    const result = deriveAdminSummary(makePage([]), usuarios);
    expect(result.totalUserCount).toBe(250);
    expect(result.activeUserCount).toBe(2);
  });

  it('handles all users inactive', () => {
    const usuarios = makePage([makeUser(false, 1), makeUser(false, 2)]);
    const result = deriveAdminSummary(makePage([]), usuarios);
    expect(result.activeUserCount).toBe(0);
    expect(result.totalUserCount).toBe(2);
  });

  it('handles all users active', () => {
    const usuarios = makePage([makeUser(true, 1), makeUser(true, 2)]);
    const result = deriveAdminSummary(makePage([]), usuarios);
    expect(result.activeUserCount).toBe(2);
  });

  it('combines orgs and users correctly', () => {
    const pendientes = makePage([makeOrg(), makeOrg(), makeOrg()], { totalElements: 3 });
    const usuarios = makePage([makeUser(true, 1), makeUser(false, 2)], { totalElements: 2 });
    const result = deriveAdminSummary(pendientes, usuarios);
    expect(result).toEqual({
      pendingOrgCount: 3,
      totalUserCount: 2,
      activeUserCount: 1,
      activeUserCountIsPartial: false,
    });
  });

  it('sets activeUserCountIsPartial=true when totalElements exceeds the fetched page', () => {
    const usuarios = makePage([makeUser(true, 1), makeUser(false, 2)], { totalElements: 150 });
    const result = deriveAdminSummary(makePage([]), usuarios);
    expect(result.activeUserCountIsPartial).toBe(true);
  });

  it('sets activeUserCountIsPartial=false when the fetched page already covers every user', () => {
    const usuarios = makePage([makeUser(true, 1), makeUser(false, 2)], { totalElements: 2 });
    const result = deriveAdminSummary(makePage([]), usuarios);
    expect(result.activeUserCountIsPartial).toBe(false);
  });
});
