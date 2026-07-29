import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { InfoPublicaForm } from './InfoPublicaForm';
import { api } from '../../lib/axios';

vi.mock('../../lib/axios', () => ({
  api: { patch: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('InfoPublicaForm', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
  });

  it('referente mode: no pending submission renders live values, no pending badge', () => {
    render(
      <InfoPublicaForm
        mode="referente"
        org={{
          id: 5,
          aceptaDonaciones: true,
          sitioWebUrl: 'https://live.org',
          donacionDirectaUrl: null,
          infoPublicaPendienteEn: null,
        }}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText('Cambios pendientes de aprobación')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sitio web (opcional)')).toHaveValue('https://live.org');
  });

  it('referente mode: pending submission pre-fills from the snapshot and shows the pending badge', () => {
    render(
      <InfoPublicaForm
        mode="referente"
        org={{
          id: 5,
          aceptaDonaciones: false,
          sitioWebUrl: 'https://old.org',
          donacionDirectaUrl: null,
          aceptaDonacionesPendiente: true,
          sitioWebUrlPendiente: 'https://new.org',
          donacionDirectaUrlPendiente: null,
          infoPublicaPendienteEn: '2026-07-28T00:00:00',
        }}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Cambios pendientes de aprobación')).toBeInTheDocument();
    expect(screen.getByLabelText('Sitio web (opcional)')).toHaveValue('https://new.org');
    expect(screen.getByText(/Actualmente público/)).toBeInTheDocument();
  });

  it('admin mode: never shows the pending badge, even with a pending submission on the org', () => {
    render(
      <InfoPublicaForm
        mode="admin"
        org={{
          id: 5,
          aceptaDonaciones: false,
          sitioWebUrl: 'https://old.org',
          donacionDirectaUrl: null,
          infoPublicaPendienteEn: '2026-07-28T00:00:00',
        }}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText('Cambios pendientes de aprobación')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sitio web (opcional)')).toHaveValue('https://old.org');
  });
});
