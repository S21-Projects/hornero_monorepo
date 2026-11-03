import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaginatedTable } from '../PaginatedTable';
import type { Column } from '../PaginatedTable';

interface Fruta {
  id: number;
  nombre: string;
}

interface Persona {
  legajo: string;
  apellido: string;
  edad: number;
}

const frutaColumns: Column<Fruta>[] = [
  { key: 'nombre', header: 'Nombre', render: (f) => f.nombre },
];

const personaColumns: Column<Persona>[] = [
  { key: 'apellido', header: 'Apellido', render: (p) => p.apellido },
  { key: 'edad', header: 'Edad', align: 'right', render: (p) => String(p.edad) },
];

describe('PaginatedTable', () => {
  it('renders rows for one row type (genericity proof #1)', () => {
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }, { id: 2, nombre: 'Manzana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 20, totalElements: 2, totalPages: 1 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Manzana')).toBeInTheDocument();
  });

  it('renders rows for a second, unrelated row type (genericity proof #2)', () => {
    const personas: Persona[] = [{ legajo: 'A1', apellido: 'Gómez', edad: 30 }];
    render(
      <PaginatedTable
        columns={personaColumns}
        rows={personas}
        rowKey={(p) => p.legajo}
        page={{ number: 0, size: 20, totalElements: 1, totalPages: 1 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Gómez')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders the empty label when there are no rows', () => {
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={[]}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 20, totalElements: 0, totalPages: 0 }}
        onPageChange={vi.fn()}
        emptyLabel="Nada por acá"
      />,
    );

    expect(screen.getByText('Nada por acá')).toBeInTheDocument();
  });

  it('does not render Pager controls when there is only one page', () => {
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 20, totalElements: 1, totalPages: 1 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument();
  });

  it('disables "Anterior" on the first page and "Siguiente" on the last page', () => {
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 1, totalElements: 2, totalPages: 2 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).not.toBeDisabled();
  });

  it('calls onPageChange with the new 0-indexed page when "Siguiente" is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 1, totalElements: 2, totalPages: 2 }}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('renders a search input and reports changes via onChange (caller filters)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 20, totalElements: 1, totalPages: 1 }}
        onPageChange={vi.fn()}
        search={{ value: '', onChange, placeholder: 'Buscar fruta' }}
      />,
    );

    await user.type(screen.getByPlaceholderText('Buscar fruta'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders rowActions in a trailing column', () => {
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 20, totalElements: 1, totalPages: 1 }}
        onPageChange={vi.fn()}
        rowActions={(f) => <button>Editar {f.nombre}</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Editar Banana' })).toBeInTheDocument();
  });

  it('renders the row detail only for rows present in expandedKeys', () => {
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }, { id: 2, nombre: 'Manzana' }];
    render(
      <PaginatedTable
        columns={frutaColumns}
        rows={frutas}
        rowKey={(f) => f.id}
        page={{ number: 0, size: 20, totalElements: 2, totalPages: 1 }}
        onPageChange={vi.fn()}
        renderRowDetail={(f) => <span>Detalle de {f.nombre}</span>}
        expandedKeys={new Set([1])}
      />,
    );

    expect(screen.getByText('Detalle de Banana')).toBeInTheDocument();
    expect(screen.queryByText('Detalle de Manzana')).not.toBeInTheDocument();
  });

  describe('row click', () => {
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }, { id: 2, nombre: 'Manzana' }];
    const page = { number: 0, size: 20, totalElements: 2, totalPages: 1 };

    it('calls onRowClick when clicking anywhere on the row', async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      render(
        <PaginatedTable columns={frutaColumns} rows={frutas} rowKey={(f) => f.id} page={page}
          onPageChange={vi.fn()} onRowClick={onRowClick} />,
      );

      await user.click(screen.getByText('Manzana'));

      expect(onRowClick).toHaveBeenCalledWith(frutas[1]);
    });

    it('opens with Enter and Space on the focused row', async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      render(
        <PaginatedTable columns={frutaColumns} rows={frutas} rowKey={(f) => f.id} page={page}
          onPageChange={vi.fn()} onRowClick={onRowClick} />,
      );
      const row = screen.getByText('Banana').closest('tr') as HTMLElement;
      row.focus();

      await user.keyboard('{Enter}');
      await user.keyboard(' ');

      expect(onRowClick).toHaveBeenCalledTimes(2);
      expect(onRowClick).toHaveBeenCalledWith(frutas[0]);
    });

    it('does not trigger the row when a button inside it is used', async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      const inner = vi.fn();
      render(
        <PaginatedTable columns={frutaColumns} rows={frutas} rowKey={(f) => f.id} page={page}
          onPageChange={vi.fn()} onRowClick={onRowClick}
          rowActions={(f) => <button onClick={inner}>Editar {f.nombre}</button>} />,
      );

      await user.click(screen.getByRole('button', { name: 'Editar Banana' }));
      screen.getByRole('button', { name: 'Editar Banana' }).focus();
      await user.keyboard('{Enter}');

      expect(inner).toHaveBeenCalledTimes(2);
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('highlights the selected row', () => {
      render(
        <PaginatedTable columns={frutaColumns} rows={frutas} rowKey={(f) => f.id} page={page}
          onPageChange={vi.fn()} onRowClick={vi.fn()} selectedKey={2} />,
      );

      expect(screen.getByText('Manzana').closest('tr')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByText('Banana').closest('tr')).not.toHaveAttribute('data-selected');
    });

    it('rows are not interactive without onRowClick', () => {
      render(
        <PaginatedTable columns={frutaColumns} rows={frutas} rowKey={(f) => f.id} page={page}
          onPageChange={vi.fn()} />,
      );

      expect(screen.getByText('Banana').closest('tr')).not.toHaveAttribute('tabindex');
    });
  });

  describe('loading states', () => {
    const meta = { number: 0, size: 10, totalElements: 0, totalPages: 0 };
    const frutas: Fruta[] = [{ id: 1, nombre: 'Banana' }];

    it('shows skeleton rows on first load while header and toolbar stay visible', () => {
      render(
        <PaginatedTable
          columns={frutaColumns}
          rows={[]}
          rowKey={(f) => f.id}
          page={meta}
          onPageChange={vi.fn()}
          search={{ value: '', onChange: vi.fn(), placeholder: 'Buscar fruta' }}
          isLoading
          emptyLabel="Sin frutas"
        />,
      );

      expect(screen.getAllByTestId('table-skeleton-row').length).toBeGreaterThan(0);
      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.getByLabelText('Buscar fruta')).toBeInTheDocument();
      expect(screen.queryByText('Sin frutas')).not.toBeInTheDocument();
    });

    it('keeps previous rows, shows a progress bar and marks the table busy while refetching', () => {
      render(
        <PaginatedTable
          columns={frutaColumns}
          rows={frutas}
          rowKey={(f) => f.id}
          page={{ ...meta, totalElements: 1, totalPages: 1 }}
          onPageChange={vi.fn()}
          isFetching
        />,
      );

      expect(screen.getByText('Banana')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Actualizando resultados' })).toBeInTheDocument();
      expect(screen.getByRole('table').parentElement).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByTestId('table-skeleton-row')).not.toBeInTheDocument();
    });

    it('does not show the progress bar when idle', () => {
      render(
        <PaginatedTable columns={frutaColumns} rows={frutas} rowKey={(f) => f.id} page={meta} onPageChange={vi.fn()} />,
      );
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows an error panel with a retry action', async () => {
      const onRetry = vi.fn();
      render(
        <PaginatedTable
          columns={frutaColumns}
          rows={[]}
          rowKey={(f) => f.id}
          page={meta}
          onPageChange={vi.fn()}
          isError
          onRetry={onRetry}
        />,
      );

      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
