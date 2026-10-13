import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NecesidadDetallePage from './necesidad-detalle';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import { useOrgNombre } from '../lib/hooks/useOrgNombre';
import { useCrearDonacion } from '../lib/hooks/useCrearDonacion';
import { useArticulos } from '../lib/hooks/useArticulos';
import type { Articulo, Necesidad } from '../types/domain';

// Work unit G (DIRECTA flow, feature catalogo-articulos): the donation form's articulo línea
// editor is restricted to the necesidad's requested articulos, so every submitted línea is
// guaranteed compatible (decision 6 — the MS still enforces ARTICULO_INCOMPATIBLE server-side for
// any stale/race case).
vi.mock('../lib/hooks/useNecesidad', () => ({ useNecesidad: vi.fn() }));
vi.mock('../lib/hooks/useOrgNombre', () => ({ useOrgNombre: vi.fn() }));
vi.mock('../lib/hooks/useCrearDonacion', () => ({ useCrearDonacion: vi.fn() }));
vi.mock('../lib/hooks/useArticulos', () => ({ useArticulos: vi.fn() }));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };
const YOGUR: Articulo = { id: 2, nombre: 'Yogur', categoria: 'REFRIGERADO', unidad: 'LITRO', activo: true };

const necesidad: Necesidad = {
  id: 10,
  descripcion: 'Arroz para el comedor',
  prioridad: 'URGENTE',
  estado: 'ABIERTA',
  organizacionId: 3,
  articulos: [{ id: 1, nombre: 'Arroz', unidad: 'KG', categoria: 'NO_PERECEDERO' }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/necesidades/10']}>
      <Routes>
        <Route path="/necesidades/:id" element={<NecesidadDetallePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NecesidadDetallePage — DIRECTA línea editor', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(useNecesidad).mockReturnValue({
      data: necesidad,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useNecesidad>);
    vi.mocked(useOrgNombre).mockReturnValue({
      getNombre: () => 'Comedor Sol',
      isLoading: false,
    } as ReturnType<typeof useOrgNombre>);
    vi.mocked(useArticulos).mockReturnValue({
      data: [ARROZ, YOGUR],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useArticulos>);
    vi.mocked(useCrearDonacion).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useCrearDonacion>);
  });

  it('restricts the línea editor to the necesidad requested articulos', () => {
    renderPage();

    // No línea row is added yet, so no <select>/<option> renders at all — just confirm the
    // non-requested articulo text is absent anywhere on the page.
    expect(screen.queryByText('Yogur')).not.toBeInTheDocument();
  });

  it('shows only the requested articulo once a línea row is added', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /agregar artículo/i }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);

    expect(options.some((t) => t?.includes('Arroz'))).toBe(true);
    expect(options.some((t) => t?.includes('Yogur'))).toBe(false);
  });

  it('disables submit until at least one línea is set', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('button', { name: /ofrecer donaci[oó]n/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /agregar artículo/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /artículo/i }), '1');

    expect(screen.getByRole('button', { name: /ofrecer donaci[oó]n/i })).not.toBeDisabled();
  });

  it('submits the lineas payload with necesidadId', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /agregar artículo/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /artículo/i }), '1');
    await user.click(screen.getByRole('button', { name: /ofrecer donaci[oó]n/i }));

    expect(mutate).toHaveBeenCalledWith({
      necesidadId: 10,
      lineas: [{ articuloId: 1, cantidad: 1 }],
      observaciones: undefined,
    });
  });

  it('shows a friendly message on ARTICULO_INCOMPATIBLE', () => {
    vi.mocked(useCrearDonacion).mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      isSuccess: false,
      error: { response: { status: 400, data: { message: 'ARTICULO_INCOMPATIBLE: x' } } },
    } as unknown as ReturnType<typeof useCrearDonacion>);

    renderPage();

    expect(screen.getByText(/corresponde a lo solicitado/i)).toBeInTheDocument();
  });
});

// D2/N4: a VENCIDA / CUMPLIDA necesidad no longer takes donations (the MS answers 409).
describe('NecesidadDetallePage — closed necesidad', () => {
  beforeEach(() => {
    vi.mocked(useOrgNombre).mockReturnValue({
      getNombre: () => 'Comedor Sol',
      isLoading: false,
    } as ReturnType<typeof useOrgNombre>);
    vi.mocked(useArticulos).mockReturnValue({
      data: [ARROZ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useArticulos>);
    vi.mocked(useCrearDonacion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useCrearDonacion>);
  });

  it.each(['VENCIDA', 'CUMPLIDA'] as const)('hides the donation form when %s', (estado) => {
    vi.mocked(useNecesidad).mockReturnValue({
      data: { ...necesidad, estado },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useNecesidad>);
    renderPage();

    expect(screen.queryByRole('button', { name: /ofrecer donación/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no recibe donaciones/i)).toBeInTheDocument();
  });

  // N17: the MS answers 404 for a necesidad of an N0 organization the caller may not see.
  it('shows the "not available" message when the MS answers 404', () => {
    vi.mocked(useNecesidad).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 404 } },
    } as unknown as ReturnType<typeof useNecesidad>);
    renderPage();

    expect(screen.getByText(/no existe o ya no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ofrecer donación/i })).not.toBeInTheDocument();
  });
});
