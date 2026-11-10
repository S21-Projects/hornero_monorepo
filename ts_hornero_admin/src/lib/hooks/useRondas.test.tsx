import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../axios';
import { useFondoRonda, useHistorialRondas, useEjecutarRonda } from './useRondas';

const mock = new MockAdapter(api, { onNoMatch: 'throwException' });

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mock.reset();
});

afterEach(() => {
  mock.reset();
});

/** Mirrors `RondaController` (AD-9, spec `ronda-asignacion`) via the BFF `rondas` proxy. */
describe('useFondoRonda', () => {
  it('GETs /rondas/fondo and exposes pool size', async () => {
    mock.onGet('/rondas/fondo').reply(200, { pendientes: 3, masAntiguaDesde: '2026-09-20' });

    const { result } = renderHook(() => useFondoRonda(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ pendientes: 3, masAntiguaDesde: '2026-09-20' });
  });
});

describe('useHistorialRondas', () => {
  it('GETs /rondas with paging params', async () => {
    const page = {
      content: [{ id: 9, estado: 'COMPLETADA', asignadas: 2, sinAsignar: 1 }],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };
    mock.onGet('/rondas').reply(200, page);

    const { result } = renderHook(() => useHistorialRondas({ page: 0, size: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(page);
    expect(mock.history.get[0].params).toEqual({ page: 0, size: 20 });
  });
});

describe('useEjecutarRonda', () => {
  it('POSTs /rondas and invalidates fondo + historial queries', async () => {
    mock.onPost('/rondas').reply(201, { id: 10, estado: 'COMPLETADA', asignadas: 1, sinAsignar: 0 });

    const { result } = renderHook(() => useEjecutarRonda(), { wrapper: createWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(10);
  });

  it('surfaces a 409 when a ronda is already in progress', async () => {
    mock.onPost('/rondas').reply(409, { message: 'RONDA_EN_CURSO' });

    const { result } = renderHook(() => useEjecutarRonda(), { wrapper: createWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { response?: { status?: number } }).response?.status).toBe(409);
  });

  it('surfaces a 503 when the worker is unavailable', async () => {
    mock.onPost('/rondas').reply(503, { message: 'WORKER_NO_DISPONIBLE' });

    const { result } = renderHook(() => useEjecutarRonda(), { wrapper: createWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { response?: { status?: number } }).response?.status).toBe(503);
  });
});
