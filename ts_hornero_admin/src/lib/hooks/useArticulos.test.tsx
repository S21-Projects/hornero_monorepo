import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../axios';
import {
  useArticulos,
  useCrearArticulo,
  useEditarArticulo,
  useDesactivarArticulo,
} from './useArticulos';

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

const ARROZ = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };

describe('useArticulos', () => {
  it('GETs /articulos with no query string by default (active only)', async () => {
    mock.onGet('/articulos').reply(200, [ARROZ]);

    const { result } = renderHook(() => useArticulos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([ARROZ]);
    expect(mock.history.get[0].params).toBeUndefined();
  });

  it('forwards incluirInactivos=true when requested', async () => {
    const inactivo = { ...ARROZ, id: 2, activo: false };
    mock.onGet('/articulos').reply(200, [ARROZ, inactivo]);

    const { result } = renderHook(() => useArticulos(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([ARROZ, inactivo]);
    expect(mock.history.get[0].params).toEqual({ incluirInactivos: true });
  });
});

describe('useCrearArticulo', () => {
  it('POSTs /articulos and invalidates the list', async () => {
    mock.onPost('/articulos').reply(201, ARROZ);

    const { result } = renderHook(() => useCrearArticulo(), { wrapper: createWrapper() });
    result.current.mutate({ nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(ARROZ);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      nombre: 'Arroz',
      categoria: 'NO_PERECEDERO',
      unidad: 'KG',
    });
  });
});

describe('useEditarArticulo', () => {
  it('PUTs /articulos/:id with the full edit payload', async () => {
    const editado = { ...ARROZ, nombre: 'Arroz Integral' };
    mock.onPut('/articulos/1').reply(200, editado);

    const { result } = renderHook(() => useEditarArticulo(), { wrapper: createWrapper() });
    result.current.mutate({
      id: 1,
      input: { nombre: 'Arroz Integral', categoria: 'NO_PERECEDERO', unidad: 'KG' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(editado);
  });
});

describe('useDesactivarArticulo', () => {
  it('PATCHes /articulos/:id/desactivar and invalidates the list', async () => {
    const desactivado = { ...ARROZ, activo: false };
    mock.onPatch('/articulos/1/desactivar').reply(200, desactivado);

    const { result } = renderHook(() => useDesactivarArticulo(), { wrapper: createWrapper() });
    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(desactivado);
  });
});
