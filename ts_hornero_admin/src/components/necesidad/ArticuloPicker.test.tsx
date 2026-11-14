import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticuloPicker } from './ArticuloPicker';
import { useArticulos } from '../../lib/hooks/useArticulos';
import type { Articulo } from '../../types/domain';

// Work unit H (feature catalogo-articulos): the necesidad create/edit form's articulo
// multi-select — grouped by categoría, shows the derived categoría, requires ≥1 selection.
vi.mock('../../lib/hooks/useArticulos', () => ({ useArticulos: vi.fn() }));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };
const YOGUR: Articulo = { id: 2, nombre: 'Yogur', categoria: 'REFRIGERADO', unidad: 'LITRO', activo: true };

describe('ArticuloPicker', () => {
  beforeEach(() => {
    vi.mocked(useArticulos).mockReturnValue({
      data: [ARROZ, YOGUR],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useArticulos>);
  });

  it('lists active articulos grouped by categoría', () => {
    render(<ArticuloPicker selectedIds={[]} onChange={vi.fn()} />);

    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('Yogur')).toBeInTheDocument();
    expect(screen.getByText('No perecedero')).toBeInTheDocument();
    expect(screen.getByText('Refrigerado')).toBeInTheDocument();
  });

  it('calls onChange with the toggled id added', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ArticuloPicker selectedIds={[]} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Arroz' }));

    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it('calls onChange with the toggled id removed when already selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ArticuloPicker selectedIds={[1, 2]} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Arroz' }));

    expect(onChange).toHaveBeenCalledWith([2]);
  });

  it('shows the derived categoría for the current selection', () => {
    render(<ArticuloPicker selectedIds={[1, 2]} onChange={vi.fn()} />);

    expect(screen.getByText('Categoría:')).toBeInTheDocument();
    expect(screen.getAllByText('Refrigerado').length).toBeGreaterThan(0);
  });

  it('reflects the selection on the checkboxes and allows mixing categories', () => {
    render(<ArticuloPicker selectedIds={[1, 2]} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Yogur' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeEnabled();
  });

  it('shows an error message when provided', () => {
    render(<ArticuloPicker selectedIds={[]} onChange={vi.fn()} error="Elegí al menos un artículo." />);

    expect(screen.getByText('Elegí al menos un artículo.')).toBeInTheDocument();
  });
});
