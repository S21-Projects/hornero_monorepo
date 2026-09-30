import { QRCodeSVG } from 'qrcode.react';
import { formatPayload } from '../../lib/qr/payload';
import { Text } from '../ui/Typography';

interface CodigoQrProps {
  donacionId: number;
  codigo: string;
}

/**
 * Renders the party's own delivery code as a QR (AD-7 — `qrcode.react`'s `QRCodeSVG`, plain SVG so
 * it renders in jsdom too) encoding the wrapped `HORNERO-ENTREGA:{donacionId}:{codigo}` payload
 * (AD-6), plus the plain code in large monospace per the mockup, for the party to read aloud if
 * scanning is unavailable on either end.
 */
export function CodigoQr({ donacionId, codigo }: CodigoQrProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-1)',
        }}
      >
        <QRCodeSVG value={formatPayload(donacionId, codigo)} size={200} />
      </div>
      <Text
        variant="stat"
        style={{ fontFamily: 'monospace', letterSpacing: '0.3em' }}
        aria-label={`Código de entrega ${codigo}`}
      >
        {codigo}
      </Text>
    </div>
  );
}
