import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './register';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/auth.store';

vi.mock('../lib/axios', () => ({
  api: { post: vi.fn() },
}));

// The Leaflet-backed picker needs real DOM measurement APIs that jsdom
// doesn't provide; the org-creation flow itself doesn't depend on Leaflet
// internals, so it's swapped for a deterministic stub that fires onPick once.
vi.mock('../components/map/OrgLocationPickerLazy', () => ({
  OrgLocationPickerLazy: ({ onPick }: { onPick: (latlng: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onPick({ lat: -31.4, lng: -64.18 })}>
      Fijar ubicación (test)
    </button>
  ),
}));

function buildRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/register', element: <RegisterPage /> },
      { path: '/', element: <div>Root</div> },
    ],
    { initialEntries: ['/register'] },
  );
  return { router, queryClient };
}

function renderRegister() {
  const { router, queryClient } = buildRouter();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function goToReferenteOrgStep() {
  renderRegister();
  const user = userEvent.setup();

  await user.click(screen.getByText('Tengo una organización'));
  await user.click(screen.getByRole('button', { name: 'Continuar' }));

  await user.type(screen.getByLabelText('Nombre completo'), 'Ana García');
  await user.type(screen.getByLabelText('Email'), 'ana@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'la cafetera azul canta');
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'la cafetera azul canta');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByText('Tu organización')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Nombre de la organización'), 'Comedor Los Hornitos');
  await user.selectOptions(screen.getByLabelText('Tipo de organización'), 'COMEDOR');
  await user.type(screen.getByLabelText('Dirección'), 'Av. Colón 1234');
  await user.click(screen.getByText('Fijar ubicación (test)'));

  return user;
}

describe('RegisterPage — referente org step + partial-failure retry', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      status: 'unauthenticated',
      orgValidada: false,
      orgChecked: false,
      orgCount: 0,
    });
    vi.mocked(api.post).mockReset();
  });

  it('shows the org-error retry screen (not a dead end) when POST /organizaciones fails after account creation', async () => {
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/auth/register') return Promise.resolve({ data: {} });
      if (url === '/auth/login') return Promise.resolve({ data: {} });
      if (url === '/organizaciones') return Promise.reject(new Error('network error'));
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    const user = await goToReferenteOrgStep();
    await user.click(screen.getByRole('button', { name: 'Postular organización' }));

    expect(await screen.findByText('Cuenta creada, pero...')).toBeInTheDocument();
    // The account step must not be required again — no credential fields present.
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });

  it('retry succeeds without re-submitting credentials, then resolves auth status on "Ir a mi panel"', async () => {
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/auth/register') return Promise.resolve({ data: {} });
      if (url === '/auth/login') return Promise.resolve({ data: {} });
      if (url === '/organizaciones') return Promise.reject(new Error('network error'));
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    const user = await goToReferenteOrgStep();
    await user.click(screen.getByRole('button', { name: 'Postular organización' }));
    expect(await screen.findByText('Cuenta creada, pero...')).toBeInTheDocument();

    // Now let the retry succeed.
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/organizaciones') return Promise.resolve({ data: { id: 1 } });
      return Promise.resolve({ data: {} });
    });
    const loadUserSpy = vi.spyOn(useAuthStore.getState(), 'loadUser').mockImplementation(async () => {
      useAuthStore.setState({ status: 'authenticated' });
    });

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('¡Solicitud enviada!')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Comedor Los Hornitos ya está registrado(a)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Más tarde' }));

    await waitFor(() => expect(loadUserSpy).toHaveBeenCalled());
  });

  it('DONANTE registration is unchanged — no org step, navigates straight to /login on submit', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider
          router={createMemoryRouter(
            [
              { path: '/register', element: <RegisterPage /> },
              { path: '/login', element: <div>Login Page</div> },
            ],
            { initialEntries: ['/register'] },
          )}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByText('Quiero donar'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await user.type(screen.getByLabelText('Nombre completo'), 'Juan Pérez');
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'la cafetera azul canta');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'la cafetera azul canta');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ tipo: 'DONANTE' }));
    expect(api.post).not.toHaveBeenCalledWith('/auth/login', expect.anything());
  });
});

describe('RegisterPage — Bienvenida acreditación step (3rd step, referente only)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      status: 'unauthenticated',
      orgValidada: false,
      orgChecked: false,
      orgCount: 0,
    });
    vi.mocked(api.post).mockReset();
  });

  it('renders a 3rd "Acreditación" step after successful org creation, with the CTA navigating to /acreditacion', async () => {
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/organizaciones') return Promise.resolve({ data: { id: 42 } });
      return Promise.resolve({ data: {} });
    });
    const loadUserSpy = vi
      .spyOn(useAuthStore.getState(), 'loadUser')
      .mockImplementation(async () => {
        useAuthStore.setState({ status: 'authenticated' });
      });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(
      [
        { path: '/register', element: <RegisterPage /> },
        { path: '/acreditacion', element: <div>Acreditacion Page</div> },
      ],
      { initialEntries: ['/register'] },
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByText('Tengo una organización'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana García');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'la cafetera azul canta');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'la cafetera azul canta');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText('Nombre de la organización'), 'Comedor Los Hornitos');
    await user.selectOptions(screen.getByLabelText('Tipo de organización'), 'COMEDOR');
    await user.type(screen.getByLabelText('Dirección'), 'Av. Colón 1234');
    await user.click(screen.getByText('Fijar ubicación (test)'));
    await user.click(screen.getByRole('button', { name: 'Postular organización' }));

    expect(await screen.findByText('¡Solicitud enviada!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByText('Comedor Los Hornitos ya está registrado(a)'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Empezar con N1' }));

    expect(await screen.findByText('Acreditacion Page')).toBeInTheDocument();
    expect(loadUserSpy).toHaveBeenCalled();
  });

  it('shows a 3-stage step indicator for REFERENTE and a 2-stage one for DONANTE', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByText('Tengo una organización'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows a 2-stage step indicator for DONANTE', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByText('Quiero donar'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('RegisterPage — password policy (NIST SP 800-63B-4)', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  async function fillAccount(user: ReturnType<typeof userEvent.setup>, password: string) {
    await user.click(screen.getByText('Quiero donar'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Juan Pérez');
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.type(screen.getByLabelText('Contraseña'), password);
    await user.type(screen.getByLabelText('Confirmar contraseña'), password);
  }

  it('shows the rule under the password field', async () => {
    renderRegister();
    const user = userEvent.setup();
    await user.click(screen.getByText('Quiero donar'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      screen.getByText('Mínimo 15 caracteres. Podés usar una frase; no hace falta mezclar símbolos.'),
    ).toBeInTheDocument();
  });

  it('blocks a 14-character password client-side without calling the API', async () => {
    renderRegister();
    const user = userEvent.setup();
    await fillAccount(user, 'a1b2c3d4e5f6g7');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('La contraseña debe tener al menos 15 caracteres.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('maps the MS PASSWORD_COMUN code to Spanish copy on the password field', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { message: 'PASSWORD_COMUN' } } });
    renderRegister();
    const user = userEvent.setup();
    await fillAccount(user, 'qwertyuiopasdfghjkl');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(
      await screen.findByText('Esa contraseña es demasiado común o predecible. Probá con una frase más personal.'),
    ).toBeInTheDocument();
  });

  it('returns a referente to the account step when the MS rejects the password', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 400, data: { message: 'PASSWORD_CONTIENE_DATOS_PERSONALES' } },
    });
    renderRegister();
    const user = userEvent.setup();
    await user.click(screen.getByText('Tengo una organización'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana García');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'mi-ana-clave-segura-1');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'mi-ana-clave-segura-1');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(await screen.findByLabelText('Nombre de la organización'), 'Comedor X');
    await user.selectOptions(screen.getByLabelText('Tipo de organización'), 'COMEDOR');
    await user.type(screen.getByLabelText('Dirección'), 'Av. Colón 1234');
    await user.click(screen.getByText('Fijar ubicación (test)'));
    await user.click(screen.getByRole('button', { name: 'Postular organización' }));

    expect(
      await screen.findByText('La contraseña no puede incluir tu nombre, tu email ni el nombre de Hornero.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });
});
