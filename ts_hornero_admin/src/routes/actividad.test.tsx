import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import ActividadPage from './actividad';
import { useActividad } from '../lib/hooks/useActividad';
import type { Actividad } from '../types/domain';

vi.mock('../lib/hooks/useActividad', () => ({ useActividad: vi.fn() }));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const fila = (over: Partial<Actividad>): Actividad => ({
  id: 1,
  ocurridoEn: '2026-10-10T15:30:00Z',
  actorUsuarioId: 2,
  actorTipo: 'ADMINISTRADOR',
  accion: 'USUARIO_DESACTIVADO',
  resultado: 'EXITO',
  entidadTipo: 'USUARIO',
  entidadId: 7,
  detalle: null,
  antes: 'activo',
  despues: 'inactivo',
  motivo: 'abuso reiterado',
  ip: '190.12.3.4',
  emailIntento: null,
  actorNombre: null,
  actorEmail: null,
  ...over,
});

function pagina(content: Actividad[], totalPages = 1) {
  return {
    data: { content, number: 0, size: 20, totalElements: content.length, totalPages },
    isLoading: false,
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useActividad>;
}

describe('ActividadPage', () => {
  beforeEach(() => {
    vi.mocked(useActividad).mockReset();
  });

  it('shows Spanish labels, the actor, the before/after change, the reason and the IP', () => {
    vi.mocked(useActividad).mockReturnValue(pagina([fila({})]));

    render(<ActividadPage />, { wrapper: Wrapper });

    expect(screen.getByRole('heading', { name: 'Registro de actividades' })).toBeInTheDocument();
    const row = screen.getByText('Usuario desactivado', { selector: 'td *' }).closest('tr')!;
    expect(within(row).getByText('Éxito')).toBeInTheDocument();
    expect(within(row).getByText(/Administrador #2/)).toBeInTheDocument();
    expect(within(row).getByText(/Usuario #7/)).toBeInTheDocument();
    expect(within(row).getByText(/activo → inactivo/)).toBeInTheDocument();
    expect(within(row).getByText(/abuso reiterado/)).toBeInTheDocument();
    expect(within(row).getByText('190.12.3.4')).toBeInTheDocument();
  });

  it('shows the actor name and email, keeping the id as secondary text', () => {
    vi.mocked(useActividad).mockReturnValue(
      pagina([fila({ actorNombre: 'Ada Admin', actorEmail: 'ada@hornero.org' })]),
    );

    render(<ActividadPage />, { wrapper: Wrapper });

    const row = screen.getByText('Usuario desactivado', { selector: 'td *' }).closest('tr')!;
    expect(within(row).getByText('Ada Admin')).toBeInTheDocument();
    expect(within(row).getByText('ada@hornero.org')).toBeInTheDocument();
    expect(within(row).getByText(/Administrador #2/)).toBeInTheDocument();
  });

  it('labels system rows as Sistema', () => {
    vi.mocked(useActividad).mockReturnValue(
      pagina([fila({ actorUsuarioId: null, actorTipo: 'SISTEMA', accion: 'ACTIVIDAD_PURGADA' })]),
    );

    render(<ActividadPage />, { wrapper: Wrapper });

    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('shows the attempted email for a failed login and no actor id', () => {
    vi.mocked(useActividad).mockReturnValue(
      pagina([
        fila({
          accion: 'LOGIN',
          resultado: 'FALLO',
          actorUsuarioId: null,
          actorTipo: 'ANONIMO',
          entidadTipo: null,
          entidadId: null,
          antes: null,
          despues: null,
          motivo: null,
          detalle: 'CREDENCIALES_INVALIDAS',
          emailIntento: 'victima@example.com',
        }),
      ]),
    );

    render(<ActividadPage />, { wrapper: Wrapper });

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument();
    expect(screen.getByText('Fallo')).toBeInTheDocument();
    expect(screen.getByText(/victima@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Sin sesión/)).toBeInTheDocument();
  });

  it('falls back to the raw code for an action it has no label for', () => {
    vi.mocked(useActividad).mockReturnValue(pagina([fila({ accion: 'ACCION_FUTURA' })]));

    render(<ActividadPage />, { wrapper: Wrapper });

    expect(screen.getByText('ACCION_FUTURA')).toBeInTheDocument();
  });

  it('passes the chosen filters to the query and resets to the first page', async () => {
    const user = userEvent.setup();
    vi.mocked(useActividad).mockReturnValue(pagina([fila({})]));

    render(<ActividadPage />, { wrapper: Wrapper });

    await user.type(screen.getByLabelText('Usuario (id)'), '12');
    await user.click(screen.getByRole('button', { name: /Todas las acciones/ }));
    await user.click(screen.getByRole('option', { name: 'Inicio de sesión' }));
    await user.click(screen.getByRole('button', { name: /Todos los resultados/ }));
    await user.click(screen.getByRole('option', { name: 'Fallo' }));
    await user.type(screen.getByLabelText('Desde'), '2026-10-01');
    await user.type(screen.getByLabelText('Hasta'), '2026-10-02');

    const last = vi.mocked(useActividad).mock.calls.at(-1)![0]!;
    expect(last).toMatchObject({
      page: 0,
      size: 20,
      actorUsuarioId: 12,
      accion: 'LOGIN',
      resultado: 'FALLO',
      // Argentina is UTC-3 all year: start of 1 Oct, end of 2 Oct local time.
      desde: '2026-10-01T03:00:00.000Z',
      hasta: '2026-10-03T02:59:59.999Z',
    });
  });

  it('shows an empty message when nothing matches', () => {
    vi.mocked(useActividad).mockReturnValue(pagina([]));

    render(<ActividadPage />, { wrapper: Wrapper });

    expect(screen.getByText('Todavía no hay actividad registrada')).toBeInTheDocument();
  });
});
