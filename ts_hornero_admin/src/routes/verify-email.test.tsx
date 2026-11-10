import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import VerifyEmailPage from './verify-email';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser } from '../store/auth.store';

vi.mock('../lib/axios', () => ({
  api: { post: vi.fn() },
}));

const REFERENTE_USER: AuthUser = {
  userId: 3,
  email: 'ref@example.com',
  nombre: 'Ref',
  tipo: 'REFERENTE',
  emailVerificado: false,
};

function buildRouter(initialState?: unknown) {
  return createMemoryRouter(
    [
      {
        path: '/verify-email',
        element: <VerifyEmailPage />,
      },
      { path: '/acreditacion', element: <div>Acreditacion Page</div> },
      { path: '/dashboard', element: <div>Referente Dashboard</div> },
      { path: '/', element: <div>Home Page</div> },
    ],
    {
      initialEntries: [{ pathname: '/verify-email', state: initialState }],
    },
  );
}

async function submitCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Código de verificación'), '123456');
  await user.click(screen.getByRole('button', { name: 'Verificar' }));
}

describe('VerifyEmailPage — navigates to state.from after successful verification', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: REFERENTE_USER,
      status: 'authenticated',
      orgValidada: false,
      orgChecked: false,
    });
    vi.mocked(api.post).mockReset();
  });

  it('navigates to state.from when it is an internal path', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.spyOn(useAuthStore.getState(), 'loadUser').mockImplementation(async () => {
      useAuthStore.setState({
        user: { ...REFERENTE_USER, emailVerificado: true },
      });
    });
    const user = userEvent.setup();

    render(<RouterProvider router={buildRouter({ from: '/acreditacion' })} />);
    await submitCode(user);

    expect(await screen.findByText('Acreditacion Page')).toBeInTheDocument();
  });

  it('navigates to roleHome when there is no state.from', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.spyOn(useAuthStore.getState(), 'loadUser').mockImplementation(async () => {
      useAuthStore.setState({
        user: { ...REFERENTE_USER, emailVerificado: true },
      });
    });
    const user = userEvent.setup();

    render(<RouterProvider router={buildRouter(undefined)} />);
    await submitCode(user);

    expect(await screen.findByText('Referente Dashboard')).toBeInTheDocument();
  });
});
