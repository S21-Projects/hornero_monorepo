import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferentesPage from './referentes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useOrganizacionesAdmin } from '../lib/hooks/useOrganizacionesAdmin';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { makePage } from '../test/fixtures/page';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

const asignarMutateAsync = vi.fn();
const aprobarMutateAsync = vi.fn();
const rechazarMutateAsync = vi.fn();

vi.mock('../lib/hooks/useUsuarios', () => ({ useUsuarios: vi.fn() }));
vi.mock('../lib/hooks/useOrganizacionesAdmin', () => ({ useOrganizacionesAdmin: vi.fn() }));
vi.mock('../lib/hooks/useOrganizacionesPendientes', () => ({ useOrganizacionesPendientes: vi.fn() }));
vi.mock('../lib/hooks/usePageClamp', () => ({ usePageClamp: vi.fn() }));
vi.mock('../lib/hooks/useAsignarReferente', () => ({
  useAsignarReferente: () => ({
    mutateAsync: asignarMutateAsync, isPending: false, isError: false, variables: undefined, error: null,
  }),
}));
vi.mock('../lib/hooks/useAdminInfoPublica', () => ({
  useAdminInfoPublica: () => ({
    aprobar: { mutateAsync: aprobarMutateAsync, isPending: false, isError: false, error: null },
    rechazar: { mutateAsync: rechazarMutateAsync, isPending: false, isError: false, error: null },
  }),
}));
vi.mock('../components/org/InfoPublicaForm', () => ({ InfoPublicaForm: () => <div>info-publica-form</div> }));

const referente = (id: number, nombre: string): Usuario => ({
  id, nombre, email: `${nombre.toLowerCase()}@test.com`, tipo: 'REFERENTE', activo: true,
});
const org = (id: number, nombre: string, referenteId: number | null, extra: Partial<OrganizacionAdmin> = {}): OrganizacionAdmin => ({
  id, nombre, slug: `org-${id}`, tipo: 'COMEDOR', descripcion: '', direccion: 'Alberdi',
  estado: referenteId == null ? 'SIN_RECLAMAR' : 'APROBADA', referenteId, aceptaDonaciones: false, ...extra,
} as OrganizacionAdmin);

const ok = (data: unknown) => ({ data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });

describe('ReferentesPage (v2 board)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    asignarMutateAsync.mockReset().mockImplementation(async ({ organizacionId, referenteId }) =>
      org(organizacionId, 'x', referenteId));
    aprobarMutateAsync.mockReset().mockResolvedValue(org(1, 'Alta Nueva', null));
    rechazarMutateAsync.mockReset().mockResolvedValue(org(1, 'Alta Nueva', null));
    vi.mocked(useUsuarios).mockReturnValue(
      ok(makePage([referente(1, 'Ana'), referente(2, 'Beto')])) as unknown as ReturnType<typeof useUsuarios>,
    );
    vi.mocked(useOrganizacionesPendientes).mockImplementation(((params: { size: number }) =>
      params.size === 1
        ? ok(makePage([], { totalElements: 3, size: 1 }))
        : ok(makePage([
            org(1, 'Alta Nueva', null, { estado: 'PENDIENTE', infoPublicaPendienteEn: '2026-11-01', aceptaDonacionesPendiente: true, sitioWebUrlPendiente: 'https://nueva.org' }),
            org(2, 'Alta Simple', null, { estado: 'PENDIENTE' }),
          ]))
    ) as unknown as typeof useOrganizacionesPendientes);
    vi.mocked(useOrganizacionesAdmin).mockImplementation(((params: { size: number; sinReferente?: boolean; referenteIds?: number[] }) => {
      if (params.size === 1) return ok(makePage([], { totalElements: params.sinReferente ? 7 : 42, size: 1 }));
      if (params.sinReferente) return ok(makePage([org(30, 'Comedor Norte', null)]));
      return ok(makePage([org(10, 'Comedor Sol', 1), org(11, 'Merendero Luna', 1)]));
    }) as unknown as typeof useOrganizacionesAdmin);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderPage = () => render(<MemoryRouter><ReferentesPage /></MemoryRouter>);
  const lastAdminCall = () => vi.mocked(useOrganizacionesAdmin).mock.calls.at(-1);
  const pick = (button: HTMLElement, option: RegExp) => {
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('option', { name: option }));
  };

  it('starts on Por revisar, reading the pendientes endpoint, with bandeja counts from size=1 queries', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /Por revisar/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Por revisar/ })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /Sin referente/ })).toHaveTextContent('7');
    expect(screen.getByRole('button', { name: /Todas/ })).toHaveTextContent('42');
    expect(screen.getByText('Alta Nueva')).toBeInTheDocument();
    expect(useOrganizacionesPendientes).toHaveBeenCalledWith({ page: 0, size: 10 }, { enabled: true });
    expect(lastAdminCall()?.[1]).toEqual({ enabled: false });
  });

  it('switches bandeja and filters by referente server-side', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Sin referente/ }));
    expect(screen.getByText('Comedor Norte')).toBeInTheDocument();
    expect(lastAdminCall()).toEqual([{ page: 0, size: 10, sinReferente: true, q: '' }, { enabled: true }]);

    fireEvent.click(screen.getByRole('button', { name: /^Ana/ }));
    expect(screen.getByRole('button', { name: /^Ana/ })).toHaveAttribute('aria-current', 'page');
    expect(lastAdminCall()).toEqual([{ page: 0, size: 10, referenteIds: [1], q: '' }, { enabled: true }]);
  });

  it('debounces the organization search into the q param and resets to the first page', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));

    fireEvent.change(screen.getByLabelText('Buscar por nombre o barrio'), { target: { value: ' norte ' } });
    expect(useOrganizacionesAdmin).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'norte' }), expect.anything());
    act(() => { vi.advanceTimersByTime(300); });

    expect(lastAdminCall()?.[0]).toEqual({ page: 0, size: 10, q: 'norte' });
  });

  it('asks the server for referentes only, and for the active ones separately for the dropdowns', () => {
    renderPage();

    expect(useUsuarios).toHaveBeenCalledWith({ page: 0, size: 100, tipo: 'REFERENTE', q: '' });
    expect(useUsuarios).toHaveBeenCalledWith({ page: 0, size: 100, tipo: 'REFERENTE', activo: true });
  });

  it('opens the drawer on Info pública for a pending change in Por revisar and rejects only with a motivo', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Alta Nueva' }));

    const infoTab = screen.getByRole('tab', { name: /Info pública/ });
    expect(infoTab).toHaveAttribute('aria-selected', 'true');
    expect(within(infoTab).getByRole('img', { name: 'tiene cambios pendientes' })).toBeInTheDocument();
    expect(screen.getByText('https://nueva.org')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar rechazo' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Motivo del rechazo/), { target: { value: 'No coincide' } });
    expect(confirm).toBeEnabled();
    await act(async () => { fireEvent.click(confirm); });

    expect(rechazarMutateAsync).toHaveBeenCalledWith(1);
  });

  it('approves the pending change', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Alta Nueva' }));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aprobar cambios' })); });

    expect(aprobarMutateAsync).toHaveBeenCalledWith(1);
  });

  it('saves a single assignment from the Asignación tab', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Alta Simple' }));

    expect(screen.getByRole('tab', { name: 'Asignación' })).toHaveAttribute('aria-selected', 'true');
    const save = screen.getByRole('button', { name: 'Guardar asignación' });
    expect(save).toBeDisabled();

    const dialog = screen.getByRole('dialog');
    pick(within(dialog).getByRole('button', { name: /Sin referente/ }), /Beto \(beto@test\.com\)/);
    await act(async () => { fireEvent.click(save); });

    expect(asignarMutateAsync).toHaveBeenCalledWith({ organizacionId: 2, referenteId: 2 });
  });

  it('shows the read-only legajo summary with a link to the full legajo', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Alta Simple' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Legajo' }));

    expect(screen.getByRole('link', { name: /Abrir legajo y auditar/ })).toHaveAttribute('href', '/organizaciones/2/legajo');
  });

  it('bulk-assigns the selection one by one and reports partial failures', async () => {
    asignarMutateAsync.mockImplementation(async ({ organizacionId, referenteId }) => {
      if (organizacionId === 11) throw new Error('boom');
      return org(organizacionId, 'x', referenteId);
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));

    fireEvent.click(screen.getByLabelText('Seleccionar página'));
    const bar = screen.getByRole('region', { name: 'Acciones masivas' });
    expect(bar).toHaveTextContent('2 organizaciones seleccionadas');

    pick(within(bar).getByRole('button', { name: /Asignar a/ }), /Ana \(ana@test\.com\)/);
    await act(async () => { fireEvent.click(within(bar).getByRole('button', { name: 'Aplicar' })); });

    expect(asignarMutateAsync).toHaveBeenCalledWith({ organizacionId: 10, referenteId: 1 });
    expect(asignarMutateAsync).toHaveBeenCalledWith({ organizacionId: 11, referenteId: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('1 de 2 actualizadas · 1 fallaron');
    // Only the failed one stays selected, ready to retry.
    expect(screen.getByLabelText('Seleccionar Merendero Luna')).toBeChecked();
    expect(screen.getByLabelText('Seleccionar Comedor Sol')).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));
    expect(screen.queryByRole('region', { name: 'Acciones masivas' })).not.toBeInTheDocument();
  });
});
