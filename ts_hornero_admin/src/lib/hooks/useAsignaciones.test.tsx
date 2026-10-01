import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../axios';
import { useAsignaciones } from './useAsignaciones';
import type { AsignacionHistorial } from '../../types/domain';

vi.mock('../axios', () => ({
  api: { get: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useAsignaciones', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('fetches the asignación history for a donación via GET :id/asignaciones', async () => {
    const historial: AsignacionHistorial[] = [
      {
        id: 1,
        rondaId: 9,
        rondaFecha: '2026-09-20',
        necesidadId: 40,
        organizacionId: 8,
        organizacionNombre: 'Comedor Sol',
        estado: 'ACEPTADA',
        score: 0.71,
        costoOportunidad: 0,
        distanciaKm: 2.1,
        terminoDeficit: 0.33,
        terminoUrgencia: 0.6,
        terminoProximidad: 0.77,
        terminoEspera: 0.16,
        terminoCumplimiento: null,
        deficitFuente: 'NEUTRAL',
        codigoRadio: '',
        creadaEn: '2026-09-20T12:00:00Z',
        resueltaEn: null,
      },
    ];
    vi.mocked(api.get).mockResolvedValue({ data: historial });

    const { result } = renderHook(() => useAsignaciones(17), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/donaciones/17/asignaciones');
    expect(result.current.data).toEqual(historial);
  });

  it('does not fetch when the donación id is undefined', () => {
    renderHook(() => useAsignaciones(undefined), { wrapper: Wrapper });

    expect(api.get).not.toHaveBeenCalled();
  });
});
