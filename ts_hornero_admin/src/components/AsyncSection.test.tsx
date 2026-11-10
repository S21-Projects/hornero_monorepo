import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AsyncSection } from './AsyncSection';

describe('AsyncSection', () => {
  it('renders a loading indicator when isLoading is true', () => {
    render(
      <AsyncSection isLoading isError={false} isEmpty={false}>
        <p>content</p>
      </AsyncSection>,
    );

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('renders the ErrorState when isError is true', () => {
    render(
      <AsyncSection isLoading={false} isError isEmpty={false}>
        <p>content</p>
      </AsyncSection>,
    );

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  it('renders the EmptyState with the given emptyLabel when isEmpty is true', () => {
    render(
      <AsyncSection isLoading={false} isError={false} isEmpty emptyLabel="Nada por acá">
        <p>content</p>
      </AsyncSection>,
    );

    expect(screen.getByText('Nada por acá')).toBeInTheDocument();
  });

  it('renders children when not loading, error, or empty', () => {
    render(
      <AsyncSection isLoading={false} isError={false} isEmpty={false}>
        <p>content</p>
      </AsyncSection>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
