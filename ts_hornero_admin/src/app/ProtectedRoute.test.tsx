import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '../store/auth.store';

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
    tipo: null,
    isAuthenticated: false,
    orgValidada: false,
    isLoading: false,
  });
});

describe('ProtectedRoute guard matrix', () => {
  it('unauthenticated user is redirected to /login', () => {
    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('ADMIN on an ADMIN-only route renders the Outlet (child content)', () => {
    useAuthStore.setState({ isAuthenticated: true, tipo: 'ADMINISTRADOR' });

    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('DONANTE on an ADMIN-only route is redirected (role not in allow list)', () => {
    useAuthStore.setState({ isAuthenticated: true, tipo: 'DONANTE' });

    const router = buildRouter({ allow: ['ADMINISTRADOR'] });
    render(<RouterProvider router={router} />);

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Default redirectTo='/' → Home Page
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('unvalidated REFERENTE on a requireValidated route is redirected to /pending-validation', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      tipo: 'REFERENTE',
      orgValidada: false,
    });

    const router = buildRouter(
      { allow: ['ADMINISTRADOR', 'REFERENTE'], requireValidated: true },
      '/needs',
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Pending Validation Page')).toBeInTheDocument();
    expect(screen.queryByText('Needs Content')).not.toBeInTheDocument();
  });
});
