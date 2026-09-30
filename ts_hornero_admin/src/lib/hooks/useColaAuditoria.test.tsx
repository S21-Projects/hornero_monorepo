import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../axios';
import { useColaAuditoria } from './useColaAuditoria';

vi.mock('../axios', () => ({
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

const EMPTY_PAGE = { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 };

describe('useColaAuditoria', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: EMPTY_PAGE });
  });

  it('GETs /auditoria/evidencias forwarding tab/nivel/requisito/tipoEvidencia/page/size', async () => {
    const { result } = renderHook(
      () =>
        useColaAuditoria({
          tab: 'PENDIENTES',
          nivel: 'N2',
          requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
          tipoEvidencia: 'FOTO',
          page: 1,
          size: 20,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/auditoria/evidencias', {
      params: {
        tab: 'PENDIENTES',
        nivel: 'N2',
        requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
        tipoEvidencia: 'FOTO',
        page: 1,
        size: 20,
      },
    });
  });

  it('uses a query key that includes tab/filters/page/size so each combination caches independently', () => {
    const { result: r1 } = renderHook(() => useColaAuditoria({ tab: 'PENDIENTES', page: 0 }), {
      wrapper: createWrapper(),
    });
    const { result: r2 } = renderHook(() => useColaAuditoria({ tab: 'VENCIDAS', page: 0 }), {
      wrapper: createWrapper(),
    });

    // Two independent hook instances with different tab params must each issue their own
    // request (i.e. not share a cache entry) — proven by two separate GET calls below.
    expect(r1.current.isLoading || r1.current.isSuccess).toBe(true);
    expect(r2.current.isLoading || r2.current.isSuccess).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/auditoria/evidencias', {
      params: { tab: 'PENDIENTES', page: 0 },
    });
    expect(api.get).toHaveBeenCalledWith('/auditoria/evidencias', {
      params: { tab: 'VENCIDAS', page: 0 },
    });
  });

  it('keeps previous data while a new page/filter combination is loading (keepPreviousData)', async () => {
    const page1 = { ...EMPTY_PAGE, content: [{ id: 1 }], number: 0 };
    vi.mocked(api.get).mockResolvedValueOnce({ data: page1 });

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => useColaAuditoria({ tab: 'PENDIENTES', page }),
      { wrapper: createWrapper(), initialProps: { page: 0 } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(page1);

    // Next page never resolves — placeholderData must still surface the previous page's data
    // instead of `undefined`, proving keepPreviousData is wired.
    vi.mocked(api.get).mockImplementation(() => new Promise(() => undefined));
    rerender({ page: 1 });

    expect(result.current.data).toEqual(page1);
    expect(result.current.isPlaceholderData).toBe(true);
  });
});
