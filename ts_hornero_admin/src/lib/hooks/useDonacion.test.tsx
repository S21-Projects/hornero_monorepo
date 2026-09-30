import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../axios';
import { useDonacion } from './useDonacion';
import type { Donacion } from '../../types/domain';

vi.mock('../axios', () => ({
  api: { get: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useDonacion', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('fetches a single donación by id via the public GET /donaciones/{id} route', async () => {
    const donacion: Donacion = {
      id: 1,
      estado: 'EN_CAMINO',
      necesidadId: 5,
      organizacionId: 7,
      organizacionNombre: 'Comedor Sol',
      donanteName: 'Ana Donante',
    };
    vi.mocked(api.get).mockResolvedValue({ data: donacion });

    const { result } = renderHook(() => useDonacion(1), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/donaciones/1');
    expect(result.current.data).toEqual(donacion);
  });

  it('does not fetch when id is undefined', () => {
    renderHook(() => useDonacion(undefined), { wrapper: Wrapper });

    expect(api.get).not.toHaveBeenCalled();
  });
});
