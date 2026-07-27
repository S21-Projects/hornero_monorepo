import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
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
      { path: '/admin', element: <div>Admin Home</div> },
      { path: '/dashboard', element: <div>Referente Dashboard</div> },
      { path: '/explorar', element: <div>Explorar Page</div> },
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

  it('DONANTE on an ADMIN-only route is redirected to its role home (not /)', () => {
    useAuthStore.setState({ status: 'authenticated', user: DONANTE_USER });

    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Default redirectTo falls back to roleHome(tipo) → /explorar for DONANTE.
    // This breaks the old cyclic trap where redirectTo='/' bounced back through
    // PublicOnlyRoute/RootRedirect.
    expect(screen.getByText('Explorar Page')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });

  it('ADMIN on a DONANTE-only route is redirected to its role home (explicit redirectTo still wins)', () => {
    useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });

    const router = buildRouter({ allow: ['DONANTE'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });

  it('honors an explicit redirectTo over roleHome when provided', () => {
    useAuthStore.setState({ status: 'authenticated', user: DONANTE_USER });

    const router = buildRouter({ allow: ['ADMINISTRADOR'], redirectTo: '/pending-validation' });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Pending Validation Page')).toBeInTheDocument();
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

// Helper: build a MemoryRouter placing PublicOnlyRoute at '/login', plus
// role-home targets to verify the redirect breaks the old admin-only '/'
// / DONANTE-only '/dashboard' hardcoded split.
function buildPublicOnlyRouter(initialPath = '/login') {
  return createMemoryRouter(
    [
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            <div>Login Page</div>
          </PublicOnlyRoute>
        ),
      },
      { path: '/admin', element: <div>Admin Home</div> },
      { path: '/dashboard', element: <div>Referente Dashboard</div> },
      { path: '/explorar', element: <div>Explorar Page</div> },
    ],
    { initialEntries: [initialPath] },
  );
}

describe('PublicOnlyRoute guard', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      status: 'unauthenticated',
      orgValidada: false,
      orgChecked: false,
    });
  });

  it('renders a loader while status is loading', () => {
    useAuthStore.setState({ status: 'loading' });

    render(<RouterProvider router={buildPublicOnlyRouter()} />);

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders the public page for an unauthenticated visitor', () => {
    render(<RouterProvider router={buildPublicOnlyRouter()} />);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects an authenticated ADMINISTRADOR to /admin (via roleHome)', () => {
    useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });

    render(<RouterProvider router={buildPublicOnlyRouter()} />);

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });

  it('redirects an authenticated REFERENTE to /dashboard (via roleHome)', () => {
    useAuthStore.setState({ status: 'authenticated', user: REFERENTE_USER });

    render(<RouterProvider router={buildPublicOnlyRouter()} />);

    expect(screen.getByText('Referente Dashboard')).toBeInTheDocument();
  });

  it('redirects an authenticated DONANTE to /explorar (via roleHome, not the old hardcoded /dashboard)', () => {
    useAuthStore.setState({ status: 'authenticated', user: DONANTE_USER });

    render(<RouterProvider router={buildPublicOnlyRouter()} />);

    expect(screen.getByText('Explorar Page')).toBeInTheDocument();
  });
});
