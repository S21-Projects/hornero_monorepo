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
