import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as a level 1 heading', () => {
    render(<PageHeader title="Usuarios" description="Todos los usuarios." />);

    expect(screen.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<PageHeader title="Usuarios" description="Todos los usuarios." />);

    expect(screen.getByText('Todos los usuarios.')).toBeInTheDocument();
  });

  it('renders the actions when provided', () => {
    render(
      <PageHeader title="Usuarios" description="Todos los usuarios." actions={<button type="button">Invitar</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Invitar' })).toBeInTheDocument();
  });

  it('renders no button when actions are not provided', () => {
    render(<PageHeader title="Usuarios" description="Todos los usuarios." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
