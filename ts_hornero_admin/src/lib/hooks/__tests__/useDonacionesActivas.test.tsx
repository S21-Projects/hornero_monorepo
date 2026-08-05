import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../../axios';
import { useDonacionesActivas } from '../useDonacionesActivas';

vi.mock('../../axios', () => ({
  api: { get: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDonacionesActivas', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('returns the already-unwrapped PageData as-is (no .data.data double-unwrap)', async () => {
    // The global axios interceptor already strips the ApiResponse envelope,
    // so `api.get(...).then((r) => r.data)` must yield this shape directly —
    // never `{ data: { content, ... } }` nested one level deeper.
    const page = {
      content: [{ id: 1, estado: 'OFRECIDA', necesidadId: 5 }],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };
    vi.mocked(api.get).mockResolvedValue({ data: page });

    const { result } = renderHook(() => useDonacionesActivas({ page: 0, size: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/donaciones/activas', { params: { page: 0, size: 20 } });
    expect(result.current.data).toEqual(page);
    expect(result.current.data).not.toHaveProperty('data');
  });

  it('forwards q and estado as query params', async () => {
    const page = { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 };
    vi.mocked(api.get).mockResolvedValue({ data: page });

    const { result } = renderHook(
      () => useDonacionesActivas({ page: 0, size: 20, q: 'banana', estado: 'ACEPTADA' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/donaciones/activas', {
      params: { page: 0, size: 20, q: 'banana', estado: 'ACEPTADA' },
    });
  });

  it('surfaces the error when the request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDonacionesActivas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
