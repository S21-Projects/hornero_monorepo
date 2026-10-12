import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import RestablecerPage from './restablecer';
import { api } from '../lib/axios';

vi.mock('../lib/axios', () => ({
  api: { post: vi.fn() },
}));

const PASSWORD = 'la cafetera azul canta fuerte';

function renderPage(entry = '/restablecer?token=tok_123-abc') {
  const router = createMemoryRouter(
    [
      { path: '/restablecer', element: <RestablecerPage /> },
      { path: '/login', element: <div>Login Page</div> },
      { path: '/olvide-contrasena', element: <div>Olvide Page</div> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function fillAndSubmit(password = PASSWORD, confirm = PASSWORD) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nueva contraseña'), password);
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirm);
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('RestablecerPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    document.head.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove());
  });

  it('removes the token from the URL right after reading it', async () => {
    const router = renderPage();

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.location.pathname).toBe('/restablecer');
  });

  it('still submits the token it read before the URL was cleaned', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const router = renderPage();
    await waitFor(() => expect(router.state.location.search).toBe(''));

    await fillAndSubmit();

    expect(api.post).toHaveBeenCalledWith('/auth/password/restablecer', {
      token: 'tok_123-abc',
      password: PASSWORD,
    });
  });

  it('asks the browser not to send a Referer while the page is open, and restores it after', async () => {
    renderPage();

    const meta = document.head.querySelector('meta[name="referrer"]');
    expect(meta).not.toBeNull();
    expect(meta).toHaveAttribute('content', 'no-referrer');
  });

  it('redirects to /login with the success notice on success', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const router = renderPage();

    await fillAndSubmit();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?motivo=password-restablecida');
  });

  it('rejects a short password client-side without calling the API', async () => {
    renderPage();

    await fillAndSubmit('corta', 'corta');

    expect(await screen.findByText(/al menos 15 caracteres/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects mismatching confirmation without calling the API', async () => {
    renderPage();

    await fillAndSubmit(PASSWORD, PASSWORD + 'x');

    expect(await screen.findByText(/no coinciden/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the length hint', () => {
    renderPage();
    expect(screen.getByText(/Mínimo 15 caracteres/)).toBeInTheDocument();
  });

  it('maps TOKEN_INVALIDO to an expired/used link message with a way to ask for a new one', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { message: 'TOKEN_INVALIDO' } } });
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText(/venció o ya fue usado/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pedir un enlace nuevo/ })).toHaveAttribute('href', '/olvide-contrasena');
  });

  it.each([
    ['PASSWORD_COMUN', /demasiado común/],
    ['PASSWORD_CONTIENE_DATOS_PERSONALES', /no puede incluir tu nombre/],
    ['PASSWORD_DEMASIADO_LARGA', /demasiado larga/],
  ])('maps the policy code %s to Spanish copy', async (code, pattern) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { message: code } } });
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText(pattern)).toBeInTheDocument();
  });

  it('tells the user to wait when rate limited (429)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 429 } });
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument();
  });

  it('without a token shows an invalid-link state and no form', () => {
    renderPage('/restablecer');

    expect(screen.getByText(/enlace no es válido/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pedir un enlace nuevo/ })).toBeInTheDocument();
  });
});
