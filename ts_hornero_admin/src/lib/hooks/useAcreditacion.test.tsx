import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../axios';
import {
  useAcreditacion,
  useCargarEvidencia,
  useAuditarEvidencia,
  useCambiarNivel,
  useLegajo,
  useEvidenciasPendientes,
} from './useAcreditacion';

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

describe('useAcreditacion', () => {
  it('GETs /organizaciones/{id}/acreditacion and exposes loading/success states', async () => {
    mock.onGet('/organizaciones/5/acreditacion').reply(200, {
      organizacionId: 5,
      nivel: 'N1',
      nivelDesde: '2026-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useAcreditacion(5), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.nivel).toBe('N1');
  });

  it('surfaces an error state on failure', async () => {
    mock.onGet('/organizaciones/9/acreditacion').reply(500);

    const { result } = renderHook(() => useAcreditacion(9), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useLegajo', () => {
  it('GETs /organizaciones/{id}/legajo', async () => {
    mock.onGet('/organizaciones/5/legajo').reply(200, {
      organizacionId: 5,
      nombre: 'Comedor Los Hornitos',
      slug: 'comedor-los-hornitos',
      direccion: 'Av. Colón 1234',
      nivel: 'N1',
      nivelDesde: '2026-01-01T00:00:00Z',
      requisitos: [],
      eventos: [],
      disclosure: 'Datos declarados y auditados, no verificados por el sistema.',
    });

    const { result } = renderHook(() => useLegajo(5), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.disclosure).toContain('declarados');
  });
});

describe('useCargarEvidencia', () => {
  it('POSTs /organizaciones/{id}/acreditacion/evidencias', async () => {
    mock.onPost('/organizaciones/5/acreditacion/evidencias').reply(201, {
      id: 1,
      organizacionId: 5,
      requisito: 'NO_DISCRIMINACION',
      tipoEvidencia: 'DECLARACION',
      estado: 'PENDIENTE',
      expirada: false,
    });

    const { result } = renderHook(() => useCargarEvidencia(), { wrapper: createWrapper() });

    result.current.mutate({
      organizacionId: 5,
      input: { requisito: 'NO_DISCRIMINACION', tipoEvidencia: 'DECLARACION', declaracion: 'Cumplimos' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mock.history.post[0].url).toBe('/organizaciones/5/acreditacion/evidencias');
    expect(JSON.parse(mock.history.post[0].data as string)).toMatchObject({
      requisito: 'NO_DISCRIMINACION',
      tipoEvidencia: 'DECLARACION',
    });
  });
});

describe('useAuditarEvidencia', () => {
  it('PATCHes .../aprobar with no body when accion is aprobar', async () => {
    mock.onPatch('/organizaciones/5/acreditacion/evidencias/1/aprobar').reply(200, {
      id: 1,
      organizacionId: 5,
      requisito: 'NO_DISCRIMINACION',
      tipoEvidencia: 'DECLARACION',
      estado: 'APROBADA',
      expirada: false,
    });

    const { result } = renderHook(() => useAuditarEvidencia(), { wrapper: createWrapper() });
    result.current.mutate({ organizacionId: 5, evidenciaId: 1, accion: 'aprobar' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.estado).toBe('APROBADA');
  });

  it('PATCHes .../observar with the observacion when accion is observar', async () => {
    mock.onPatch('/organizaciones/5/acreditacion/evidencias/1/observar').reply(200, {
      id: 1,
      organizacionId: 5,
      requisito: 'NO_DISCRIMINACION',
      tipoEvidencia: 'DECLARACION',
      estado: 'OBSERVADA',
      expirada: false,
      observacion: 'Falta detalle',
    });

    const { result } = renderHook(() => useAuditarEvidencia(), { wrapper: createWrapper() });
    result.current.mutate({
      organizacionId: 5,
      evidenciaId: 1,
      accion: 'observar',
      observacion: 'Falta detalle',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(mock.history.patch[0].data as string)).toEqual({ observacion: 'Falta detalle' });
  });
});

describe('useEvidenciasPendientes', () => {
  it('GETs /organizaciones/{id}/acreditacion/evidencias?estado=PENDIENTE', async () => {
    mock.onGet('/organizaciones/5/acreditacion/evidencias?estado=PENDIENTE').reply(200, [
      {
        id: 1,
        organizacionId: 5,
        requisito: 'NO_DISCRIMINACION',
        tipoEvidencia: 'DECLARACION',
        estado: 'PENDIENTE',
        expirada: false,
      },
    ]);

    const { result } = renderHook(() => useEvidenciasPendientes(5), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({ id: 1, requisito: 'NO_DISCRIMINACION' });
  });

  it('is disabled when organizacionId is undefined', () => {
    const { result } = renderHook(() => useEvidenciasPendientes(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCambiarNivel', () => {
  it('PATCHes /organizaciones/{id}/acreditacion/nivel with destino and motivo', async () => {
    mock.onPatch('/organizaciones/5/acreditacion/nivel').reply(200, {
      organizacionId: 5,
      nivel: 'N2',
      nivelDesde: '2026-09-21T00:00:00Z',
    });

    const { result } = renderHook(() => useCambiarNivel(), { wrapper: createWrapper() });
    result.current.mutate({ organizacionId: 5, destino: 'N2', motivo: 'Cumple requisitos N2' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(mock.history.patch[0].data as string)).toEqual({
      destino: 'N2',
      motivo: 'Cumple requisitos N2',
    });
  });
});
