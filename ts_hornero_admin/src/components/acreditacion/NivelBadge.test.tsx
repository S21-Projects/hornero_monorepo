import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NivelBadge } from './NivelBadge';

describe('NivelBadge', () => {
  it.each([
    ['N0', 'Registrada'],
    ['N1', 'Identificada'],
    ['N2', 'Operativa'],
    ['N3', 'Acreditada'],
  ] as const)('renders a distinguishable badge for %s', (nivel, expectedLabel) => {
    render(<NivelBadge nivel={nivel} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('gives each level a different visual tone', () => {
    const { container: c0 } = render(<NivelBadge nivel="N0" />);
    const { container: c3 } = render(<NivelBadge nivel="N3" />);
    const style0 = c0.querySelector('span')?.getAttribute('style');
    const style3 = c3.querySelector('span')?.getAttribute('style');
    expect(style0).not.toEqual(style3);
  });
});
