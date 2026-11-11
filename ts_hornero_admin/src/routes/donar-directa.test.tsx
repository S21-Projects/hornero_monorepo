import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import DonarDirectaPage from './donar-directa';
import { useNecesidades } from '../lib/hooks/useNecesidades';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { useArticulos } from '../lib/hooks/useArticulos';
import type { Articulo, Necesidad } from '../types/domain';

vi.mock('../lib/hooks/useNecesidades', () => ({ useNecesidades: vi.fn() }));
vi.mock('../lib/hooks/useNecesidad', () => ({ useNecesidad: vi.fn() }));
vi.mock('../lib/hooks/useCrearDonacion', () => ({ useCrearDonacion: vi.fn() }));
vi.mock('../lib/hooks/useArticulos', () => ({ useArticulos: vi.fn() }));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };
const YOGUR: Articulo = { id: 2, nombre: 'Yogur', categoria: 'REFRIGERADO', unidad: 'LITRO', activo: true };

const N_ARROZ: Necesidad = {
  id: 10,
  descripcion: 'Arroz para el comedor',
  prioridad: 'URGENTE',
  estado: 'ABIERTA',
  organizacionId: 3,
  organizacionNombre: 'Comedor Sol',
  articulos: [{ id: 1, nombre: 'Arroz', unidad: 'KG', categoria: 'NO_PERECEDERO' }],
};
const N_YOGUR: Necesidad = {
  id: 11,
  descripcion: 'Lácteos para la merienda',
  prioridad: 'NORMAL',
  estado: 'ABIERTA',
  organizacionId: 4,
  organizacionNombre: 'Merendero Luna',
  articulos: [{ id: 2, nombre: 'Yogur', unidad: 'LITRO', categoria: 'REFRIGERADO' }],
};

const mutate = vi.fn();

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/donar/directa', element: <DonarDirectaPage /> },
      { path: '/donar', element: <div>Donar Page</div> },
      { path: '/mis-donaciones/:id', element: <div>Detalle Page</div> },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('DonarDirectaPage', () => {
  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(useNecesidades).mockReturnValue({
      data: { content: [N_ARROZ, N_YOGUR], number: 0, size: 20, totalElements: 2, totalPages: 1 },
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useNecesidades>);
    vi.mocked(useNecesidad).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNecesidad>);
    vi.mocked(useArticulos).mockReturnValue({
      data: [ARROZ, YOGUR],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useArticulos>);
    vi.mocked(useCrearDonacion).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCrearDonacion>);
  });

  it('disables Continuar until a necesidad is chosen', async () => {
    const user = userEvent.setup();
    renderAt('/donar/directa');

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /arroz para el comedor/i }));

    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
    expect(screen.getByText(/elegiste/i)).toHaveTextContent('Comedor Sol');
  });

  it('filters the list by search text', async () => {
    const user = userEvent.setup();
    renderAt('/donar/directa');

    await user.type(screen.getByLabelText(/buscar necesidad/i), 'luna');

    expect(screen.queryByRole('radio', { name: /arroz para el comedor/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /lácteos/i })).toBeInTheDocument();
  });

  it('walks need → lines → note → confirm and creates the donation', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_input, opts: { onSuccess: (d: { id: number }) => void }) => {
      opts.onSuccess({ id: 42 });
    });
    const router = renderAt('/donar/directa');

    await user.click(screen.getByRole('radio', { name: /arroz para el comedor/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    // Step 2: one blank row is ready; the picker only offers the necesidad's articulo.
    expect(screen.queryByRole('option', { name: 'Yogur' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: /artículo/i }), '1');
    expect(screen.getByText(/El comedor tiene 7 días para aceptar/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    // Step 3: note, then confirm.
    await user.type(screen.getByLabelText(/nota para el comedor/i), 'Llego el sábado');
    await user.click(screen.getByRole('button', { name: /confirmar donación/i }));

    expect(mutate).toHaveBeenCalledWith(
      { necesidadId: 10, lineas: [{ articuloId: 1, cantidad: 1 }], observaciones: 'Llego el sábado' },
      expect.any(Object),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/mis-donaciones/42'));
    expect(router.state.location.search).toBe('?nueva=1');
  });

  it('keeps entered data when going back and forth', async () => {
    const user = userEvent.setup();
    renderAt('/donar/directa');

    await user.click(screen.getByRole('radio', { name: /arroz para el comedor/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /artículo/i }), '1');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.type(screen.getByLabelText(/nota para el comedor/i), 'Hola');
    await user.click(screen.getByRole('button', { name: /volver/i }));

    expect(screen.getByRole('combobox', { name: /artículo/i })).toHaveValue('1');
    await user.click(screen.getByRole('button', { name: /cambiar necesidad/i }));
    expect(screen.getByRole('radio', { name: /arroz para el comedor/i })).toBeChecked();
  });

  it('starts at step 2 when entering with ?necesidad=', () => {
    vi.mocked(useNecesidad).mockReturnValue({
      data: N_ARROZ,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNecesidad>);
    renderAt('/donar/directa?necesidad=10');

    expect(screen.getByRole('button', { name: /cambiar necesidad/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /artículo/i })).toBeInTheDocument();
    expect(screen.getByText('Para Comedor Sol')).toBeInTheDocument();
  });

  it('shows the mapped error inline when the mutation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(useNecesidad).mockReturnValue({
      data: N_ARROZ,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNecesidad>);
    vi.mocked(useCrearDonacion).mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: { response: { status: 400, data: { message: 'ARTICULO_INCOMPATIBLE: x' } } },
    } as unknown as ReturnType<typeof useCrearDonacion>);
    renderAt('/donar/directa?necesidad=10');

    await user.selectOptions(screen.getByRole('combobox', { name: /artículo/i }), '1');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByText(/corresponde a lo solicitado/i)).toBeInTheDocument();
  });
});
