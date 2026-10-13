import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReclamosPage from './reclamos';
import {
  useAprobarReclamo,
  useRechazarReclamo,
  useReclamo,
  useReclamosPendientes,
} from '../lib/hooks/useReclamos';
import { makePage } from '../test/fixtures/page';
import type { Reclamo } from '../types/domain';

vi.mock('../lib/hooks/useReclamos', () => ({
  useReclamosPendientes: vi.fn(),
  useReclamo: vi.fn(),
  useAprobarReclamo: vi.fn(),
  useRechazarReclamo: vi.fn(),
}));
vi.mock('../components/reclamo/ReclamoEvidencia', () => ({
  ReclamoEvidencia: ({ objectKey }: { objectKey: string }) => <div>archivo:{objectKey}</div>,
}));

const ROW: Reclamo = {
  id: 9,
  organizacionId: 4,
  organizacionNombre: 'Comedor X',
  organizacionSlug: 'comedor-x-1',
  organizacionDireccion: 'Calle 1, Córdoba',
  solicitanteId: 7,
  solicitanteNombre: 'Ana Pérez',
  solicitanteEmail: 'ana@test.com',
  rol: 'RESPONSABLE',
  telefono: '351 555 1234',
  mensaje: 'Soy la coordinadora',
  evidenciaKeys: ['reclamo-evidencia/4/7/1.jpg'],
  estado: 'PENDIENTE',
  creadoEn: '2026-10-10T12:00:00Z',
  organizacionesACargo: 2,
  capOrganizaciones: 3,
};

const APROBAR = vi.fn();
const RECHAZAR = vi.fn();

function mutation(mutateAsync: ReturnType<typeof vi.fn>, error: unknown = null) {
  return { mutateAsync, isPending: false, error } as never;
}

function renderPage() {
  return render(<MemoryRouter><ReclamosPage /></MemoryRouter>);
}

describe('ReclamosPage (admin queue)', () => {
  beforeEach(() => {
    APROBAR.mockReset().mockResolvedValue(ROW);
    RECHAZAR.mockReset().mockResolvedValue(ROW);
    vi.mocked(useReclamosPendientes).mockReturnValue({
      data: makePage([ROW]), isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReclamosPendientes>);
    vi.mocked(useReclamo).mockReturnValue({
      data: ROW, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReclamo>);
    vi.mocked(useAprobarReclamo).mockReturnValue(mutation(APROBAR));
    vi.mocked(useRechazarReclamo).mockReturnValue(mutation(RECHAZAR));
  });

  it('lists the pending claims with comedor, lugar, solicitante and fecha, plus the count', () => {
    renderPage();

    expect(useReclamosPendientes).toHaveBeenCalledWith({ page: 0, size: 20 });
    expect(screen.getByText('1 pendientes')).toBeInTheDocument();
    expect(screen.getByText('Comedor X')).toBeInTheDocument();
    expect(screen.getByText('Calle 1, Córdoba')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is pending', () => {
    vi.mocked(useReclamosPendientes).mockReturnValue({
      data: makePage<Reclamo>([]), isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReclamosPendientes>);
    renderPage();

    expect(screen.getByText('No hay reclamos pendientes')).toBeInTheDocument();
    expect(screen.getByText('0 pendientes')).toBeInTheDocument();
  });

  it('opens the detail with the claimant, rol, load n/3, phone, message and evidence', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    expect(useReclamo).toHaveBeenCalledWith(9);
    expect(screen.getByText(/Ana Pérez · ana@test.com/)).toBeInTheDocument();
    expect(screen.getByText('Responsable / coordinador/a')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('351 555 1234')).toBeInTheDocument();
    expect(screen.getByText('Soy la coordinadora')).toBeInTheDocument();
    expect(screen.getByText('archivo:reclamo-evidencia/4/7/1.jpg')).toBeInTheDocument();
  });

  it('approves and assigns, then closes the detail', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y asignar' }));

    await waitFor(() => expect(APROBAR).toHaveBeenCalledWith({ id: 9 }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobar y asignar' })).not.toBeInTheDocument());
  });

  it('requires a motivo to reject', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    expect(screen.getByText('El motivo es obligatorio')).toBeInTheDocument();
    expect(RECHAZAR).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Motivo del rechazo'), { target: { value: '  No se pudo verificar  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() => expect(RECHAZAR).toHaveBeenCalledWith({ id: 9, motivo: 'No se pudo verificar' }));
  });

  it('can back out of the rejection without sending anything', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar…' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Aprobar y asignar' })).toBeInTheDocument();
    expect(RECHAZAR).not.toHaveBeenCalled();
  });

  it('shows the admin-voiced error when the approval is refused (cap reached)', () => {
    vi.mocked(useAprobarReclamo).mockReturnValue(
      mutation(APROBAR, { response: { status: 409, data: { message: 'El referente ya alcanzó el máximo de 3 organizaciones' } } }),
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    expect(screen.getByText('El solicitante ya alcanzó el máximo de 3 organizaciones a su cargo.')).toBeInTheDocument();
  });
});
