import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PanelPage from './panel';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useValidarOrganizacion } from '../lib/hooks/useValidarOrganizacion';
import { useRechazarOrganizacion } from '../lib/hooks/useRechazarOrganizacion';

vi.mock('../lib/hooks/useOrganizacionesPendientes', () => ({ useOrganizacionesPendientes: vi.fn() }));
vi.mock('../lib/hooks/useValidarOrganizacion', () => ({ useValidarOrganizacion: vi.fn() }));
vi.mock('../lib/hooks/useRechazarOrganizacion', () => ({ useRechazarOrganizacion: vi.fn() }));

const validarMutate = vi.fn();
const rechazarMutate = vi.fn();

function mockPendientes(content: unknown[]) {
  vi.mocked(useOrganizacionesPendientes).mockReturnValue({
    data: { content, number: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useOrganizacionesPendientes>);
}

const ORG = {
  id: 4,
  nombre: 'Comedor Sol',
  tipo: 'COMEDOR',
  estado: 'PENDIENTE',
  descripcion: 'Almuerzos de lunes a viernes',
  direccion: 'Av. Colón 100',
  referenteNombre: 'Lucía Fernández',
  referenteEmail: 'lucia@hornero.ar',
};

beforeEach(() => {
  validarMutate.mockReset();
  rechazarMutate.mockReset();
  vi.mocked(useValidarOrganizacion).mockReturnValue({
    mutate: validarMutate, isPending: false, isError: false, variables: undefined, error: null,
  } as unknown as ReturnType<typeof useValidarOrganizacion>);
  vi.mocked(useRechazarOrganizacion).mockReturnValue({
    mutate: rechazarMutate, isPending: false, isError: false, variables: undefined, error: null,
  } as unknown as ReturnType<typeof useRechazarOrganizacion>);
});

describe('PanelPage', () => {
  it('renders the empty state inside the table, keeping the column headers', () => {
    mockPendientes([]);
    render(<PanelPage />);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Organización' })).toBeInTheDocument();
    expect(within(table).getByText('No hay organizaciones pendientes')).toBeInTheDocument();
  });

  it('lists a pending organización as a row with validate and reject actions', async () => {
    mockPendientes([ORG]);
    const user = userEvent.setup();
    render(<PanelPage />);

    const row = screen.getByRole('row', { name: /Comedor Sol/ });
    expect(within(row).getByText('lucia@hornero.ar')).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Validar' }));
    expect(validarMutate).toHaveBeenCalledWith(4);

    await user.click(within(row).getByRole('button', { name: 'Rechazar' }));
    expect(rechazarMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: '¿Rechazar esta organización?' });
    expect(within(dialog).getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Sí, rechazar' }));
    expect(rechazarMutate).toHaveBeenCalledWith(4, expect.anything());
  });
});
