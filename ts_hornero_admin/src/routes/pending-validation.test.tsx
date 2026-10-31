import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PendingValidationPage from './pending-validation';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useAuthStore } from '../store/auth.store';

vi.mock('../lib/hooks/useMisOrganizaciones', () => ({
  useMisOrganizaciones: vi.fn(),
}));

const logout = vi.fn().mockResolvedValue(undefined);

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/pending-validation', element: <PendingValidationPage /> },
      { path: '/acreditacion', element: <div>Acreditacion Page</div> },
      { path: '/mis-organizaciones', element: <div>Mis Organizaciones Page</div> },
    ],
    { initialEntries: ['/pending-validation'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function setup(orgCount: number, nombre?: string) {
  vi.mocked(useMisOrganizaciones).mockReturnValue({
    data: nombre ? [{ id: 1, nombre }] : [],
  } as unknown as ReturnType<typeof useMisOrganizaciones>);
  useAuthStore.setState({ orgCount, logout });
}

beforeEach(() => {
  logout.mockClear();
});

describe('PendingValidationPage', () => {
  it('with an org: explains N1 evidence is needed and links to /acreditacion', async () => {
    setup(1, 'Comedor Los Hornitos');
    const router = renderPage();

    expect(screen.getByText('Comedor Los Hornitos')).toBeInTheDocument();
    expect(screen.getByText(/todavía no aparece en el mapa/)).toBeInTheDocument();
    expect(screen.queryByText(/está siendo revisada/)).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cargar evidencia para N1' }));
    expect(router.state.location.pathname).toBe('/acreditacion');
  });

  it('with an org: secondary button goes to /mis-organizaciones', async () => {
    setup(1, 'Comedor Los Hornitos');
    const router = renderPage();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Mis organizaciones' }));
    expect(router.state.location.pathname).toBe('/mis-organizaciones');
  });

  it('with an org: Cerrar sesión calls logout', async () => {
    setup(1, 'Comedor Los Hornitos');
    renderPage();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('without an org: keeps the create-organización entry point and offers logout', async () => {
    setup(0);
    const router = renderPage();

    expect(screen.queryByRole('button', { name: 'Cargar evidencia para N1' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Crear tu organización' }));
    expect(router.state.location.pathname).toBe('/mis-organizaciones');
  });
});
