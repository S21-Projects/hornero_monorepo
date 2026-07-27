import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the given title', () => {
    render(<EmptyState title="Sin resultados" />);

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('renders the message when provided', () => {
    render(<EmptyState title="Sin resultados" message="Todavía no hay nada acá." />);

    expect(screen.getByText('Todavía no hay nada acá.')).toBeInTheDocument();
  });

  it('renders custom illustration when provided', () => {
    render(<EmptyState title="Sin resultados" illustration={<span>🪺</span>} />);

    expect(screen.getByText('🪺')).toBeInTheDocument();
  });

  it('does not render an action button when action is not provided', () => {
    render(<EmptyState title="Sin resultados" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button that calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState title="Sin resultados" action={{ label: 'Crear uno', onClick }} />);

    await user.click(screen.getByRole('button', { name: 'Crear uno' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
