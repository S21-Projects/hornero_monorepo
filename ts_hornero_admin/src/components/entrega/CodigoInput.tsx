import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface CodigoInputProps {
  onSubmit: (codigo: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

const SOLO_DIGITOS = /\D/g;

/**
 * Spec `donacion-entrega-codigo` — "Typed fallback verifies identically to a scan": always
 * rendered (not gated behind a scan error), 6-digit numeric with OTP-friendly autofill attributes,
 * and a 44px-tall submit button per the mockup's touch-target note.
 */
export function CodigoInput({ onSubmit, disabled, loading }: CodigoInputProps) {
  const [codigo, setCodigo] = useState('');
  const completo = codigo.length === 6;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (completo) onSubmit(codigo);
      }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
    >
      <div style={{ flex: 1 }}>
        <Input
          id="codigo-entrega"
          label="Código de la contraparte"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={codigo}
          disabled={disabled}
          onChange={(e) => setCodigo(e.target.value.replace(SOLO_DIGITOS, '').slice(0, 6))}
          style={{ fontFamily: 'monospace', letterSpacing: '0.2em', minHeight: 44 }}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={disabled || loading || !completo}
        loading={loading}
        style={{ minHeight: 44 }}
      >
        Confirmar
      </Button>
    </form>
  );
}
