import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Countdown } from './Countdown';

/**
 * Spec `donacion-entrega-codigo` — "Screen reflects live countdown": ticks down toward the code's
 * `expiraEn`, and on reaching zero shows the code as expired with the regenerate action available.
 * `aria-live` so screen readers announce the expiry without focus-stealing.
 */
describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the remaining time as mm:ss', () => {
    const expiraEn = new Date('2026-09-30T12:01:30Z').toISOString();
    render(<Countdown expiraEn={expiraEn} />);

    expect(screen.getByText(/01:30/)).toBeInTheDocument();
  });

  it('ticks down every second', () => {
    const expiraEn = new Date('2026-09-30T12:01:30Z').toISOString();
    render(<Countdown expiraEn={expiraEn} />);

    act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.getByText(/01:29/)).toBeInTheDocument();
  });

  it('reaches zero and shows an expired state', () => {
    const expiraEn = new Date('2026-09-30T12:00:02Z').toISOString();
    render(<Countdown expiraEn={expiraEn} />);

    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
  });

  it('calls onExpire exactly once when reaching zero', () => {
    const onExpire = vi.fn();
    const expiraEn = new Date('2026-09-30T12:00:01Z').toISOString();
    render(<Countdown expiraEn={expiraEn} onExpire={onExpire} />);

    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('announces changes via aria-live', () => {
    const expiraEn = new Date('2026-09-30T12:01:30Z').toISOString();
    render(<Countdown expiraEn={expiraEn} />);

    expect(screen.getByText(/01:30/).closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });
});
