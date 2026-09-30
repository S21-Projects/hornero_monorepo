import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CodigoQr } from './CodigoQr';

/**
 * AD-7 / AD-6 (tesis-core-features slice 3c-i): renders the delivery code as an SVG QR (jsdom-safe,
 * no canvas) encoding the wrapped payload from `payload.ts` — never the bare code alone, so a scan
 * can be rejected as belonging to a different donación before it reaches the backend.
 */
describe('CodigoQr', () => {
  it('renders a QRCodeSVG encoding the wrapped payload', () => {
    const { container } = render(<CodigoQr donacionId={42} codigo="482913" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows the plain 6-digit code as large monospace text', () => {
    const { getByText } = render(<CodigoQr donacionId={42} codigo="482913" />);

    expect(getByText('482913')).toBeInTheDocument();
  });
});
