import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthInitializer } from './AuthInitializer';
import { useAuthStore } from '../store/auth.store';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import type { Organizacion } from '../types/domain';

vi.mock('../lib/hooks/useMisOrganizaciones', () => ({
  useMisOrganizaciones: vi.fn(),
}));

function mockOrgs(data: Organizacion[] | undefined, overrides = {}) {
  vi.mocked(useMisOrganizaciones).mockReturnValue({
    data,
    isSuccess: data !== undefined,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useMisOrganizaciones>);
}

const pendiente: Organizacion = {
  id: 1, slug: 'org-1', nombre: 'Org 1', validada: false, estado: 'PENDIENTE', aceptaDonaciones: false,
};
const aprobada: Organizacion = {
  id: 2, slug: 'org-2', nombre: 'Org 2', validada: true, estado: 'APROBADA', aceptaDonaciones: false,
};

describe('AuthInitializer — org validation aggregation off the /mia array', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { userId: 1, email: 'r@test.com', nombre: 'Ref', tipo: 'REFERENTE' },
      status: 'authenticated',
      orgValidada: false,
      orgChecked: false,
      orgCount: 0,
    });
    vi.spyOn(useAuthStore.getState(), 'hydrate').mockImplementation(() => {});
    vi.spyOn(useAuthStore.getState(), 'loadUser').mockResolvedValue();
  });

  it('sets orgValidada=false, orgCount=0, orgChecked=true for an empty list ([])', async () => {
    mockOrgs([]);

    render(<AuthInitializer><div>child</div></AuthInitializer>);

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.orgChecked).toBe(true);
      expect(state.orgValidada).toBe(false);
      expect(state.orgCount).toBe(0);
    });
  });

  it('sets orgValidada=false, orgCount=1 when the only owned org is PENDIENTE', async () => {
    mockOrgs([pendiente]);

    render(<AuthInitializer><div>child</div></AuthInitializer>);

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.orgChecked).toBe(true);
      expect(state.orgValidada).toBe(false);
      expect(state.orgCount).toBe(1);
    });
  });

  it('sets orgValidada=true when at least one owned org is APROBADA', async () => {
    mockOrgs([pendiente, aprobada]);

    render(<AuthInitializer><div>child</div></AuthInitializer>);

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.orgChecked).toBe(true);
      expect(state.orgValidada).toBe(true);
      expect(state.orgCount).toBe(2);
    });
  });

  it('sets orgValidada=false, orgCount=0, orgChecked=true on query error', async () => {
    mockOrgs(undefined, { isSuccess: false, isError: true });

    render(<AuthInitializer><div>child</div></AuthInitializer>);

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.orgChecked).toBe(true);
      expect(state.orgValidada).toBe(false);
      expect(state.orgCount).toBe(0);
    });
  });
});
