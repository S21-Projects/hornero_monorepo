import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LoginPage from './login';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser } from '../store/auth.store';

const ADMIN_USER: AuthUser = { userId: 1, email: 'admin@test.com', nombre: 'Admin', tipo: 'ADMINISTRADOR' };
const DONANTE_USER: AuthUser = { userId: 2, email: 'd@test.com', nombre: 'Donante', tipo: 'DONANTE' };
const REFERENTE_USER: AuthUser = { userId: 3, email: 'r@test.com', nombre: 'Ref', tipo: 'REFERENTE' };

function buildRouter() {
  return createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/admin', element: <div>Admin Home</div> },
      { path: '/explorar', element: <div>Explorar Page</div> },
      { path: '/dashboard', element: <div>Referente Dashboard</div> },
      { path: '/panel', element: <div>Panel Page</div> },
      { path: '/mis-donaciones', element: <div>Mis Donaciones Page</div> },
    ],
    { initialEntries: ['/login'] },
  );
}

async function submitLoginForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'test@test.com');
  await user.type(screen.getByLabelText('Contraseña'), 'secret123');
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage — post-login navigation uses roleHome', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      status: 'unauthenticated',
      orgValidada: false,
      orgChecked: false,
    });
  });

  it('navigates an ADMINISTRADOR to /admin (roleHome), not the old hardcoded /panel', async () => {
    vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });
    });

    render(<RouterProvider router={buildRouter()} />);
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Admin Home')).toBeInTheDocument();
    });
    expect(screen.queryByText('Panel Page')).not.toBeInTheDocument();
  });

  it('navigates a DONANTE to /explorar (roleHome), not the old hardcoded /mis-donaciones', async () => {
    vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ status: 'authenticated', user: DONANTE_USER });
    });

    render(<RouterProvider router={buildRouter()} />);
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Explorar Page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Mis Donaciones Page')).not.toBeInTheDocument();
  });

  it('navigates a REFERENTE to /dashboard (roleHome) — actual validated-gating is enforced by the route guard, not this page', async () => {
    vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ status: 'authenticated', user: REFERENTE_USER });
    });

    render(<RouterProvider router={buildRouter()} />);
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText('Referente Dashboard')).toBeInTheDocument();
    });
  });
});
