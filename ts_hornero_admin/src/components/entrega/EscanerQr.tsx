import { useEffect, useRef, useState } from 'react';
import { parsePayload } from '../../lib/qr/payload';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { CodigoInput } from './CodigoInput';

interface EscanerQrProps {
  donacionId: number;
  onCodigo: (codigo: string) => void;
  disabled?: boolean;
}

/**
 * Scan action + always-usable typed fallback, per spec `donacion-entrega-codigo`'s mobile
 * confirmation screen. The adapter (`lib/qr/escanearQr.ts`) is loaded lazily via `import()` only
 * once the user taps "Escanear código..." (AD-7) — the camera stream itself is owned here so this
 * component can stop the tracks independently of the adapter's own decode loop.
 */
export function EscanerQr({ donacionId, onCodigo, disabled }: EscanerQrProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detenerEscaneo = async () => {
    const { detener } = await import('../../lib/qr/escanearQr');
    detener();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setEscaneando(false);
  };

  useEffect(() => {
    return () => {
      void detenerEscaneo();
    };
  }, []);

  const iniciarEscaneo = async () => {
    setError(null);
    try {
      const stream = (await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })) as MediaStream;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const { iniciar } = await import('../../lib/qr/escanearQr');
      await iniciar(videoRef.current as HTMLVideoElement, (payload) => {
        const codigo = parsePayload(payload, donacionId);
        if (codigo) onCodigo(codigo);
      });
      setEscaneando(true);
    } catch {
      setError('No se pudo acceder a la cámara. Usá el código escrito.');
      setEscaneando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {escaneando ? (
        <>
          {/* Live camera preview, not media playback — no captions track applies. */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', borderRadius: 'var(--r-card)' }}
          />
          <Button variant="secondary" onClick={() => void detenerEscaneo()} style={{ minHeight: 44 }}>
            Detener escaneo
          </Button>
        </>
      ) : (
        <>
          <video ref={videoRef} muted playsInline style={{ display: 'none' }} />
          <Button
            variant="primary"
            onClick={() => void iniciarEscaneo()}
            disabled={disabled}
            style={{ minHeight: 44 }}
          >
            Escanear código de la organización
          </Button>
        </>
      )}
      {error && (
        <Text variant="body-sm" color="urgent" role="alert">
          {error}
        </Text>
      )}
      <CodigoInput onSubmit={onCodigo} disabled={disabled} />
    </div>
  );
}
