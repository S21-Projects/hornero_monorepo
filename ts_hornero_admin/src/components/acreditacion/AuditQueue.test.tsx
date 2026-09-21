import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuditQueue } from './AuditQueue';
import { api } from '../../lib/axios';
import type { RequisitoEnLegajo } from '../../types/domain';

vi.mock('../../lib/axios', () => ({
  api: { patch: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PENDIENTE_ROW: RequisitoEnLegajo = {
  requisito: 'NO_DISCRIMINACION',
  nivelExigido: 'N1',
  estado: 'PENDIENTE',
  tipoEvidencia: 'DECLARACION',
  declaracion: 'No discriminamos por ningún motivo',
  validoDesde: '2026-01-01',
  validoHasta: null,
  expirada: false,
  auditorNombre: null,
  auditadoEn: null,
};

const EXPIRED_APROBADA_ROW: RequisitoEnLegajo = {
  ...PENDIENTE_ROW,
  requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
  estado: 'APROBADA',
  validoHasta: '2020-01-01',
  expirada: true,
};

describe('AuditQueue', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
  });

  it('shows an expiry warning for expirada: true requisitos', () => {
    render(
      <AuditQueue organizacionId={5} requisitos={[PENDIENTE_ROW, EXPIRED_APROBADA_ROW]} evidenciaIds={{}} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText(/vencid/i)).toBeInTheDocument();
  });

  it('does not render a level-change control inline', () => {
    render(<AuditQueue organizacionId={5} requisitos={[PENDIENTE_ROW]} evidenciaIds={{}} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByLabelText(/nuevo nivel/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar cambio de nivel/i })).not.toBeInTheDocument();
  });

  it('approves a pending requisito with evidenciaId', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: { id: 42, organizacionId: 5, requisito: 'NO_DISCRIMINACION', estado: 'APROBADA' },
    });
    const user = userEvent.setup();

    render(
      <AuditQueue organizacionId={5} requisitos={[PENDIENTE_ROW]} evidenciaIds={{ NO_DISCRIMINACION: 42 }} />,
      { wrapper: Wrapper },
    );

    await user.click(screen.getByRole('button', { name: /aprobar/i }));

    expect(api.patch).toHaveBeenCalledWith(
      '/organizaciones/5/acreditacion/evidencias/42/aprobar',
      {},
    );
  });
});
