import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CatalogoPage from './catalogo';
import {
  useArticulos,
  useCrearArticulo,
  useEditarArticulo,
  useDesactivarArticulo,
} from '../lib/hooks/useArticulos';
import type { Articulo } from '../types/domain';

vi.mock('../lib/hooks/useArticulos', () => ({
  useArticulos: vi.fn(),
  useCrearArticulo: vi.fn(),
  useEditarArticulo: vi.fn(),
  useDesactivarArticulo: vi.fn(),
}));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };
const YOGUR: Articulo = { id: 2, nombre: 'Yogur', categoria: 'REFRIGERADO', unidad: 'LITRO', activo: true };

function mockArticulos(data: Articulo[] | undefined, overrides: Record<string, unknown> = {}) {
  vi.mocked(useArticulos).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useArticulos>);
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
  });

  it('lists articulos with their categoría and unidad', () => {
    renderPage();

    const arrozRow = screen.getByText('Arroz').closest('tr') as HTMLElement;
    const yogurRow = screen.getByText('Yogur').closest('tr') as HTMLElement;
    expect(within(arrozRow).getByText('No perecedero')).toBeInTheDocument();
    expect(within(yogurRow).getByText('Refrigerado')).toBeInTheDocument();
    expect(within(yogurRow).getByText('litro')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    mockArticulos(undefined, { isLoading: true });
    renderPage();

    expect(screen.getByText(/Cargando/)).toBeInTheDocument();
  });

  it('filters the list by categoría', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Filtrar por categoría'), {
      target: { value: 'REFRIGERADO' },
    });

    expect(screen.queryByText('Arroz')).not.toBeInTheDocument();
    expect(screen.getByText('Yogur')).toBeInTheDocument();
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
    expect(within(row).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'Confirmar' }));
    expect((desactivar as { mutate: (...a: unknown[]) => void }).mutate).toHaveBeenCalledWith(1);
  });

  it('does not show edit/deactivate actions for an inactive articulo', () => {
    mockArticulos([{ ...ARROZ, activo: false }], {});
    renderPage();

    const row = screen.getByText('Arroz').closest('tr') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(within(row).getByText('Inactivo')).toBeInTheDocument();
  });
});
