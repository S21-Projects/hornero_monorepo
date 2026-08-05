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
});
