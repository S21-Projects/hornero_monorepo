import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from './users';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useToggleActivo } from '../lib/hooks/useToggleActivo';

vi.mock('../lib/hooks/useUsuarios', () => ({ useUsuarios: vi.fn() }));
vi.mock('../lib/hooks/useToggleActivo', () => ({ useToggleActivo: vi.fn() }));
vi.mock('../lib/hooks/usePageClamp', () => ({ usePageClamp: vi.fn() }));

const mutate = vi.fn();

const usuario = (over = {}) => ({
  id: 7, nombre: 'Dora Donante', email: 'dora@test.com', tipo: 'DONANTE', activo: true, ...over,
});

describe('UsersPage (M2: optional motivo)', () => {
  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(useUsuarios).mockReturnValue({
      data: { content: [usuario()], number: 0, size: 20, totalElements: 1, totalPages: 1 },
      isLoading: false, isError: false, isFetching: false,
    } as unknown as ReturnType<typeof useUsuarios>);
    vi.mocked(useToggleActivo).mockReturnValue({
      mutate, isPending: false, isError: false, variables: undefined, error: null,
    } as unknown as ReturnType<typeof useToggleActivo>);
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
