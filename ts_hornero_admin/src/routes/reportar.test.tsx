import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportarPage from './reportar';
import { useOrganizacionPorSlug } from '../lib/hooks/useReclamos';
import { useCrearReporte, useOrganizacionesCercanas } from '../lib/hooks/useReportes';

vi.mock('../lib/hooks/useReclamos', () => ({ useOrganizacionPorSlug: vi.fn() }));
vi.mock('../lib/hooks/useReportes', () => ({
  useCrearReporte: vi.fn(),
  useOrganizacionesCercanas: vi.fn(),
}));

const ORG = {
  id: 4,
  slug: 'comedor-x-1',
  nombre: 'Comedor X',
  direccion: 'Calle 1, Córdoba',
  estado: 'SIN_RECLAMAR',
};
const CERCANAS = [
  { id: 20, slug: 'cerca', nombre: 'Comedor Cerca', direccion: 'Calle 2', distanciaMetros: 120 },
  { id: 21, slug: 'mas-lejos', nombre: 'Merendero Lejos', direccion: null, distanciaMetros: 430 },
];

const CREAR = vi.fn();

function mockOrg(data: unknown, extra: Record<string, unknown> = {}) {
  vi.mocked(useOrganizacionPorSlug).mockReturnValue({
    data, isLoading: false, isError: false, refetch: vi.fn(), ...extra,
  } as unknown as ReturnType<typeof useOrganizacionPorSlug>);
}

function mockCercanas(data: unknown[] = CERCANAS, extra: Record<string, unknown> = {}) {
  vi.mocked(useOrganizacionesCercanas).mockReturnValue({
    data, isLoading: false, isError: false, ...extra,
  } as unknown as ReturnType<typeof useOrganizacionesCercanas>);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reportar/comedor-x-1']}>
      <Routes>
        <Route path="/reportar/:slug" element={<ReportarPage />} />
        <Route path="/" element={<div>inicio</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReportarPage', () => {
  beforeEach(() => {
    CREAR.mockReset().mockResolvedValue({ id: 1 });
    mockOrg(ORG);
    mockCercanas();
    vi.mocked(useCrearReporte).mockReturnValue({
      mutateAsync: CREAR, isPending: false, isError: false, error: null,
    } as unknown as ReturnType<typeof useCrearReporte>);
  });

  it('shows the comedor and the four options of the mockup with their hints', () => {
    renderPage();

    expect(useOrganizacionPorSlug).toHaveBeenCalledWith('comedor-x-1');
    expect(screen.getByRole('heading', { name: 'Reportar un problema' })).toBeInTheDocument();
    expect(screen.getByText('Comedor X')).toBeInTheDocument();
    expect(screen.getByText('Calle 1, Córdoba')).toBeInTheDocument();
    expect(screen.getByLabelText(/Ya no funciona/)).toBeInTheDocument();
    expect(screen.getByText('Cerró o dejó de dar comidas')).toBeInTheDocument();
    expect(screen.getByLabelText(/Los datos son incorrectos/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ya está en Hornero con otro nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Otro motivo/)).toBeInTheDocument();
    expect(screen.getByText(/El comedor no cambia hasta que se confirme/)).toBeInTheDocument();
  });

  it('requires a motivo before sending anything', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(screen.getByText('Elegí qué problema querés reportar')).toBeInTheDocument();
    expect(CREAR).not.toHaveBeenCalled();
  });

  it('submits a simple report with a trimmed detalle', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/Ya no funciona/));
    await user.type(screen.getByLabelText('Detalle (opcional)'), '  Cerró en marzo  ');
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() =>
      expect(CREAR).toHaveBeenCalledWith({
        organizacionId: 4,
        motivo: 'INACTIVO',
        organizacionDuplicadaId: undefined,
        detalle: 'Cerró en marzo',
      }),
    );
    expect(await screen.findByText('Recibimos tu reporte')).toBeInTheDocument();
  });

  it('does not fetch nearby organizaciones until the duplicate option is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(useOrganizacionesCercanas).toHaveBeenLastCalledWith(4, false);
    expect(screen.queryByText('¿Con qué organización de Hornero es el mismo?')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/Ya está en Hornero con otro nombre/));

    expect(useOrganizacionesCercanas).toHaveBeenLastCalledWith(4, true);
    expect(screen.getByText('¿Con qué organización de Hornero es el mismo?')).toBeInTheDocument();
    expect(screen.getByText('Sugerimos las organizaciones de Hornero a menos de 500 m.')).toBeInTheDocument();
    expect(screen.getByText('Comedor Cerca')).toBeInTheDocument();
    expect(screen.getByText('Calle 2 · a 120 m')).toBeInTheDocument();
    expect(screen.getByText('a 430 m')).toBeInTheDocument();
  });

  it('requires choosing the duplicated organizacion, then sends its id', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByLabelText(/Ya está en Hornero con otro nombre/));

    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(screen.getByText('Elegí con qué organización de Hornero es el mismo')).toBeInTheDocument();
    expect(CREAR).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Merendero Lejos/));
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() =>
      expect(CREAR).toHaveBeenCalledWith({
        organizacionId: 4,
        motivo: 'DUPLICADO',
        organizacionDuplicadaId: 21,
        detalle: undefined,
      }),
    );
  });

  it('says so when there is nothing nearby, and never sends a stale duplicate id after changing the motivo', async () => {
    const user = userEvent.setup();
    mockCercanas([]);
    renderPage();
    await user.click(screen.getByLabelText(/Ya está en Hornero con otro nombre/));
    expect(screen.getByText(/No hay organizaciones de Hornero a menos de 500 m/)).toBeInTheDocument();

    mockCercanas(CERCANAS);
    await user.click(screen.getByLabelText(/Otro motivo/));
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() => expect(CREAR).toHaveBeenCalled());
    expect(CREAR.mock.calls[0][0].organizacionDuplicadaId).toBeUndefined();
  });

  it('shows the mapped error when the MS refuses the report', () => {
    vi.mocked(useCrearReporte).mockReturnValue({
      mutateAsync: CREAR, isPending: false, isError: true,
      error: { response: { status: 409, data: { message: 'Ya tenés un reporte pendiente para este comedor' } } },
    } as unknown as ReturnType<typeof useCrearReporte>);
    renderPage();

    expect(screen.getByText('Ya tenés un reporte pendiente para este comedor.')).toBeInTheDocument();
  });

  it('shows no form for an organizacion that is not unclaimed', () => {
    mockOrg({ ...ORG, estado: 'APROBADA' });
    renderPage();

    expect(screen.getByText('Este comedor no se puede reportar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).not.toBeInTheDocument();
  });

  it('shows the error state when the organizacion cannot be loaded', () => {
    mockOrg(undefined, { isError: true });
    renderPage();

    expect(screen.queryByText('Comedor X')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).not.toBeInTheDocument();
  });
});
