import { describe, it, expect } from 'vitest';
import { deriveAdminSummary } from '../deriveAdminSummary';
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
    const result = deriveAdminSummary([], []);
    expect(result).toEqual({ pendingOrgCount: 0, totalUserCount: 0, activeUserCount: 0 });
  });

  it('counts all orgs as pending (already filtered by BFF)', () => {
    const result = deriveAdminSummary([makeOrg(), makeOrg()], []);
    expect(result.pendingOrgCount).toBe(2);
  });

  it('counts total and active users correctly with mixed activo values', () => {
    const users = [makeUser(true, 1), makeUser(false, 2), makeUser(true, 3)];
    const result = deriveAdminSummary([], users);
    expect(result.totalUserCount).toBe(3);
    expect(result.activeUserCount).toBe(2);
  });

  it('handles all users inactive', () => {
    const users = [makeUser(false, 1), makeUser(false, 2)];
    const result = deriveAdminSummary([], users);
    expect(result.activeUserCount).toBe(0);
    expect(result.totalUserCount).toBe(2);
  });

  it('handles all users active', () => {
    const users = [makeUser(true, 1), makeUser(true, 2)];
    const result = deriveAdminSummary([], users);
    expect(result.activeUserCount).toBe(2);
  });

  it('combines orgs and users correctly', () => {
    const orgs = [makeOrg(), makeOrg(), makeOrg()];
    const users = [makeUser(true, 1), makeUser(false, 2)];
    const result = deriveAdminSummary(orgs, users);
    expect(result).toEqual({ pendingOrgCount: 3, totalUserCount: 2, activeUserCount: 1 });
  });
});
