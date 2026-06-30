import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser } from '../store/auth.store';

const ADMIN_USER: AuthUser = { userId: 1, email: 'admin@test.com', nombre: 'Admin', tipo: 'ADMINISTRADOR' };
const DONANTE_USER: AuthUser = { userId: 2, email: 'd@test.com', nombre: 'Donante', tipo: 'DONANTE' };
const REFERENTE_USER: AuthUser = { userId: 3, email: 'r@test.com', nombre: 'Ref', tipo: 'REFERENTE' };

// Helper: build a MemoryRouter that places the ProtectedRoute guard at '/'
// with a protected child page, plus redirect targets.
function buildRouter(
  guardProps: React.ComponentProps<typeof ProtectedRoute>,
  initialPath = '/protected',
) {
  return createMemoryRouter(
    [
      {
        element: <ProtectedRoute {...guardProps} />,
        children: [
          { path: '/protected', element: <div>Protected Content</div> },
          { path: '/needs', element: <div>Needs Content</div> },
        ],
      },
      { path: '/login', element: <div>Login Page</div> },
      { path: '/', element: <div>Home Page</div> },
      { path: '/pending-validation', element: <div>Pending Validation Page</div> },
    ],
    { initialEntries: [initialPath] },
  );
}

beforeEach(() => {
  // Reset store to unauthenticated baseline before each test
  useAuthStore.setState({
    user: null,
    status: 'unauthenticated',
    orgValidada: false,
    orgChecked: false,
  });
});

describe('ProtectedRoute guard matrix', () => {
  it('renders a loader while status is loading (role not yet resolved)', () => {
    useAuthStore.setState({ status: 'loading' });

    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    // Neither content nor redirect should render during loading
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    // The loader placeholder div is rendered
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('unauthenticated user is redirected to /login', () => {
    // default state is already 'unauthenticated'
    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('ADMIN on an ADMIN-only route renders the Outlet (child content)', () => {
    useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });

    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('DONANTE on an ADMIN-only route is redirected (role not in allow list)', () => {
    useAuthStore.setState({ status: 'authenticated', user: DONANTE_USER });

    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Default redirectTo='/' → Home Page
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('unvalidated REFERENTE on a requireValidated route is redirected to /pending-validation', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: REFERENTE_USER,
      orgValidada: false,
      orgChecked: true, // org check settled — result is unvalidated
    });

    const router = buildRouter(
      { allow: ['ADMINISTRADOR', 'REFERENTE'], requireValidated: true },
      '/needs',
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Pending Validation Page')).toBeInTheDocument();
    expect(screen.queryByText('Needs Content')).not.toBeInTheDocument();
  });

  describe('REFERENTE + requireValidated — orgChecked gate', () => {
    const GUARD_PROPS = { allow: ['ADMINISTRADOR', 'REFERENTE'] as Array<typeof REFERENTE_USER['tipo']>, requireValidated: true };

    it('renders a loader while orgChecked=false (mia query still in flight)', () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: REFERENTE_USER,
        orgValidada: false,
        orgChecked: false, // query not settled yet
      });

      const router = buildRouter(GUARD_PROPS, '/needs');
      render(<RouterProvider router={router} />);

      // No redirect, no content — just the loader placeholder
      expect(screen.queryByText('Needs Content')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Validation Page')).not.toBeInTheDocument();
      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    it('redirects to /pending-validation when orgChecked=true and orgValidada=false', () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: REFERENTE_USER,
        orgValidada: false,
        orgChecked: true,
      });

      const router = buildRouter(GUARD_PROPS, '/needs');
      render(<RouterProvider router={router} />);

      expect(screen.getByText('Pending Validation Page')).toBeInTheDocument();
      expect(screen.queryByText('Needs Content')).not.toBeInTheDocument();
    });

    it('renders the outlet when orgChecked=true and orgValidada=true', () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: REFERENTE_USER,
        orgValidada: true,
        orgChecked: true,
      });

      const router = buildRouter(GUARD_PROPS, '/needs');
      render(<RouterProvider router={router} />);

      expect(screen.getByText('Needs Content')).toBeInTheDocument();
      expect(screen.queryByText('Pending Validation Page')).not.toBeInTheDocument();
    });
  });
});
