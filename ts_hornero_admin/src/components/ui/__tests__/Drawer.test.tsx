import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from '../Drawer';

function Harness({ onClose = vi.fn(), withTabs = false }: { onClose?: () => void; withTabs?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('a');
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Drawer
        open={open}
        onClose={() => { onClose(); setOpen(false); }}
        eyebrow="Reclamo"
        title="Título"
        status={<span>Estado</span>}
        tabs={withTabs ? [{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos' }] : undefined}
        activeTab={tab}
        onTabChange={setTab}
        footer={<button>Acción</button>}
      >
        <p>{tab === 'a' ? 'Contenido A' : 'Contenido B'}</p>
      </Drawer>
    </div>
  );
}

describe('Drawer', () => {
  it('renders nothing while closed and a labelled modal dialog when open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    const dialog = screen.getByRole('dialog', { name: 'Título' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Contenido A')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes with the scrim and with the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByTestId('drawer-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus into the dialog and gives it back to the opener on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);

    expect(screen.getByRole('dialog')).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('switches tabs', async () => {
    const user = userEvent.setup();
    render(<Harness withTabs />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Dos' }));

    expect(screen.getByRole('tab', { name: 'Dos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Contenido B')).toBeInTheDocument();
  });
});
