import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../../axios';
import { useCrearOrganizacion } from '../useCrearOrganizacion';
import type { CrearOrganizacionInput } from '../../../types/domain';

vi.mock('../../axios', () => ({
  api: { post: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const input: CrearOrganizacionInput = {
  nombre: 'Comedor Sol',
  tipo: 'COMEDOR',
  direccion: 'Av. Colón 1234',
  latitud: -31.42,
  longitud: -64.18,
};

describe('useCrearOrganizacion', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('POSTs to /organizaciones and resolves the created org', async () => {
    const created = { id: 1, slug: 'comedor-sol', nombre: 'Comedor Sol', validada: false, estado: 'PENDIENTE' };
    vi.mocked(api.post).mockResolvedValue({ data: created });

    const { result } = renderHook(() => useCrearOrganizacion(), { wrapper: createWrapper() });
    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.post).toHaveBeenCalledWith('/organizaciones', input, {
      headers: { 'Idempotency-Key': expect.any(String) },
    });
    expect(result.current.data).toEqual(created);
  });

  it('surfaces the error when the cap (409) is hit', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409 } });

    const { result } = renderHook(() => useCrearOrganizacion(), { wrapper: createWrapper() });
    result.current.mutate(input);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
