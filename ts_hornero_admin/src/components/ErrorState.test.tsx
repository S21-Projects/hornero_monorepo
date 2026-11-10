import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders default title and message', () => {
    render(<ErrorState />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(
      screen.getByText('Ocurrió un error inesperado. Intentá de nuevo en unos momentos.'),
    ).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(<ErrorState title="No se pudo cargar" message="Revisá tu conexión." />);

    expect(screen.getByText('No se pudo cargar')).toBeInTheDocument();
    expect(screen.getByText('Revisá tu conexión.')).toBeInTheDocument();
  });

  it('does not render a retry button when onRetry is not provided', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a retry button that calls onRetry when clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /intentar de nuevo/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
