import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { useCargarEvidencia } from '../../lib/hooks/useAcreditacion';
import type { RequisitoAcreditacion } from '../../types/domain';

interface EvidenciaFormProps {
  organizacionId: number;
  requisito: RequisitoAcreditacion;
}

/**
 * Referente submission form for a single requisito. Slice A offers
 * `DECLARACION` only — `FOTO`/`DOCUMENTO` are disabled options with an
 * explanatory note, never a selectable upload control. This is deliberate,
 * not an oversight: until Slice B ships the authenticated evidence-file
 * route, `ImagesController` rejects the `org-evidencia/` prefix and the MS
 * rejects a non-null `objectKey` with 400 (design's Slicing section).
 *
 * Structurally independent from `InfoPublicaForm` / the self-edit pending
 * snapshot (organizacion-self-edit spec delta) — this component never reads
 * or writes `aceptaDonaciones`/`sitioWebUrl`/`donacionDirectaUrl`.
 */
export function EvidenciaForm({ organizacionId, requisito }: EvidenciaFormProps) {
  const [declaracion, setDeclaracion] = useState('');
  const [validoHasta, setValidoHasta] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const cargarEvidencia = useCargarEvidencia();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setJustSubmitted(false);
    try {
      await cargarEvidencia.mutateAsync({
        organizacionId,
        input: {
          requisito,
          tipoEvidencia: 'DECLARACION',
          declaracion: declaracion.trim() || undefined,
          validoHasta: validoHasta || undefined,
        },
      });
      setJustSubmitted(true);
      setDeclaracion('');
    } catch (err) {
      void err; // surfaced below via cargarEvidencia.error
    }
  }

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`tipo-evidencia-${requisito}`}>
          <Text as="span" variant="label" color="ink-2">Tipo de evidencia</Text>
        </label>
        <select
          id={`tipo-evidencia-${requisito}`}
          value="DECLARACION"
          disabled
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-input)',
            border: '1.5px solid var(--line)',
            fontSize: 14.5,
            width: '100%',
          }}
        >
          <option value="DECLARACION">Declaración</option>
          <option value="FOTO" disabled>Foto</option>
          <option value="DOCUMENTO" disabled>Documento</option>
        </select>
        <Text variant="micro" color="ink-3">
          Foto y documento no están disponibles todavía — llegan en una próxima etapa. Por ahora
          se admite únicamente declaración de texto.
        </Text>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`declaracion-${requisito}`}>
          <Text as="span" variant="label" color="ink-2">Declaración</Text>
        </label>
        <textarea
          id={`declaracion-${requisito}`}
          value={declaracion}
          onChange={(e) => setDeclaracion(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Describí cómo cumplís este requisito"
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`valido-hasta-${requisito}`}>
          <Text as="span" variant="label" color="ink-2">Vigente hasta (opcional)</Text>
        </label>
        <input
          id={`valido-hasta-${requisito}`}
          type="date"
          value={validoHasta}
          onChange={(e) => setValidoHasta(e.target.value)}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-input)',
            border: '1.5px solid var(--line)',
            fontSize: 14.5,
            width: '100%',
          }}
        />
      </div>

      {cargarEvidencia.isError && (
        <Text variant="body-sm" color="urgent">No se pudo enviar la evidencia.</Text>
      )}

      {justSubmitted && !cargarEvidencia.isError && (
        <Text variant="body-sm" color="ink-3">
          Evidencia enviada. Queda pendiente de auditoría por un administrador.
        </Text>
      )}

      <Button type="submit" variant="secondary" size="sm" loading={cargarEvidencia.isPending}>
        Enviar evidencia
      </Button>
    </form>
  );
}
