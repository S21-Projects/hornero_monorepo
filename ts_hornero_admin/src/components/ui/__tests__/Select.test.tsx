import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from '../Select';

describe('Select', () => {
  it('renders a labelled native select and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Select id="t" label="Tipo" value="" onChange={onChange}>
        <option value="" disabled>Elegí</option>
        <option value="A">Uno</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'A');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports disabled', () => {
    render(
      <Select id="t" label="Tipo" disabled value="A" onChange={() => {}}>
        <option value="A">Uno</option>
      </Select>,
    );
    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(true);
  });
});
