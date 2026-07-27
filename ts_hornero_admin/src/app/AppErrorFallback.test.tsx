import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppErrorFallback } from './AppErrorFallback';

describe('AppErrorFallback', () => {
  it('renders a styled full-page error state', () => {
    render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={vi.fn()} />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  it('calls resetErrorBoundary when the retry button is clicked', async () => {
    const user = userEvent.setup();
    const resetErrorBoundary = vi.fn();
    render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={resetErrorBoundary} />);

    await user.click(screen.getByRole('button', { name: /intentar de nuevo/i }));

    expect(resetErrorBoundary).toHaveBeenCalledTimes(1);
  });
});
