import { useEffect, useRef, useState } from 'react';
import { Text } from '../ui/Typography';

interface CountdownProps {
  /** ISO instant the current code expires at (`CodigoEntregaResponse.expiraEn`). */
  expiraEn: string;
  onExpire?: () => void;
}

function segundosRestantes(expiraEn: string, ahora: number): number {
  return Math.max(0, Math.round((new Date(expiraEn).getTime() - ahora) / 1000));
}

function formatoMmSs(segundos: number): string {
  const mm = Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0');
  const ss = (segundos % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Spec `donacion-entrega-codigo` — "Screen reflects live countdown": ticks every second toward
 * `expiraEn`, and on reaching zero shows the expired state (the caller renders "Generar código
 * nuevo" once expired). `aria-live="polite"` announces the expiry to screen readers without
 * stealing focus.
 */
export function Countdown({ expiraEn, onExpire }: CountdownProps) {
  const [ahora, setAhora] = useState(() => Date.now());
  const expiradoNotificado = useRef(false);
  const restantes = segundosRestantes(expiraEn, ahora);

  useEffect(() => {
    expiradoNotificado.current = false;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiraEn]);

  useEffect(() => {
    if (restantes === 0 && !expiradoNotificado.current) {
      expiradoNotificado.current = true;
      onExpire?.();
    }
  }, [restantes, onExpire]);

  return (
    <div aria-live="polite">
      {restantes > 0 ? (
        <Text variant="body-sm" color="ink-2">
          Vence en {formatoMmSs(restantes)}
        </Text>
      ) : (
        <Text variant="body-sm" color="urgent">
          Código vencido
        </Text>
      )}
    </div>
  );
}
