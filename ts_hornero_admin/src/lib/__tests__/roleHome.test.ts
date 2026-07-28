import { describe, it, expect } from 'vitest';
import { roleHome } from '../roleHome';
import type { UserRole } from '../../store/auth.store';

describe('roleHome', () => {
  it('maps ADMINISTRADOR to /admin', () => {
    expect(roleHome('ADMINISTRADOR')).toBe('/admin');
  });

  it('maps REFERENTE to /dashboard', () => {
    expect(roleHome('REFERENTE')).toBe('/dashboard');
  });

  it('maps DONANTE to /explorar', () => {
    expect(roleHome('DONANTE')).toBe('/explorar');
  });

  it('falls back to /login for an unknown/undefined role', () => {
    expect(roleHome(undefined as unknown as UserRole)).toBe('/login');
  });
});
