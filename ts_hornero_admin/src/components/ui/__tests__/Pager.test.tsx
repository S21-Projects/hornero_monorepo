import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pager } from '../Pager';
import type { PageMeta } from '../../../types/api';

const meta = (over: Partial<PageMeta> = {}): PageMeta =>
  ({ number: 0, size: 10, totalPages: 3, totalElements: 25, ...over }) as PageMeta;

describe('Pager page-size selector', () => {
  it('is hidden without onPageSizeChange', () => {
    render(<Pager page={meta()} onPageChange={() => {}} pageSize={10} />);
    expect(screen.queryByText('Mostrar')).toBeNull();
  });

  it('lists the options and reports the chosen size', () => {
    const onSize = vi.fn();
    render(<Pager page={meta()} onPageChange={() => {}} pageSize={10} onPageSizeChange={onSize} />);
    expect(screen.getByText('Mostrar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['10', '25', '50']);
    fireEvent.click(screen.getByRole('option', { name: '25' }));
    expect(onSize).toHaveBeenCalledWith(25);
  });

  it('stays visible on a single page while results exceed the smallest size', () => {
    render(
      <Pager
        page={meta({ totalPages: 1, totalElements: 12, size: 50 })}
        onPageChange={() => {}}
        pageSize={50}
        onPageSizeChange={() => {}}
      />,
    );
    expect(screen.getByText('Mostrar')).toBeTruthy();
  });

  it('renders nothing for a single small page', () => {
    const { container } = render(
      <Pager page={meta({ totalPages: 1, totalElements: 4 })} onPageChange={() => {}} pageSize={10} onPageSizeChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
