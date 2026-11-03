import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportesCola } from './ReportesCola';
import {
  useDescartarReporte,
  useMarcarInactiva,
  useReporte,
  useReportesPendientes,
} from '../../lib/hooks/useReportes';
import { makePage } from '../../test/fixtures/page';
import type { Reporte } from '../../types/domain';

vi.mock('../../lib/hooks/useReportes', () => ({
  useReportesPendientes: vi.fn(),
  useReporte: vi.fn(),
  useMarcarInactiva: vi.fn(),
  useDescartarReporte: vi.fn(),
}));

const ROW: Reporte = {
  id: 9,
  organizacionId: 4,
  organizacionNombre: 'Comedor X',
  organizacionSlug: 'comedor-x-1',
  organizacionDireccion: 'Calle 1, Córdoba',
  reportanteId: 7,
  reportanteNombre: 'Dona Pérez',
  reportanteEmail: 'dona@test.com',
  motivo: 'DUPLICADO',
  organizacionDuplicadaId: 20,
  organizacionDuplicadaNombre: 'Comedor Cerca',
  organizacionDuplicadaSlug: 'cerca',
  detalle: 'Es el mismo de la esquina',
  estado: 'PENDIENTE',
  creadoEn: '2026-10-10T12:00:00Z',
};

const MARCAR = vi.fn();
const DESCARTAR = vi.fn();

function mutation(mutateAsync: ReturnType<typeof vi.fn>, error: unknown = null) {
  return { mutateAsync, isPending: false, error } as never;
}

describe('ReportesCola (admin "Reportes" tab)', () => {
  beforeEach(() => {
    MARCAR.mockReset().mockResolvedValue(ROW);
    DESCARTAR.mockReset().mockResolvedValue(ROW);
    vi.mocked(useReportesPendientes).mockReturnValue({
      data: makePage([ROW]), isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReportesPendientes>);
    vi.mocked(useReporte).mockReturnValue({
      data: ROW, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReporte>);
    vi.mocked(useMarcarInactiva).mockReturnValue(mutation(MARCAR));
    vi.mocked(useDescartarReporte).mockReturnValue(mutation(DESCARTAR));
  });

  it('lists the pending reports with comedor, lugar, motivo, reportante and fecha', () => {
    render(<ReportesCola />);

    expect(useReportesPendientes).toHaveBeenCalledWith({ page: 0, size: 10 });
    expect(screen.getByText('Comedor X')).toBeInTheDocument();
    expect(screen.getByText('Calle 1, Córdoba')).toBeInTheDocument();
    expect(screen.getByText('Ya está en Hornero con otro nombre')).toBeInTheDocument();
    expect(screen.getByText('Dona Pérez')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is pending', () => {
    vi.mocked(useReportesPendientes).mockReturnValue({
      data: makePage<Reporte>([]), isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReportesPendientes>);
    render(<ReportesCola />);

    expect(screen.getByText('No hay reportes pendientes')).toBeInTheDocument();
  });

  it('opens the detail with the reporter, motivo, duplicated organizacion and detalle', () => {
    render(<ReportesCola />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    expect(useReporte).toHaveBeenCalledWith(9);
    expect(screen.getByText(/Dona Pérez · dona@test.com/)).toBeInTheDocument();
    expect(screen.getByText('Comedor Cerca')).toBeInTheDocument();
    expect(screen.getByText('Es el mismo de la esquina')).toBeInTheDocument();
  });

  it('marks the comedor inactive, then closes the detail', async () => {
    render(<ReportesCola />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    fireEvent.click(screen.getByRole('button', { name: 'Marcar inactiva' }));

    await waitFor(() => expect(MARCAR).toHaveBeenCalledWith({ id: 9 }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marcar inactiva' })).not.toBeInTheDocument());
  });

  it('requires a nota to discard', async () => {
    render(<ReportesCola />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    fireEvent.click(screen.getByRole('button', { name: 'Descartar…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descarte' }));

    expect(screen.getByText('La nota es obligatoria')).toBeInTheDocument();
    expect(DESCARTAR).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nota del descarte'), { target: { value: '  Sigue abierto  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descarte' }));

    await waitFor(() => expect(DESCARTAR).toHaveBeenCalledWith({ id: 9, nota: 'Sigue abierto' }));
  });

  it('can back out of the discard without sending anything', () => {
    render(<ReportesCola />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar…' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Marcar inactiva' })).toBeInTheDocument();
    expect(DESCARTAR).not.toHaveBeenCalled();
  });

  it('shows the admin-voiced error when marking inactive is refused', () => {
    vi.mocked(useMarcarInactiva).mockReturnValue(
      mutation(MARCAR, { response: { status: 409, data: { message: 'Este comedor ya no está sin reclamar' } } }),
    );
    render(<ReportesCola />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));

    expect(screen.getByText('Este comedor ya no está sin reclamar: descartá el reporte.')).toBeInTheDocument();
  });
});
