import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LoginPage from './login';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser } from '../store/auth.store';

const ADMIN_USER: AuthUser = { userId: 1, email: 'admin@test.com', nombre: 'Admin', tipo: 'ADMINISTRADOR', emailVerificado: true };
const DONANTE_USER: AuthUser = { userId: 2, email: 'd@test.com', nombre: 'Donante', tipo: 'DONANTE', emailVerificado: true };
const REFERENTE_USER: AuthUser = { userId: 3, email: 'r@test.com', nombre: 'Ref', tipo: 'REFERENTE', emailVerificado: true };

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

describe('LoginPage — deactivated account notice (N9)', () => {
  it('shows "Tu cuenta fue desactivada" when redirected with motivo=cuenta-desactivada', () => {
    const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
      initialEntries: ['/login?motivo=cuenta-desactivada'],
    });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Tu cuenta fue desactivada');
  });

  it('shows no notice without the query param', () => {
    const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
      initialEntries: ['/login'],
    });
    render(<RouterProvider router={router} />);

    expect(screen.queryByText(/Tu cuenta fue desactivada/)).not.toBeInTheDocument();
  });
});

describe('LoginPage — password reset entry points (N14)', () => {
  it('links to the forgot-password page', () => {
    const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
      initialEntries: ['/login'],
    });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute(
      'href',
      '/olvide-contrasena',
    );
  });

  it('shows the success notice after a completed reset', () => {
    const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
      initialEntries: ['/login?motivo=password-restablecida'],
    });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cambiaste tu contraseña');
  });
});

describe('LoginPage — returns to the originally requested URL', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'unauthenticated', orgValidada: false, orgChecked: false });
  });

  function routerFrom(from: string) {
    return createMemoryRouter(
      [
        { path: '/login', element: <LoginPage /> },
        { path: '/admin', element: <div>Admin Home</div> },
        { path: '/control-donaciones', element: <div>Control Page</div> },
      ],
      { initialEntries: [{ pathname: '/login', state: { from } }] },
    );
  }

  it('navigates to state.from after login when it is a safe path', async () => {
    vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });
    });
    render(<RouterProvider router={routerFrom('/control-donaciones')} />);
    await submitLoginForm();
    await waitFor(() => expect(screen.getByText('Control Page')).toBeInTheDocument());
  });

  it('ignores an open-redirect state.from and uses role home', async () => {
    vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });
    });
    render(<RouterProvider router={routerFrom('//evil.com')} />);
    await submitLoginForm();
    await waitFor(() => expect(screen.getByText('Admin Home')).toBeInTheDocument());
  });
});
