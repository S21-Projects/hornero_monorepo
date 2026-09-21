import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { useCargarEvidencia } from '../../lib/hooks/useAcreditacion';
import { useUploadOrgEvidencia } from '../../lib/hooks/useUploadOrgImagen';
import type { RequisitoAcreditacion, TipoEvidencia } from '../../types/domain';

interface EvidenciaFormProps {
  organizacionId: number;
  requisito: RequisitoAcreditacion;
}

/**
 * Referente submission form for a single requisito. `DECLARACION`, `FOTO` and `DOCUMENTO` are
 * all selectable: for `FOTO`/`DOCUMENTO` the referente attaches a file, which uploads through
 * `POST upload/org-evidencia/:id` (`useUploadOrgEvidencia`) before the evidence row itself is
 * submitted with the resulting `objectKey` — the authenticated evidence-file route on the read
 * side keeps that key non-public (`specs/organizacion-evidencia/spec.md`).
 *
 * Structurally independent from `InfoPublicaForm` / the self-edit pending
 * snapshot (organizacion-self-edit spec delta) — this component never reads
 * or writes `aceptaDonaciones`/`sitioWebUrl`/`donacionDirectaUrl`.
 */
export function EvidenciaForm({ organizacionId, requisito }: EvidenciaFormProps) {
  const [tipoEvidencia, setTipoEvidencia] = useState<TipoEvidencia>('DECLARACION');
  const [declaracion, setDeclaracion] = useState('');
  const [validoHasta, setValidoHasta] = useState('');
  const [objectKey, setObjectKey] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const cargarEvidencia = useCargarEvidencia();
  const uploadEvidencia = useUploadOrgEvidencia();

  const requiresFile = tipoEvidencia === 'FOTO' || tipoEvidencia === 'DOCUMENTO';

  function handleTipoChange(value: TipoEvidencia) {
    setTipoEvidencia(value);
    setObjectKey(null);
    setFileName(null);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setObjectKey(null);
    try {
      const { key } = await uploadEvidencia.mutateAsync({ organizacionId, file });
      setObjectKey(key);
    } catch (err) {
      void err; // surfaced below via uploadEvidencia.error
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setJustSubmitted(false);
    try {
      await cargarEvidencia.mutateAsync({
        organizacionId,
        input: requiresFile
          ? {
              requisito,
              tipoEvidencia,
              objectKey: objectKey ?? undefined,
              validoHasta: validoHasta || undefined,
            }
          : {
              requisito,
              tipoEvidencia: 'DECLARACION',
              declaracion: declaracion.trim() || undefined,
              validoHasta: validoHasta || undefined,
            },
      });
      setJustSubmitted(true);
      setDeclaracion('');
      setObjectKey(null);
      setFileName(null);
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
          value={tipoEvidencia}
          onChange={(e) => handleTipoChange(e.target.value as TipoEvidencia)}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-input)',
            border: '1.5px solid var(--line)',
            fontSize: 14.5,
            width: '100%',
          }}
        >
          <option value="DECLARACION">Declaración</option>
          <option value="FOTO">Foto</option>
          <option value="DOCUMENTO">Documento</option>
        </select>
      </div>

      {requiresFile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`archivo-${requisito}`}>
            <Text as="span" variant="label" color="ink-2">Archivo</Text>
          </label>
          <input
            id={`archivo-${requisito}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--r-input)',
              border: '1.5px solid var(--line)',
              fontSize: 14.5,
              width: '100%',
            }}
          />
          {uploadEvidencia.isPending && (
            <Text variant="micro" color="ink-3">Subiendo {fileName}...</Text>
          )}
          {uploadEvidencia.isError && (
            <Text variant="micro" color="urgent">No se pudo subir el archivo. Intentá de nuevo.</Text>
          )}
          {objectKey && !uploadEvidencia.isPending && (
            <Text variant="micro" color="ink-3">Archivo listo: {fileName}</Text>
          )}
        </div>
      ) : (
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
      )}

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

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={cargarEvidencia.isPending}
        disabled={requiresFile && (!objectKey || uploadEvidencia.isPending)}
      >
        Enviar evidencia
      </Button>
    </form>
  );
}
