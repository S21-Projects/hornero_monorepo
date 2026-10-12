import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import OlvideContrasenaPage from './olvide-contrasena';
import { api } from '../lib/axios';

vi.mock('../lib/axios', () => ({
  api: { post: vi.fn() },
}));

const GENERICO = /Si el email está registrado, te enviamos un enlace/;

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/olvide-contrasena', element: <OlvideContrasenaPage /> },
      { path: '/login', element: <div>Login Page</div> },
    ],
    { initialEntries: ['/olvide-contrasena'] },
  );
  render(<RouterProvider router={router} />);
}

describe('OlvideContrasenaPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('posts the email to /auth/password/olvido and shows the generic confirmation', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { mensaje: 'x' } });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(api.post).toHaveBeenCalledWith('/auth/password/olvido', { email: 'ana@example.com' });
    expect(await screen.findByText(GENERICO)).toBeInTheDocument();
    // the form is gone: no second submit, nothing that hints at account existence
    expect(screen.queryByRole('button', { name: 'Enviar enlace' })).not.toBeInTheDocument();
  });

  it('shows the same confirmation whatever the server answers about the account (no oracle)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'nadie@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(GENERICO)).toBeInTheDocument();
  });

  it('tells the user to wait when rate limited (429)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 429 } });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument();
    expect(screen.queryByText(GENERICO)).not.toBeInTheDocument();
  });

  it('shows a generic error when the request fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(/No pudimos procesar el pedido/)).toBeInTheDocument();
  });

  it('links back to the login', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Volver a ingresar/ })).toHaveAttribute('href', '/login');
  });
});
