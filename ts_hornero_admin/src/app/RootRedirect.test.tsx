import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootRedirect } from './RootRedirect';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser } from '../store/auth.store';

const ADMIN_USER: AuthUser = { userId: 1, email: 'admin@test.com', nombre: 'Admin', tipo: 'ADMINISTRADOR' };
const DONANTE_USER: AuthUser = { userId: 2, email: 'd@test.com', nombre: 'Donante', tipo: 'DONANTE' };
const REFERENTE_USER: AuthUser = { userId: 3, email: 'r@test.com', nombre: 'Ref', tipo: 'REFERENTE' };

function buildRouter() {
  return createMemoryRouter(
    [
      { path: '/', element: <RootRedirect /> },
      { path: '/login', element: <div>Login Page</div> },
      { path: '/admin', element: <div>Admin Home</div> },
      { path: '/dashboard', element: <div>Referente Dashboard</div> },
      { path: '/explorar', element: <div>Explorar Page</div> },
    ],
    { initialEntries: ['/'] },
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    status: 'unauthenticated',
    orgValidada: false,
    orgChecked: false,
  });
});

describe('RootRedirect', () => {
  it('renders a loader while status is loading', () => {
    useAuthStore.setState({ status: 'loading' });

    render(<RouterProvider router={buildRouter()} />);

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('redirects an unauthenticated visitor to /login', () => {
    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects an authenticated ADMINISTRADOR to /admin', () => {
    useAuthStore.setState({ status: 'authenticated', user: ADMIN_USER });

    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });

  it('redirects an authenticated REFERENTE to /dashboard', () => {
    useAuthStore.setState({ status: 'authenticated', user: REFERENTE_USER });

    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByText('Referente Dashboard')).toBeInTheDocument();
  });

  it('redirects an authenticated DONANTE to /explorar', () => {
    useAuthStore.setState({ status: 'authenticated', user: DONANTE_USER });

    render(<RouterProvider router={buildRouter()} />);

    expect(screen.getByText('Explorar Page')).toBeInTheDocument();
  });
});
