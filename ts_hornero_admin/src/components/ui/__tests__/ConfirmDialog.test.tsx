import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

function Harness({
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
  loading = false,
}: {
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <ConfirmDialog
        open={open}
        title="¿Eliminar?"
        description="No se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={loading}
        onConfirm={onConfirm}
        onCancel={() => { onCancel(); setOpen(false); }}
      />
    </div>
  );
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed and a labelled modal alertdialog when open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('No se puede deshacer.');
  });

  it('focuses the safe button first and returns focus to the opener on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);

    expect(screen.getByRole('button', { name: 'Volver' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('calls onConfirm from the confirm button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels with Escape and with the scrim', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByTestId('confirm-dialog-scrim'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('does not dismiss while loading', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} loading />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('confirm-dialog-scrim'));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('button', { name: 'Volver' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Volver' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toHaveFocus();
  });
});
