import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './NotFound';

describe('NotFound', () => {
  it('renders a 404 message', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it('renders a link back to the root', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/');
  });
});
