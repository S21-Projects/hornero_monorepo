import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../axios';
import {
  useAprobarReclamo,
  useCrearReclamo,
  useMisReclamos,
  useOrganizacionPorSlug,
  useRechazarReclamo,
  useReclamo,
  useReclamosPendientes,
} from './useReclamos';

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

describe('claim hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockReset().mockResolvedValue({ data: { id: 1 } });
    vi.mocked(api.patch).mockReset().mockResolvedValue({ data: { id: 1 } });
  });

  it('looks the organizacion up by slug, and does not fetch without one', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrganizacionPorSlug('comedor-x-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/organizaciones/comedor-x-1');

    vi.mocked(api.get).mockClear();
    renderHook(() => useOrganizacionPorSlug(undefined), { wrapper });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('reads own claims, the pending page and a detail from the BFF', async () => {
    const { wrapper } = setup();
    renderHook(() => useMisReclamos(), { wrapper });
    renderHook(() => useReclamosPendientes({ page: 1, size: 20 }), { wrapper });
    renderHook(() => useReclamo(9), { wrapper });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
    expect(api.get).toHaveBeenCalledWith('/reclamos/mios');
    expect(api.get).toHaveBeenCalledWith('/reclamos/pendientes', { params: { page: 1, size: 20 } });
    expect(api.get).toHaveBeenCalledWith('/reclamos/9');
  });

  it('creates a claim with an Idempotency-Key and refreshes the claim queries', async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCrearReclamo(), { wrapper });
    const input = {
      organizacionId: 4,
      rol: 'RESPONSABLE' as const,
      telefono: '351 555 1234',
      evidenciaKeys: ['reclamo-evidencia/4/7/1.jpg'],
    };

    await act(async () => { await result.current.mutateAsync(input); });

    const [url, body, config] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/reclamos');
    expect(body).toEqual(input);
    expect((config as { headers: Record<string, string> }).headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reclamos'] });
  });

  it('reuses the key when the same submission is retried', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: undefined }); // network error: keep the key
    const { wrapper } = setup();
    const { result } = renderHook(() => useCrearReclamo(), { wrapper });
    const input = { organizacionId: 4, rol: 'VOLUNTARIO' as const, telefono: '351 555 1234', evidenciaKeys: ['k'] };

    await act(async () => { await result.current.mutateAsync(input).catch(() => undefined); });
    await act(async () => { await result.current.mutateAsync(input); });

    const keys = vi.mocked(api.post).mock.calls.map(
      (c) => (c[2] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it('approves and rejects through PATCH, refreshing claims and organizaciones', async () => {
    const { wrapper, invalidate } = setup();
    const aprobar = renderHook(() => useAprobarReclamo(), { wrapper });
    const rechazar = renderHook(() => useRechazarReclamo(), { wrapper });

    await act(async () => { await aprobar.result.current.mutateAsync({ id: 5 }); });
    await act(async () => { await rechazar.result.current.mutateAsync({ id: 6, motivo: 'No verificable' }); });

    expect(api.patch).toHaveBeenCalledWith('/reclamos/5/aprobar', {});
    expect(api.patch).toHaveBeenCalledWith('/reclamos/6/rechazar', { motivo: 'No verificable' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reclamos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['organizaciones'] });
  });
});
