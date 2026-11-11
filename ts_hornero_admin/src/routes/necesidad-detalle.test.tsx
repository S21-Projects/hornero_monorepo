import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NecesidadDetallePage from './necesidad-detalle';
import { useNecesidad } from '../lib/hooks/useNecesidad';
import type { Necesidad } from '../types/domain';

// The donation itself is created in the direct-donation wizard (`/donar/directa`); this page only
// shows the necesidad and links into the wizard at step 2 with `?necesidad=<id>`.
vi.mock('../lib/hooks/useNecesidad', () => ({ useNecesidad: vi.fn() }));

const necesidad: Necesidad = {
  id: 10,
  descripcion: 'Arroz para el comedor',
  prioridad: 'URGENTE',
  estado: 'ABIERTA',
  organizacionId: 3,
  organizacionNombre: 'Comedor Sol',
  articulos: [{ id: 1, nombre: 'Arroz', unidad: 'KG', categoria: 'NO_PERECEDERO' }],
};

function mockNecesidad(data: Necesidad | undefined, extra: Record<string, unknown> = {}) {
  vi.mocked(useNecesidad).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    ...extra,
  } as unknown as ReturnType<typeof useNecesidad>);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/necesidades/10']}>
      <Routes>
        <Route path="/necesidades/:id" element={<NecesidadDetallePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NecesidadDetallePage', () => {
  beforeEach(() => { mockNecesidad(necesidad); });

  it('shows the organizacion name carried by the necesidad', () => {
    renderPage();

    expect(screen.getByText(/Organización: Comedor Sol/)).toBeInTheDocument();
  });

  it('links the donate CTA to the wizard with the necesidad preselected', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /donar a esta necesidad/i })).toHaveAttribute(
      'href',
      '/donar/directa?necesidad=10',
    );
  });

  // D2/N4: a VENCIDA / CUMPLIDA necesidad no longer takes donations (the MS answers 409).
  it.each(['VENCIDA', 'CUMPLIDA'] as const)('hides the donate CTA when %s', (estado) => {
    mockNecesidad({ ...necesidad, estado });
    renderPage();

    expect(screen.queryByRole('link', { name: /donar a esta necesidad/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no recibe donaciones/i)).toBeInTheDocument();
  });

  // N17: the MS answers 404 for a necesidad of an N0 organization the caller may not see.
  it('shows the "not available" message when the MS answers 404', () => {
    mockNecesidad(undefined, { isError: true, error: { response: { status: 404 } } });
    renderPage();

    expect(screen.getByText(/no existe o ya no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /donar a esta necesidad/i })).not.toBeInTheDocument();
  });
});
