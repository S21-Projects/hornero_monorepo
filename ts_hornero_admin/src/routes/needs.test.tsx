import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NeedsPage from './needs';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useCrearNecesidad } from '../lib/hooks/useCrearNecesidad';
import { useActualizarNecesidad } from '../lib/hooks/useActualizarNecesidad';
import { useEliminarNecesidad } from '../lib/hooks/useEliminarNecesidad';
import { useRelanzarNecesidad } from '../lib/hooks/useRelanzarNecesidad';
import { useArticulos } from '../lib/hooks/useArticulos';
import { useNeedsViewState } from './needs-view-state';
import type { Articulo } from '../types/domain';

// Work unit H (feature catalogo-articulos): the necesidad create form requires ≥1 selected
// articulo instead of a free-text-only flow with no categoria input.
vi.mock('../lib/hooks/useMisOrganizaciones', () => ({ useMisOrganizaciones: vi.fn() }));
vi.mock('../lib/hooks/useNecesidadesDeOrg', () => ({ useNecesidadesDeOrg: vi.fn() }));
vi.mock('../lib/hooks/useCrearNecesidad', () => ({ useCrearNecesidad: vi.fn() }));
vi.mock('../lib/hooks/useActualizarNecesidad', () => ({ useActualizarNecesidad: vi.fn() }));
vi.mock('../lib/hooks/useEliminarNecesidad', () => ({ useEliminarNecesidad: vi.fn() }));
vi.mock('../lib/hooks/useRelanzarNecesidad', () => ({ useRelanzarNecesidad: vi.fn() }));
vi.mock('../lib/hooks/useArticulos', () => ({ useArticulos: vi.fn() }));
vi.mock('./needs-view-state', () => ({ useNeedsViewState: vi.fn() }));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };

describe('NeedsPage — create form articulo picker', () => {
  const mutateAsync = vi.fn().mockResolvedValue({ id: 99 });
  const goToList = vi.fn();

  beforeEach(() => {
    mutateAsync.mockClear();
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [{ id: 3, nombre: 'Comedor Sol' }],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useMisOrganizaciones>);
    vi.mocked(useNecesidadesDeOrg).mockReturnValue({
      data: { content: [], totalPages: 1 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNecesidadesDeOrg>);
    vi.mocked(useEliminarNecesidad).mockReturnValue({
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useEliminarNecesidad>);
    vi.mocked(useArticulos).mockReturnValue({
      data: [ARROZ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useArticulos>);
    vi.mocked(useCrearNecesidad).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCrearNecesidad>);
    vi.mocked(useActualizarNecesidad).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useActualizarNecesidad>);
    vi.mocked(useRelanzarNecesidad).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRelanzarNecesidad>);
    vi.mocked(useNeedsViewState).mockReturnValue({
      view: 'create',
      pendingDeleteId: null,
      goToList,
      goToCreate: vi.fn(),
      goToEdit: vi.fn(),
      armDelete: vi.fn(),
      clearDelete: vi.fn(),
    });
  });

  it('requires at least one articulo before submitting', async () => {
    const user = userEvent.setup();
    render(<NeedsPage />);

    await user.type(screen.getByLabelText(/descripción/i), 'Arroz para el comedor');
    await user.selectOptions(screen.getByLabelText(/prioridad/i), 'URGENTE');
    await user.click(screen.getByRole('button', { name: /crear necesidad/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/eleg[ií] al menos un art[ií]culo/i)).toBeInTheDocument();
  });

  it('submits articuloIds once an articulo is selected', async () => {
    const user = userEvent.setup();
    render(<NeedsPage />);

    await user.type(screen.getByLabelText(/descripción/i), 'Arroz para el comedor');
    await user.selectOptions(screen.getByLabelText(/prioridad/i), 'URGENTE');
    await user.click(screen.getByRole('checkbox', { name: 'Arroz' }));
    await user.click(screen.getByRole('button', { name: /crear necesidad/i }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ articuloIds: [1] }),
    );
  });
});

// D2/N4: an expired necesidad is relaunched from the list; the edit form can't reopen it.
describe('NeedsPage — relaunch an expired necesidad', () => {
  const relanzar = vi.fn();
  const base = { prioridad: 'MEDIA', organizacionId: 3, articulos: [{ id: 1, nombre: 'Arroz' }] };
  const vencida = { ...base, id: 11, descripcion: 'Necesidad vencida', estado: 'VENCIDA', fechaVencimiento: '2026-09-01' };
  const abierta = { ...base, id: 12, descripcion: 'Necesidad abierta', estado: 'ABIERTA', fechaVencimiento: '2099-01-01' };

  function setup(view: unknown = 'list', error: unknown = null) {
    relanzar.mockReset().mockResolvedValue({});
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [{ id: 3, nombre: 'Comedor Sol' }], isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useMisOrganizaciones>);
    vi.mocked(useNecesidadesDeOrg).mockReturnValue({
      data: { content: [vencida, abierta], totalPages: 1 }, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useNecesidadesDeOrg>);
    vi.mocked(useEliminarNecesidad).mockReturnValue({ mutateAsync: vi.fn() } as unknown as ReturnType<typeof useEliminarNecesidad>);
    vi.mocked(useArticulos).mockReturnValue({ data: [ARROZ], isLoading: false, isError: false } as ReturnType<typeof useArticulos>);
    vi.mocked(useActualizarNecesidad).mockReturnValue({
      mutateAsync: vi.fn(), isPending: false, isError: false, error: null,
    } as unknown as ReturnType<typeof useActualizarNecesidad>);
    vi.mocked(useRelanzarNecesidad).mockReturnValue({
      mutateAsync: relanzar, isPending: false, isError: error != null, error,
    } as unknown as ReturnType<typeof useRelanzarNecesidad>);
    vi.mocked(useNeedsViewState).mockReturnValue({
      view: view as never, pendingDeleteId: null, goToList: vi.fn(), goToCreate: vi.fn(),
      goToEdit: vi.fn(), armDelete: vi.fn(), clearDelete: vi.fn(),
    });
  }

  it('offers "Relanzar" only on VENCIDA necesidades', () => {
    setup();
    render(<NeedsPage />);
    expect(screen.getAllByRole('button', { name: /relanzar/i })).toHaveLength(1);
  });

  it('requires a date and submits the new date for that necesidad', async () => {
    setup();
    const user = userEvent.setup();
    render(<NeedsPage />);

    await user.click(screen.getByRole('button', { name: /^relanzar$/i }));
    await user.click(screen.getByRole('button', { name: /confirmar relanzamiento/i }));
    expect(relanzar).not.toHaveBeenCalled();
    expect(screen.getByText(/elegí una fecha de vencimiento/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/nueva fecha de vencimiento/i), '2099-12-01');
    await user.click(screen.getByRole('button', { name: /confirmar relanzamiento/i }));
    expect(relanzar).toHaveBeenCalledWith({ id: 11, fechaVencimiento: '2099-12-01' });
  });

  it('shows the friendly API error when the relaunch is refused', async () => {
    setup('list', Object.assign(new Error('x'), {
      response: { status: 409, data: { message: 'NECESIDAD_NO_VENCIDA: x' } },
    }));
    const user = userEvent.setup();
    render(<NeedsPage />);
    await user.click(screen.getByRole('button', { name: /^relanzar$/i }));
    expect(screen.getByText(/no está vencida/i)).toBeInTheDocument();
  });

  it('does not let the edit form reopen a VENCIDA necesidad (no estado select)', () => {
    setup({ id: 11 });
    render(<NeedsPage />);
    expect(screen.queryByLabelText(/^estado$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/relanzar/i)).toBeInTheDocument();
  });
});
