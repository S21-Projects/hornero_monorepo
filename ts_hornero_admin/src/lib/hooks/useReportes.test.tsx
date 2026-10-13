import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../axios';
import {
  useCrearReporte,
  useDescartarReporte,
  useMarcarInactiva,
  useOrganizacionesCercanas,
  useReporte,
  useReportesPendientes,
} from './useReportes';

vi.mock('../axios', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

describe('report hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockReset().mockResolvedValue({ data: { id: 1 } });
    vi.mocked(api.patch).mockReset().mockResolvedValue({ data: { id: 1 } });
  });

  it('queries nearby organizaciones only when enabled and with an id', async () => {
    const { wrapper } = setup();
    renderHook(() => useOrganizacionesCercanas(4, false), { wrapper });
    renderHook(() => useOrganizacionesCercanas(undefined, true), { wrapper });
    expect(api.get).not.toHaveBeenCalled();

    renderHook(() => useOrganizacionesCercanas(4, true), { wrapper });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(api.get).toHaveBeenCalledWith('/reportes/cercanas', { params: { organizacionId: 4 } });
  });

  it('reads the pending page and a detail from the BFF', async () => {
    const { wrapper } = setup();
    renderHook(() => useReportesPendientes({ page: 1, size: 20 }), { wrapper });
    renderHook(() => useReporte(9), { wrapper });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(api.get).toHaveBeenCalledWith('/reportes/pendientes', { params: { page: 1, size: 20 } });
    expect(api.get).toHaveBeenCalledWith('/reportes/9');
  });

  it('creates a report with an Idempotency-Key and refreshes the report queries', async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCrearReporte(), { wrapper });
    const input = { organizacionId: 4, motivo: 'INACTIVO' as const };

    await act(async () => { await result.current.mutateAsync(input); });

    const [url, body, config] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/reportes');
    expect(body).toEqual(input);
    expect((config as { headers: Record<string, string> }).headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reportes'] });
  });

  it('marks inactive and discards through PATCH, refreshing reports and organizaciones', async () => {
    const { wrapper, invalidate } = setup();
    const marcar = renderHook(() => useMarcarInactiva(), { wrapper });
    const descartar = renderHook(() => useDescartarReporte(), { wrapper });

    await act(async () => { await marcar.result.current.mutateAsync({ id: 5 }); });
    await act(async () => { await descartar.result.current.mutateAsync({ id: 6, nota: 'Sigue abierto' }); });

    expect(api.patch).toHaveBeenCalledWith('/reportes/5/marcar-inactiva', {});
    expect(api.patch).toHaveBeenCalledWith('/reportes/6/descartar', { nota: 'Sigue abierto' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reportes'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['organizaciones'] });
  });
});
