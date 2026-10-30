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

describe('UsersPage (M2: optional motivo)', () => {
  beforeEach(() => {
    mutate.mockReset();
    anonimizar.mockReset();
    vi.mocked(useUsuarios).mockReturnValue({
      data: { content: [usuario()], number: 0, size: 20, totalElements: 1, totalPages: 1 },
      isLoading: false, isError: false, isFetching: false,
    } as unknown as ReturnType<typeof useUsuarios>);
    vi.mocked(useToggleActivo).mockReturnValue({
      mutate, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useToggleActivo>);
    vi.mocked(useAnonimizarUsuario).mockReturnValue({
      mutate: anonimizar, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useAnonimizarUsuario>);
  });

  it('asks for an optional motivo and sends it with the toggle', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(mutate).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Motivo (opcional)'), 'abuso reiterado');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(mutate).toHaveBeenCalledWith({ id: 7, activo: false, motivo: 'abuso reiterado' });
  });

  it('omits motivo when left blank', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(mutate).toHaveBeenCalledWith({ id: 7, activo: false });
  });

  it('cancel closes the form without mutating', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument();
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
        number: 0, size: 20, totalElements: 3, totalPages: 1,
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

  it('explains the action is irreversible and only mutates after confirming', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getAllByRole('button', { name: 'Anonimizar' })[0]);

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/no se puede deshacer/i);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Dora Donante');
    expect(anonimizar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Anonimizar definitivamente' }));

    expect(anonimizar).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancel closes the confirmation without mutating', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getAllByRole('button', { name: 'Anonimizar' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(anonimizar).not.toHaveBeenCalled();
  });

  it('is disabled for your own account and for an already anonymized one', () => {
    render(<UsersPage />);

    const botones = screen.getAllByRole('button', { name: 'Anonimizar' });
    expect(botones).toHaveLength(3);
    expect(botones[0]).toBeEnabled();
    expect(botones[1]).toBeDisabled(); // anonymized
    expect(botones[2]).toBeDisabled(); // myself
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
        number: 0, size: 20, totalElements: params.q ? 0 : 1, totalPages: params.q ? 0 : 1,
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
    expect(useUsuarios).toHaveBeenLastCalledWith({ page: 0, size: 20, q: '' });

    fireEvent.change(screen.getByLabelText('Buscar por nombre o email'), { target: { value: ' dora ' } });
    expect(useUsuarios).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'dora' }));

    act(() => { vi.advanceTimersByTime(300); });

    expect(useUsuarios).toHaveBeenLastCalledWith({ page: 0, size: 20, q: 'dora' });
  });

  it('keeps the search box and shows the no-match label when the server returns nothing', () => {
    render(<UsersPage />);

    fireEvent.change(screen.getByLabelText('Buscar por nombre o email'), { target: { value: 'zzz' } });
    act(() => { vi.advanceTimersByTime(300); });

    expect(screen.getByLabelText('Buscar por nombre o email')).toBeInTheDocument();
    expect(screen.getByText('No hay usuarios que coincidan con la búsqueda')).toBeInTheDocument();
  });
});
