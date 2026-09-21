import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { useCambiarNivel } from '../../lib/hooks/useAcreditacion';
import { NivelAcreditacion } from '../../types/domain';
import type { NivelAcreditacion as NivelAcreditacionType } from '../../types/domain';

const NIVEL_OPTIONS = Object.values(NivelAcreditacion);

interface NivelPanelProps {
  organizacionId: number;
  nivelActual: NivelAcreditacionType;
}

/**
 * Admin-only raise/lower control (AD-9). Always requires a non-blank `motivo`
 * for either direction, per `CambiarNivelRequest`'s `@NotBlank`. Kept
 * visually and structurally separate from `AuditQueue` — raising/lowering a
 * level and approving/observing a single evidence row are different admin
 * actions (design's data-flow note, echoed by task 4.7's AuditQueue spec).
 */
export function NivelPanel({ organizacionId, nivelActual }: NivelPanelProps) {
  const [destino, setDestino] = useState<NivelAcreditacionType>(nivelActual);
  const [motivo, setMotivo] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const cambiarNivel = useCambiarNivel();

  const canSubmit = motivo.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setJustSubmitted(false);
    if (!canSubmit) return;
    try {
      await cambiarNivel.mutateAsync({ organizacionId, destino, motivo: motivo.trim() });
      setJustSubmitted(true);
      setMotivo('');
    } catch (err) {
      void err; // surfaced below via cambiarNivel.error
    }
  }

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <Text variant="title">Cambiar nivel de acreditación</Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`nivel-destino-${organizacionId}`}>
          <Text as="span" variant="label" color="ink-2">Nuevo nivel</Text>
        </label>
        <select
          id={`nivel-destino-${organizacionId}`}
          value={destino}
          onChange={(e) => setDestino(e.target.value as NivelAcreditacionType)}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-input)',
            border: '1.5px solid var(--line)',
            fontSize: 14.5,
            width: '100%',
          }}
        >
          {NIVEL_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`nivel-motivo-${organizacionId}`}>
          <Text as="span" variant="label" color="ink-2">Motivo (obligatorio)</Text>
        </label>
        <textarea
          id={`nivel-motivo-${organizacionId}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Justificación del cambio de nivel"
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-input)',
            border: '1.5px solid var(--line)',
            fontSize: 14.5,
            width: '100%',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      {cambiarNivel.isError && (
        <Text variant="body-sm" color="urgent">
          No se pudo cambiar el nivel. Verificá que los requisitos estén completos.
        </Text>
      )}

      {justSubmitted && !cambiarNivel.isError && (
        <Text variant="body-sm" color="ink-3">Nivel actualizado.</Text>
      )}

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={!canSubmit}
        loading={cambiarNivel.isPending}
      >
        Confirmar cambio de nivel
      </Button>
    </form>
  );
}
