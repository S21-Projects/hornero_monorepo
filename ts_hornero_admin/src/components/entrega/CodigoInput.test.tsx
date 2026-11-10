import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodigoInput } from './CodigoInput';

/**
 * Spec `donacion-entrega-codigo` — "Typed fallback verifies identically to a scan": always
 * rendered (not only on error), 6-digit numeric, OTP-friendly autofill attributes, 44px touch
 * target per the mockup's accessibility note.
 */
describe('CodigoInput', () => {
  it('renders a 6-digit numeric input with OTP autofill attributes', () => {
    render(<CodigoInput onSubmit={vi.fn()} />);

    const input = screen.getByLabelText(/código/i);
    expect(input).toHaveAttribute('inputMode', 'numeric');
    expect(input).toHaveAttribute('autoComplete', 'one-time-code');
    expect(input).toHaveAttribute('maxLength', '6');
  });

  it('submits the typed 6-digit code', async () => {
    const onSubmit = vi.fn();
    render(<CodigoInput onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/código/i), '482913');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith('482913');
  });

  it('keeps the submit button disabled until 6 digits are entered', async () => {
    render(<CodigoInput onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    const boton = screen.getByRole('button', { name: /confirmar/i });

    expect(boton).toBeDisabled();
    await user.type(screen.getByLabelText(/código/i), '1234');
    expect(boton).toBeDisabled();
    await user.type(screen.getByLabelText(/código/i), '56');
    expect(boton).not.toBeDisabled();
  });

  it('strips non-digit characters as they are typed', async () => {
    render(<CodigoInput onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/código/i), '4a8-2 91b3');

    expect(screen.getByLabelText(/código/i)).toHaveValue('482913');
  });

  it('is disabled when the disabled prop is set', () => {
    render(<CodigoInput onSubmit={vi.fn()} disabled />);

    expect(screen.getByLabelText(/código/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });
});
