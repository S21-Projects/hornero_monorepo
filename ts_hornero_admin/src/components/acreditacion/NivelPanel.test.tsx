import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { NivelPanel } from './NivelPanel';
import { api } from '../../lib/axios';

vi.mock('../../lib/axios', () => ({
  api: { patch: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('NivelPanel', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
  });

  it('disables submit while motivo is blank and enables it once filled', async () => {
    const user = userEvent.setup();
    render(<NivelPanel organizacionId={5} nivelActual="N1" />, { wrapper: Wrapper });

    const submit = screen.getByRole('button', { name: /confirmar cambio de nivel/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/motivo/i), 'Cumple todos los requisitos N2');
    expect(submit).not.toBeDisabled();
  });

  it('calls useCambiarNivel with the typed motivo and selected destino on submit', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: { organizacionId: 5, nivel: 'N2', nivelDesde: '2026-09-21T00:00:00Z' },
    });
    const user = userEvent.setup();
    render(<NivelPanel organizacionId={5} nivelActual="N1" />, { wrapper: Wrapper });

    await user.selectOptions(screen.getByLabelText(/nuevo nivel/i), 'N2');
    await user.type(screen.getByLabelText(/motivo/i), 'Cumple todos los requisitos N2');
    await user.click(screen.getByRole('button', { name: /confirmar cambio de nivel/i }));

    expect(api.patch).toHaveBeenCalledWith('/organizaciones/5/acreditacion/nivel', {
      destino: 'N2',
      motivo: 'Cumple todos los requisitos N2',
    });
  });
});
