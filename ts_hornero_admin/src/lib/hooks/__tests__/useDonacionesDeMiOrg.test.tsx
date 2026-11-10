import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../../axios';
import { useDonacionesDeMiOrg } from '../useDonacionesDeMiOrg';

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

describe('useDonacionesDeMiOrg', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('calls the BFF donaciones/mi-organizacion route without an /api prefix', async () => {
    const donaciones = {
      content: [{ id: 1, organizacionId: 10, estado: 'OFRECIDA' }],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };
    vi.mocked(api.get).mockResolvedValue({ data: donaciones });

    const { result } = renderHook(() => useDonacionesDeMiOrg(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/donaciones/mi-organizacion', { params: {} });
    expect(result.current.data).toEqual(donaciones);
  });

  it('sends the requested page and size', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { content: [], number: 2, size: 20, totalElements: 41, totalPages: 3 },
    });

    const { result } = renderHook(() => useDonacionesDeMiOrg({ page: 2, size: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/donaciones/mi-organizacion', {
      params: { page: 2, size: 20 },
    });
  });

  it('sends the estado filter comma-joined and keeps it in the query key', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 },
    });
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useDonacionesDeMiOrg({ page: 0, size: 100, estado: ['OFRECIDA', 'EN_CAMINO'] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    renderHook(() => useDonacionesDeMiOrg({ page: 0, size: 100, estado: ['OFRECIDA'] }), {
      wrapper,
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));

    expect(api.get).toHaveBeenNthCalledWith(1, '/donaciones/mi-organizacion', {
      params: { page: 0, size: 100, estado: 'OFRECIDA,EN_CAMINO' },
    });
    // Different filter => different cache entry => a second request, not a cache hit.
    expect(api.get).toHaveBeenNthCalledWith(2, '/donaciones/mi-organizacion', {
      params: { page: 0, size: 100, estado: 'OFRECIDA' },
    });
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useDonacionesDeMiOrg({ enabled: false }), { wrapper: createWrapper() });

    expect(api.get).not.toHaveBeenCalled();
  });

  it('surfaces the error when the request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDonacionesDeMiOrg(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
