import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import AppShell from './AppShell';
import { useAuthStore } from '../store/auth.store';

function Bomb(): never {
  throw new Error('boom');
}

function buildRouter() {
  return createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          {
            path: '/admin',
            element: (
              <div>
                <Link to="/panel">Ir a panel</Link>
                <Bomb />
              </div>
            ),
          },
          { path: '/panel', element: <div>Panel Page</div> },
        ],
      },
    ],
    { initialEntries: ['/admin'] },
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: { userId: 1, email: 'admin@test.com', nombre: 'Admin', tipo: 'ADMINISTRADOR', emailVerificado: true },
    status: 'authenticated',
    orgValidada: false,
    orgChecked: false,
  });
});

describe('AppShell route-level ErrorBoundary', () => {
  it('renders the ErrorState fallback when a routed child throws during render', () => {
    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  it('keeps the nav rendered so the user can still navigate away', async () => {
    render(<RouterProvider router={buildRouter()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Panel' }));

    expect(screen.getByText('Panel Page')).toBeInTheDocument();
  });

  // Task 4b.6 (AD-8) — the cross-org audit queue screen needs a nav entry in the admin block.
  it('shows an "Auditoría" nav link pointing at /auditoria for ADMINISTRADOR', () => {
    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByRole('link', { name: 'Auditoría' })).toHaveAttribute('href', '/auditoria');
  });
});

describe('AppShell Acreditación nav entry', () => {
  it('shows an "Acreditación" link to /acreditacion for REFERENTE', () => {
    useAuthStore.setState({
      user: { userId: 2, email: 'ref@test.com', nombre: 'Ref', tipo: 'REFERENTE', emailVerificado: true },
    });
    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByRole('link', { name: 'Acreditación' })).toHaveAttribute('href', '/acreditacion');
  });

  it('does not show it for DONANTE', () => {
    useAuthStore.setState({
      user: { userId: 3, email: 'don@test.com', nombre: 'Don', tipo: 'DONANTE', emailVerificado: true },
    });
    render(<RouterProvider router={buildRouter()} />);

    expect(screen.queryByRole('link', { name: 'Acreditación' })).not.toBeInTheDocument();
  });
});
