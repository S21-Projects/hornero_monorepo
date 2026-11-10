import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineaArticuloEditor } from './LineaArticuloEditor';
import { useArticulos } from '../../lib/hooks/useArticulos';
import type { Articulo, DonacionLineaInput } from '../../types/domain';

function Controlled({ initial, onChange }: { initial: DonacionLineaInput[]; onChange: (l: DonacionLineaInput[]) => void }) {
  const [lineas, setLineas] = useState(initial);
  return (
    <LineaArticuloEditor
      lineas={lineas}
      onChange={(next) => { setLineas(next); onChange(next); }}
    />
  );
}

vi.mock('../../lib/hooks/useArticulos', () => ({ useArticulos: vi.fn() }));

const ARROZ: Articulo = { id: 1, nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG', activo: true };
const YOGUR: Articulo = { id: 2, nombre: 'Yogur', categoria: 'REFRIGERADO', unidad: 'LITRO', activo: true };
const POLLO: Articulo = { id: 3, nombre: 'Pollo congelado', categoria: 'CONGELADO', unidad: 'KG', activo: true };

function mockArticulos(data: Articulo[]) {
  vi.mocked(useArticulos).mockReturnValue({ data, isLoading: false, isError: false } as ReturnType<typeof useArticulos>);
}

describe('LineaArticuloEditor', () => {
  beforeEach(() => {
    mockArticulos([ARROZ, YOGUR, POLLO]);
  });

  it('starts with no rows and an "Agregar artículo" button', () => {
    render(<LineaArticuloEditor lineas={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar artículo/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('adds a row calling onChange with an appended empty line', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LineaArticuloEditor lineas={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /agregar artículo/i }));

    expect(onChange).toHaveBeenCalledWith([{ articuloId: 0, cantidad: 1 }]);
  });

  it('renders one row per línea with an articulo select and a cantidad input', () => {
    render(<LineaArticuloEditor lineas={[{ articuloId: 1, cantidad: 2 }]} onChange={vi.fn()} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByText(/kg/i)).toBeInTheDocument();
  });

  it('changing the articulo select calls onChange with the updated articuloId', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LineaArticuloEditor lineas={[{ articuloId: 1, cantidad: 2 }]} onChange={onChange} />);

    await user.selectOptions(screen.getByRole('combobox'), '2');

    expect(onChange).toHaveBeenCalledWith([{ articuloId: 2, cantidad: 2 }]);
  });

  it('changing cantidad calls onChange with the updated value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={[{ articuloId: 1, cantidad: 2 }]} onChange={onChange} />);

    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '5');

    expect(onChange).toHaveBeenLastCalledWith([{ articuloId: 1, cantidad: 5 }]);
  });

  it('removes a row and calls onChange with it gone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LineaArticuloEditor
        lineas={[{ articuloId: 1, cantidad: 2 }, { articuloId: 2, cantidad: 1 }]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /quitar/i })[0]);

    expect(onChange).toHaveBeenCalledWith([{ articuloId: 2, cantidad: 1 }]);
  });

  it('shows the derived categoria as the most demanding of the selected articulos', () => {
    render(
      <LineaArticuloEditor
        lineas={[{ articuloId: 1, cantidad: 2 }, { articuloId: 2, cantidad: 1 }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/refrigerado/i)).toBeInTheDocument();
  });

  it('restricts the articulo options to articulosPermitidosIds when provided', () => {
    render(
      <LineaArticuloEditor
        lineas={[{ articuloId: 2, cantidad: 1 }]}
        onChange={vi.fn()}
        articulosPermitidosIds={[2, 3]}
      />,
    );

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.some((t) => t?.includes('Yogur'))).toBe(true);
    expect(options.some((t) => t?.includes('Pollo'))).toBe(true);
    expect(options.some((t) => t?.includes('Arroz'))).toBe(false);
  });

  it('shows an external error message when provided', () => {
    render(<LineaArticuloEditor lineas={[]} onChange={vi.fn()} error="Agregá al menos un artículo." />);

    expect(screen.getByText(/agregá al menos un artículo/i)).toBeInTheDocument();
  });
});
