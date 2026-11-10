import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../../axios';
import { useAdminInfoPublica } from '../useAdminInfoPublica';

vi.mock('../../axios', () => ({
  api: { patch: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAdminInfoPublica', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
  });

  it('actualizar PATCHes /organizaciones/{id}/info-publica', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 5 } });

    const { result } = renderHook(() => useAdminInfoPublica(), { wrapper: createWrapper() });
    result.current.actualizar.mutate({ organizacionId: 5, input: { aceptaDonaciones: true } });

    await waitFor(() => expect(result.current.actualizar.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/organizaciones/5/info-publica', { aceptaDonaciones: true });
  });

  it('aprobar PATCHes /organizaciones/{id}/info-publica/aprobar', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 5 } });

    const { result } = renderHook(() => useAdminInfoPublica(), { wrapper: createWrapper() });
    result.current.aprobar.mutate(5);

    await waitFor(() => expect(result.current.aprobar.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/organizaciones/5/info-publica/aprobar', {});
  });

  it('rechazar PATCHes /organizaciones/{id}/info-publica/rechazar', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 5 } });

    const { result } = renderHook(() => useAdminInfoPublica(), { wrapper: createWrapper() });
    result.current.rechazar.mutate(5);

    await waitFor(() => expect(result.current.rechazar.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/organizaciones/5/info-publica/rechazar', {});
  });

  it('aprobar surfaces a 409 when nothing is pending', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 409 } });

    const { result } = renderHook(() => useAdminInfoPublica(), { wrapper: createWrapper() });
    result.current.aprobar.mutate(5);

    await waitFor(() => expect(result.current.aprobar.isError).toBe(true));
  });
});
