import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExplorarPage from './explorar';
import { useNecesidades } from '../lib/hooks/useNecesidades';
import { useOrgNombre } from '../lib/hooks/useOrgNombre';
import { makePage } from '../test/fixtures/page';
import type { Necesidad } from '../types/domain';

// Work unit H (feature catalogo-articulos): the donante-facing necesidad browse list shows the
// requested articulos, same as the referente's needs.tsx list and the necesidad-detalle header.
vi.mock('../lib/hooks/useNecesidades', () => ({ useNecesidades: vi.fn() }));
vi.mock('../lib/hooks/useOrgNombre', () => ({ useOrgNombre: vi.fn() }));

const necesidad: Necesidad = {
  id: 1,
  descripcion: 'Arroz para el comedor',
  prioridad: 'URGENTE',
  estado: 'ABIERTA',
  organizacionId: 3,
  articulos: [{ id: 1, nombre: 'Arroz', unidad: 'KG', categoria: 'NO_PERECEDERO' }],
};

function renderPage() {
  return render(<MemoryRouter><ExplorarPage /></MemoryRouter>);
}

describe('ExplorarPage — requested articulos', () => {
  it('shows the requested articulos on each card', () => {
    vi.mocked(useNecesidades).mockReturnValue({
      data: makePage([necesidad]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useNecesidades>);
    vi.mocked(useOrgNombre).mockReturnValue({
      getNombre: () => 'Comedor Sol',
      isLoading: false,
    } as ReturnType<typeof useOrgNombre>);

    renderPage();

    expect(screen.getByText('Arroz (kg)')).toBeInTheDocument();
  });
});
