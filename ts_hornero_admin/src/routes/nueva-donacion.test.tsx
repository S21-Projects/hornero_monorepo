import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import NuevaDonacionPage from './nueva-donacion';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { useArticulos } from '../lib/hooks/useArticulos';
import type { Articulo } from '../types/domain';

// Spec `donacion-fondo-comun` — "Nueva Donación Screen" + decision 14 (nueva-donacion entry
// point): choosing DIRECTA navigates straight to /explorar without embedding a necesidad picker
// here; choosing FONDO_COMUN reveals the articulo línea editor + map + observaciones before
// submit is possible, and submits the FONDO_COMUN payload shape (no necesidadId, no client-chosen
// categoria — feature catalogo-articulos, decision 4/5: categoria is derived from `lineas`).
vi.mock('../lib/hooks/useCrearDonacion', () => ({ useCrearDonacion: vi.fn() }));
vi.mock('../lib/hooks/useArticulos', () => ({ useArticulos: vi.fn() }));

// The Leaflet-backed picker needs real DOM measurement APIs jsdom doesn't provide — swapped for a
// deterministic stub that fires onPick once (same pattern as register.test.tsx).
vi.mock('../components/map/OrgLocationPickerLazy', () => ({
  OrgLocationPickerLazy: ({ onPick }: { onPick: (latlng: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onPick({ lat: -31.4, lng: -64.18 })}>
      Fijar ubicación (test)
    </button>
  ),
}));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };

function buildRouter() {
  return createMemoryRouter(
    [
      { path: '/donar', element: <NuevaDonacionPage /> },
      { path: '/explorar', element: <div>Explorar Page</div> },
      { path: '/mis-donaciones', element: <div>Mis Donaciones Page</div> },
      { path: '/mis-donaciones/:id', element: <div>Donación Detalle Page</div> },
    ],
    { initialEntries: ['/donar'] },
  );
}

function renderPage() {
  const router = buildRouter();
  render(<RouterProvider router={router} />);
  return router;
}

describe('NuevaDonacionPage', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    mutateAsync.mockReset();
    vi.mocked(useCrearDonacion).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useCrearDonacion>);
    vi.mocked(useArticulos).mockReturnValue({
      data: [ARROZ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useArticulos>);
  });

  it('shows the two modalidad cards before anything is chosen', () => {
    renderPage();

    expect(screen.getByRole('radio', { name: /donación directa/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /fondo común/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/categoría/i)).not.toBeInTheDocument();
  });

  it('navigates to /explorar without a picker when DIRECTA is chosen', async () => {
    const user = userEvent.setup();
    const router = renderPage();

    await user.click(screen.getByRole('radio', { name: /donación directa/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/explorar'));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('reveals the línea editor and the map control before FONDO_COMUN can be submitted, with no manual categoria select', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: /fondo común/i }));

    expect(screen.getByRole('button', { name: /agregar artículo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fijar ubicación \(test\)/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^categoría$/i)).not.toBeInTheDocument();

    const submit = screen.getByRole('button', { name: /ofrecer al fondo común/i });
    expect(submit).toBeDisabled();
  });

  it('submits the FONDO_COMUN payload shape with lineas once a línea + location are set', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ id: 42 });
    renderPage();

    await user.click(screen.getByRole('radio', { name: /fondo común/i }));
    await user.click(screen.getByRole('button', { name: /agregar artículo/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /artículo/i }), '1');
    await user.click(screen.getByRole('button', { name: /fijar ubicación \(test\)/i }));
    await user.type(screen.getByLabelText(/descripci[oó]n/i), 'Arroz y fideos');

    const submit = screen.getByRole('button', { name: /ofrecer al fondo común/i });
    expect(submit).not.toBeDisabled();
    await user.click(submit);

    expect(mutateAsync).toHaveBeenCalledWith({
      modalidad: 'FONDO_COMUN',
      lineas: [{ articuloId: 1, cantidad: 1 }],
      latitud: -31.4,
      longitud: -64.18,
      observaciones: 'Arroz y fideos',
    });
  });

  it('keeps the submit button disabled with a location but no línea', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: /fondo común/i }));
    await user.click(screen.getByRole('button', { name: /fijar ubicación \(test\)/i }));

    expect(screen.getByRole('button', { name: /ofrecer al fondo común/i })).toBeDisabled();
  });
});
