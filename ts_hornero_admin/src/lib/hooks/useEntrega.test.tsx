import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../axios';
import { useEstadoEntrega, useGenerarCodigo, useVerificarCodigo } from './useEntrega';

const mock = new MockAdapter(api, { onNoMatch: 'throwException' });

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mock.reset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  mock.reset();
  vi.useRealTimers();
});

/**
 * Mirrors `EntregaController` (`jar_hornero_ms/.../donacion/entrega/EntregaController.java`,
 * committed in 9822f59) via the 3b BFF proxy (`ts_hornero_bff/src/donaciones/donaciones.controller.ts`).
 */
describe('useEstadoEntrega', () => {
  it('GETs /donaciones/{id}/entrega and exposes the status', async () => {
    mock.onGet('/donaciones/7/entrega').reply(200, {
      estado: 'EN_CAMINO',
      confirmadaDonanteEn: null,
      confirmadaReferenteEn: null,
    });

    const { result } = renderHook(() => useEstadoEntrega(7), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.estado).toBe('EN_CAMINO');
  });

  it('is disabled when donacionId is undefined', () => {
    const { result } = renderHook(() => useEstadoEntrega(undefined), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('polls every 3 seconds while not ENTREGADA', async () => {
    mock.onGet('/donaciones/7/entrega').reply(200, {
      estado: 'PENDIENTE_CONFIRMACION',
      confirmadaDonanteEn: '2026-09-30T12:00:00Z',
      confirmadaReferenteEn: null,
    });

    renderHook(() => useEstadoEntrega(7), { wrapper: createWrapper() });

    await waitFor(() => expect(mock.history.get.length).toBe(1));
    await vi.advanceTimersByTimeAsync(3000);
    await waitFor(() => expect(mock.history.get.length).toBe(2));
  });

  it('stops polling once the status is ENTREGADA', async () => {
    mock.onGet('/donaciones/7/entrega').reply(200, {
      estado: 'ENTREGADA',
      confirmadaDonanteEn: '2026-09-30T12:00:00Z',
      confirmadaReferenteEn: '2026-09-30T12:00:05Z',
    });

    renderHook(() => useEstadoEntrega(7), { wrapper: createWrapper() });

    await waitFor(() => expect(mock.history.get.length).toBe(1));
    await vi.advanceTimersByTimeAsync(10000);
    expect(mock.history.get.length).toBe(1);
  });
});

describe('useGenerarCodigo', () => {
  it('POSTs /donaciones/{id}/entrega/codigo and invalidates the estado query', async () => {
    mock.onPost('/donaciones/7/entrega/codigo').reply(201, {
      codigo: '482913',
      expiraEn: '2026-09-30T12:10:00Z',
    });

    const { result } = renderHook(() => useGenerarCodigo(7), { wrapper: createWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.codigo).toBe('482913');
  });
});

describe('useVerificarCodigo', () => {
  it('POSTs /donaciones/{id}/entrega/verificar with the code', async () => {
    mock.onPost('/donaciones/7/entrega/verificar').reply(200, {
      estado: 'ENTREGADA',
      confirmadaDonanteEn: '2026-09-30T12:00:00Z',
      confirmadaReferenteEn: '2026-09-30T12:00:05Z',
    });

    const { result } = renderHook(() => useVerificarCodigo(7), { wrapper: createWrapper() });
    result.current.mutate('482913');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(mock.history.post[0].data as string)).toEqual({ codigo: '482913' });
    expect(result.current.data?.estado).toBe('ENTREGADA');
  });
});
