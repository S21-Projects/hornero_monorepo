import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../../axios';
import { useActualizarInfoPublica } from '../useActualizarInfoPublica';

vi.mock('../../axios', () => ({
  api: { patch: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useActualizarInfoPublica', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
  });

  it('PATCHes /organizaciones/{id} with the info-pública fields', async () => {
    const updated = { id: 5, infoPublicaPendienteEn: '2026-07-28T00:00:00' };
    vi.mocked(api.patch).mockResolvedValue({ data: updated });

    const { result } = renderHook(() => useActualizarInfoPublica(), { wrapper: createWrapper() });
    result.current.mutate({
      organizacionId: 5,
      input: { sitioWebUrl: 'https://new.org' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.patch).toHaveBeenCalledWith('/organizaciones/5', { sitioWebUrl: 'https://new.org' });
  });

  it('surfaces a 400 error from an invalid URL', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 400 } });

    const { result } = renderHook(() => useActualizarInfoPublica(), { wrapper: createWrapper() });
    result.current.mutate({ organizacionId: 5, input: { sitioWebUrl: 'javascript:alert(1)' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
