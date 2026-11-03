import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stepper } from '../Stepper';

const STEPS = ['Tu cuenta', 'Organización', 'Acreditación'];

const states = () => screen.getAllByRole('listitem').map((li) => li.getAttribute('data-state'));

describe('Stepper', () => {
  it('marks done, current and pending steps', () => {
    render(<Stepper steps={STEPS} current={1} />);
    expect(states()).toEqual(['done', 'current', 'pending']);
    const items = screen.getAllByRole('listitem');
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[0].getAttribute('aria-current')).toBeNull();
    expect(items[2].textContent).toContain('3');
  });

  it('shows every step as done when allDone', () => {
    render(<Stepper steps={STEPS} current={2} allDone />);
    expect(states()).toEqual(['done', 'done', 'done']);
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });
});
