import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from './users';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useToggleActivo } from '../lib/hooks/useToggleActivo';
import { useAnonimizarUsuario } from '../lib/hooks/useAnonimizarUsuario';
import { useAuthStore } from '../store/auth.store';

vi.mock('../lib/hooks/useUsuarios', () => ({ useUsuarios: vi.fn() }));
vi.mock('../lib/hooks/useToggleActivo', () => ({ useToggleActivo: vi.fn() }));
vi.mock('../lib/hooks/useAnonimizarUsuario', () => ({ useAnonimizarUsuario: vi.fn() }));
vi.mock('../lib/hooks/usePageClamp', () => ({ usePageClamp: vi.fn() }));

const mutate = vi.fn();
const anonimizar = vi.fn();

const usuario = (over = {}) => ({
  id: 7, nombre: 'Dora Donante', email: 'dora@test.com', tipo: 'DONANTE', activo: true, ...over,
});

const abrir = async (user: ReturnType<typeof userEvent.setup>, nombre = 'Dora Donante') => {
  await user.click(screen.getByText(nombre));
};

describe('UsersPage (M2: optional motivo)', () => {
  beforeEach(() => {
    mutate.mockReset();
    anonimizar.mockReset();
    vi.mocked(useUsuarios).mockReturnValue({
      data: { content: [usuario()], number: 0, size: 10, totalElements: 1, totalPages: 1 },
      isLoading: false, isError: false, isFetching: false,
    } as unknown as ReturnType<typeof useUsuarios>);
    vi.mocked(useToggleActivo).mockReturnValue({
      mutate, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useToggleActivo>);
    vi.mocked(useAnonimizarUsuario).mockReturnValue({
      mutate: anonimizar, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useAnonimizarUsuario>);
  });

  it('opens the drawer from a click on the row and shows the account info', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByText('dora@test.com'));

    const dialog = screen.getByRole('dialog', { name: 'Dora Donante' });
    expect(dialog).toHaveTextContent('Donante');
    expect(dialog).toHaveTextContent('dora@test.com');
  });

  it('sends the optional motivo with the toggle and closes', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user);

    await user.type(screen.getByLabelText('Motivo (opcional)'), 'abuso reiterado');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(mutate).toHaveBeenCalledWith({ id: 7, activo: false, motivo: 'abuso reiterado' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('omits motivo when left blank', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(mutate).toHaveBeenCalledWith({ id: 7, activo: false });
  });

  it('closing the drawer does not mutate', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('UsersPage (N15: anonimizar)', () => {
  beforeEach(() => {
    mutate.mockReset();
    anonimizar.mockReset();
    useAuthStore.setState({ user: { userId: 1, email: 'a@a.com', nombre: 'Admin', tipo: 'ADMINISTRADOR', emailVerificado: true } });
    vi.mocked(useUsuarios).mockReturnValue({
      data: {
        content: [
          usuario(),
          usuario({ id: 8, nombre: 'Usuario eliminado', email: 'eliminado-x@anonimo.invalid', activo: false }),
          usuario({ id: 1, nombre: 'Admin', email: 'a@a.com', tipo: 'ADMINISTRADOR' }),
        ],
        number: 0, size: 10, totalElements: 3, totalPages: 1,
      },
      isLoading: false, isError: false, isFetching: false,
    } as unknown as ReturnType<typeof useUsuarios>);
    vi.mocked(useToggleActivo).mockReturnValue({
      mutate, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useToggleActivo>);
    vi.mocked(useAnonimizarUsuario).mockReturnValue({
      mutate: anonimizar, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useAnonimizarUsuario>);
  });

  it('explains the action is irreversible and needs ANONIMIZAR typed before it mutates', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user);

    await user.click(screen.getByRole('button', { name: 'Anonimizar' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/no se puede deshacer/i);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Dora Donante');
    const confirmar = screen.getByRole('button', { name: 'Anonimizar definitivamente' });
    expect(confirmar).toBeDisabled();

    await user.type(screen.getByLabelText(/Escribí ANONIMIZAR/), 'anonimizar');
    expect(confirmar).toBeDisabled();
    await user.clear(screen.getByLabelText(/Escribí ANONIMIZAR/));
    await user.type(screen.getByLabelText(/Escribí ANONIMIZAR/), 'ANONIMIZAR');
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);

    expect(anonimizar).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Volver leaves the confirmation without mutating', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user);

    await user.click(screen.getByRole('button', { name: 'Anonimizar' }));
    await user.click(screen.getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(anonimizar).not.toHaveBeenCalled();
  });

  it('offers no actions for your own account', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user, 'Admin');

    const dialog = screen.getByRole('dialog', { name: 'Admin' });
    expect(dialog).toHaveTextContent(/No podés modificar tu propia cuenta/);
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anonimizar' })).not.toBeInTheDocument();
  });

  it('offers no actions for an already anonymized account', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await abrir(user, 'Usuario eliminado');

    expect(screen.getByRole('dialog')).toHaveTextContent(/ya fue anonimizada/);
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anonimizar' })).not.toBeInTheDocument();
  });

  it('shows the mapped error under the row', () => {
    vi.mocked(useAnonimizarUsuario).mockReturnValue({
      mutate: anonimizar, isPending: false, isError: true, variables: 7,
      error: Object.assign(new Error('x'), { response: { status: 409, data: { message: 'REFERENTE_CON_ORGANIZACIONES' } } }),
    } as unknown as ReturnType<typeof useAnonimizarUsuario>);
    render(<UsersPage />);

    expect(screen.getByText(/Reasigná cada organización/)).toBeInTheDocument();
  });
});

describe('UsersPage (server-side search)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useUsuarios).mockImplementation(((params: { q?: string }) => ({
      data: {
        content: params.q ? [] : [usuario()],
        number: 0, size: 10, totalElements: params.q ? 0 : 1, totalPages: params.q ? 0 : 1,
      },
      isLoading: false, isError: false, isFetching: false,
    })) as unknown as typeof useUsuarios);
    vi.mocked(useToggleActivo).mockReturnValue({
      mutate, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useToggleActivo>);
    vi.mocked(useAnonimizarUsuario).mockReturnValue({
      mutate: anonimizar, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useAnonimizarUsuario>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces the search into the server q param and resets to the first page', () => {
    render(<UsersPage />);
    expect(useUsuarios).toHaveBeenLastCalledWith({ page: 0, size: 10, q: '' });

    fireEvent.change(screen.getByLabelText('Buscar por nombre o email'), { target: { value: ' dora ' } });
    expect(useUsuarios).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'dora' }));

    act(() => { vi.advanceTimersByTime(300); });

    expect(useUsuarios).toHaveBeenLastCalledWith({ page: 0, size: 10, q: 'dora' });
  });

  it('keeps the search box and shows the no-match label when the server returns nothing', () => {
    render(<UsersPage />);

    fireEvent.change(screen.getByLabelText('Buscar por nombre o email'), { target: { value: 'zzz' } });
    act(() => { vi.advanceTimersByTime(300); });

    expect(screen.getByLabelText('Buscar por nombre o email')).toBeInTheDocument();
    expect(screen.getByText('No hay usuarios que coincidan con la búsqueda')).toBeInTheDocument();
  });
});
