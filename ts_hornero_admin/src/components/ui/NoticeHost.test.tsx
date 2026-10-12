import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoticeHost } from './NoticeHost';
import { useNoticeStore } from '../../store/notice.store';

describe('NoticeHost', () => {
  beforeEach(() => {
    useNoticeStore.setState({ notices: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders pushed notices in a polite live region and lets the user dismiss them', async () => {
    const user = userEvent.setup();
    render(<NoticeHost />);

    act(() => { useNoticeStore.getState().push('Hola aviso'); });

    expect(screen.getByRole('status')).toHaveTextContent('Hola aviso');
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Hola aviso')).not.toBeInTheDocument();
  });

  it('dismisses itself after a few seconds', () => {
    vi.useFakeTimers();
    render(<NoticeHost />);

    act(() => { useNoticeStore.getState().push('Efímero'); });
    expect(screen.getByText('Efímero')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(7000); });

    expect(screen.queryByText('Efímero')).not.toBeInTheDocument();
  });
});
