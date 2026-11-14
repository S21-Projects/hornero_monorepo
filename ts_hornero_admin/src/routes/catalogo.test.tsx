import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CatalogoPage from './catalogo';
import {
  useArticulosAdmin,
  useCrearArticulo,
  useEditarArticulo,
  useDesactivarArticulo,
  useReactivarArticulo,
} from '../lib/hooks/useArticulos';
import type { Articulo } from '../types/domain';

vi.mock('../lib/hooks/useArticulos', () => ({
  useArticulosAdmin: vi.fn(),
  useCrearArticulo: vi.fn(),
  useEditarArticulo: vi.fn(),
  useDesactivarArticulo: vi.fn(),
  useReactivarArticulo: vi.fn(),
}));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };
const YOGUR: Articulo = { id: 2, nombre: 'Yogur', categoria: 'REFRIGERADO', unidad: 'LITRO', activo: true };

function mockArticulos(content: Articulo[] | undefined, overrides: Record<string, unknown> = {}) {
  vi.mocked(useArticulosAdmin).mockReturnValue({
    data: content && { content, number: 0, size: 10, totalElements: content.length, totalPages: 1 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useArticulosAdmin>);
}

function mockMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    reset: vi.fn(),
    ...overrides,
  } as unknown;
}

function renderPage() {
  render(
    <MemoryRouter>
      <CatalogoPage />
    </MemoryRouter>,
  );
}

describe('CatalogoPage', () => {
  beforeEach(() => {
    mockArticulos([ARROZ, YOGUR]);
    vi.mocked(useCrearArticulo).mockReturnValue(mockMutation() as ReturnType<typeof useCrearArticulo>);
    vi.mocked(useEditarArticulo).mockReturnValue(mockMutation() as ReturnType<typeof useEditarArticulo>);
    vi.mocked(useDesactivarArticulo).mockReturnValue(mockMutation() as ReturnType<typeof useDesactivarArticulo>);
    vi.mocked(useReactivarArticulo).mockReturnValue(mockMutation() as ReturnType<typeof useReactivarArticulo>);
  });

  it('lists articulos with their categoría and unidad', () => {
    renderPage();

    const arrozRow = screen.getByText('Arroz').closest('tr') as HTMLElement;
    const yogurRow = screen.getByText('Yogur').closest('tr') as HTMLElement;
    expect(within(arrozRow).getByText('No perecedero')).toBeInTheDocument();
    expect(within(yogurRow).getByText('Refrigerado')).toBeInTheDocument();
    expect(within(yogurRow).getByText('litro')).toBeInTheDocument();
  });

  it('shows skeleton rows with the toolbar visible on first load', () => {
    mockArticulos(undefined, { isLoading: true });
    renderPage();

    expect(screen.getAllByTestId('table-skeleton-row').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Buscar por nombre')).toBeInTheDocument();
  });

  it('shows an error panel and retries the query', () => {
    const refetch = vi.fn();
    mockArticulos(undefined, { isError: true, refetch });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the progress bar while refetching with the previous rows still visible', () => {
    mockArticulos([ARROZ], { isFetching: true });
    renderPage();

    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Actualizando resultados' })).toBeInTheDocument();
  });

  it('queries the server by categoría and resets to the first page (no client-side filtering)', () => {
    renderPage();
    expect(useArticulosAdmin).toHaveBeenLastCalledWith({
      page: 0, size: 10, q: '', categoria: undefined, incluirInactivos: false,
    });

    fireEvent.change(screen.getByLabelText('Filtrar por categoría'), {
      target: { value: 'REFRIGERADO' },
    });

    expect(useArticulosAdmin).toHaveBeenLastCalledWith({
      page: 0, size: 10, q: '', categoria: 'REFRIGERADO', incluirInactivos: false,
    });
    // The page renders exactly what the server returned.
    expect(screen.getByText('Arroz')).toBeInTheDocument();
  });

  it('asks the server for inactive articulos when "Mostrar inactivos" is checked', () => {
    renderPage();

    fireEvent.click(screen.getByLabelText('Mostrar inactivos'));

    expect(useArticulosAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ incluirInactivos: true, page: 0 }));
  });

  describe('debounced search', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('sends the trimmed text as q after 300ms', () => {
      renderPage();

      fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: ' yog ' } });
      expect(useArticulosAdmin).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'yog' }));

      act(() => { vi.advanceTimersByTime(300); });

      expect(useArticulosAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'yog', page: 0 }));
    });
  });

  it('creates an articulo from the "Nuevo artículo" form', () => {
    const crear = mockMutation();
    vi.mocked(useCrearArticulo).mockReturnValue(crear as ReturnType<typeof useCrearArticulo>);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo artículo' }));
    fireEvent.change(screen.getByLabelText('Nombre', { selector: '#catalogo-crear-nombre' }), {
      target: { value: 'Lentejas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear artículo' }));

    expect((crear as { mutate: (...a: unknown[]) => void }).mutate).toHaveBeenCalledWith(
      { nombre: 'Lentejas', categoria: 'NO_PERECEDERO', unidad: 'UNIDAD' },
      expect.anything(),
    );
  });

  it('does not submit the create form when nombre is blank', () => {
    const crear = mockMutation();
    vi.mocked(useCrearArticulo).mockReturnValue(crear as ReturnType<typeof useCrearArticulo>);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo artículo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear artículo' }));

    expect((crear as { mutate: (...a: unknown[]) => void }).mutate).not.toHaveBeenCalled();
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument();
  });

  it('edits an articulo inline', () => {
    const editar = mockMutation();
    vi.mocked(useEditarArticulo).mockReturnValue(editar as ReturnType<typeof useEditarArticulo>);
    renderPage();

    const row = screen.getByText('Arroz').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Editar' }));

    const nombreInput = screen.getByLabelText('Nombre', { selector: '#catalogo-editar-1-nombre' });
    fireEvent.change(nombreInput, { target: { value: 'Arroz Integral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect((editar as { mutate: (...a: unknown[]) => void }).mutate).toHaveBeenCalledWith(
      { id: 1, input: { nombre: 'Arroz Integral', categoria: 'NO_PERECEDERO', unidad: 'KG' } },
      expect.anything(),
    );
  });

  it('requires a confirmation click before deactivating', () => {
    const desactivar = mockMutation();
    vi.mocked(useDesactivarArticulo).mockReturnValue(desactivar as ReturnType<typeof useDesactivarArticulo>);
    renderPage();

    const row = screen.getByText('Arroz').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Desactivar' }));

    expect((desactivar as { mutate: (...a: unknown[]) => void }).mutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: '¿Desactivar este artículo?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, desactivar' }));
    expect((desactivar as { mutate: (...a: unknown[]) => void }).mutate).toHaveBeenCalledWith(1);
  });

  it('does not show edit/deactivate actions for an inactive articulo, offers Reactivar instead', () => {
    mockArticulos([{ ...ARROZ, activo: false }], {});
    renderPage();

    const row = screen.getByText('Arroz').closest('tr') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(within(row).getByText('Inactivo')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
  });

  it('reactivates an inactive articulo', () => {
    const reactivar = mockMutation();
    vi.mocked(useReactivarArticulo).mockReturnValue(reactivar as ReturnType<typeof useReactivarArticulo>);
    mockArticulos([{ ...ARROZ, activo: false }], {});
    renderPage();

    const row = screen.getByText('Arroz').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Reactivar' }));

    expect((reactivar as { mutate: (...a: unknown[]) => void }).mutate).toHaveBeenCalledWith(1);
  });
});
