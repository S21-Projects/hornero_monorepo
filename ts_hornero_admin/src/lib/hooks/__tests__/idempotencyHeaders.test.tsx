import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../../axios';
import { useCrearDonacion } from '../useCrearDonacion';
import { useCrearOrganizacion } from '../useCrearOrganizacion';
import { useCrearNecesidad } from '../useCrearNecesidad';
import { useCrearArticulo } from '../useArticulos';
import { useRelanzarNecesidad } from '../useRelanzarNecesidad';
import { useEjecutarRonda } from '../useRondas';
import { useGenerarCodigo, useVerificarCodigo } from '../useEntrega';
import { useCargarEvidencia } from '../useAcreditacion';

const mock = new MockAdapter(api, { onNoMatch: 'throwException' });

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const keyOf = (i: number) => mock.history.post[i].headers?.['Idempotency-Key'] as string | undefined;

beforeEach(() => mock.reset());

/** N11: every business POST carries an Idempotency-Key; the retry of a failed one reuses it. */
describe('Idempotency-Key on business POST hooks', () => {
  it('useEjecutarRonda sends a key, reuses it on retry after a 503 and renews after success', async () => {
    mock.onPost('/rondas').replyOnce(503).onPost('/rondas').reply(201, { id: 1 });
    const { result } = renderHook(() => useEjecutarRonda(), { wrapper: wrapper() });

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(keyOf(0)).toMatch(/^[0-9a-f-]{36}$/);
    expect(keyOf(1)).toBe(keyOf(0));
    expect(keyOf(2)).not.toBe(keyOf(1));
  });

  it('useCrearDonacion sends a key', async () => {
    mock.onPost('/donaciones').reply(201, { id: 5 });
    const { result } = renderHook(() => useCrearDonacion(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({} as never);
    });
    expect(keyOf(0)).toBeTruthy();
  });

  it('useCrearOrganizacion sends a key', async () => {
    mock.onPost('/organizaciones').reply(201, { id: 5 });
    const { result } = renderHook(() => useCrearOrganizacion(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({} as never);
    });
    expect(keyOf(0)).toBeTruthy();
  });

  it('useCrearNecesidad sends a key', async () => {
    mock.onPost('/necesidades').reply(201, { id: 5 });
    const { result } = renderHook(() => useCrearNecesidad(3), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({} as never);
    });
    expect(keyOf(0)).toBeTruthy();
  });

  it('useCrearArticulo sends a key', async () => {
    mock.onPost('/articulos').reply(201, { id: 5 });
    const { result } = renderHook(() => useCrearArticulo(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({} as never);
    });
    expect(keyOf(0)).toBeTruthy();
  });

  it('useRelanzarNecesidad sends a key and uses another one for another necesidad', async () => {
    mock.onPost(/\/necesidades\/\d+\/relanzar/).reply(500);
    const { result } = renderHook(() => useRelanzarNecesidad(3), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 1 } as never).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ id: 2 } as never).catch(() => undefined);
    });
    expect(keyOf(0)).toBeTruthy();
    expect(keyOf(1)).not.toBe(keyOf(0));
  });

  it('useGenerarCodigo and useVerificarCodigo send keys', async () => {
    mock.onPost('/donaciones/9/entrega/codigo').reply(201, {});
    mock.onPost('/donaciones/9/entrega/verificar').reply(200, {});
    const gen = renderHook(() => useGenerarCodigo(9), { wrapper: wrapper() });
    const ver = renderHook(() => useVerificarCodigo(9), { wrapper: wrapper() });
    await act(async () => {
      await gen.result.current.mutateAsync();
      await ver.result.current.mutateAsync('123456');
    });
    expect(keyOf(0)).toBeTruthy();
    expect(keyOf(1)).toBeTruthy();
    expect(keyOf(1)).not.toBe(keyOf(0));
  });

  it('useCargarEvidencia sends a key', async () => {
    mock.onPost('/organizaciones/4/acreditacion/evidencias').reply(201, {});
    const { result } = renderHook(() => useCargarEvidencia(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ organizacionId: 4, input: {} } as never);
    });
    expect(keyOf(0)).toBeTruthy();
  });
});

describe('axios fallback interceptor', () => {
  it('adds a fresh key to a POST that did not set one, but never to /auth or uploads', async () => {
    mock.onPost('/anything').reply(200, {});
    mock.onPost('/auth/login').reply(200, {});
    mock.onPost('/upload/org-banner/1').reply(200, {});
    await api.post('/anything', {});
    await api.post('/auth/login', {});
    await api.post('/upload/org-banner/1', {});
    expect(keyOf(0)).toBeTruthy();
    expect(keyOf(1)).toBeUndefined();
    expect(keyOf(2)).toBeUndefined();
  });

  it('keeps an explicit key and does not add one to GETs', async () => {
    mock.onPost('/anything').reply(200, {});
    mock.onGet('/anything').reply(200, {});
    await api.post('/anything', {}, { headers: { 'Idempotency-Key': 'fixed-key' } });
    await api.get('/anything');
    expect(keyOf(0)).toBe('fixed-key');
    expect(mock.history.get[0].headers?.['Idempotency-Key']).toBeUndefined();
  });
});
