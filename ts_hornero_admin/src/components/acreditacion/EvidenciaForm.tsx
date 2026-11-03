import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DocumentText } from 'iconsax-reactjs';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { useCargarEvidencia } from '../../lib/hooks/useAcreditacion';
import { useUploadOrgEvidencia } from '../../lib/hooks/useUploadOrgImagen';
import { MAX_EVIDENCIA_BYTES, formatBytes, requisitoHint } from '../../lib/acreditacion';
import type { RequisitoAcreditacion, TipoEvidencia } from '../../types/domain';

interface EvidenciaFormProps {
  organizacionId: number;
  requisito: RequisitoAcreditacion;
  /** Called once the evidence row was accepted by the server (the parent usually closes the form). */
  onSubmitted?: () => void;
  /** When given, a "Cancelar" button closes the form without submitting. */
  onCancel?: () => void;
}

const TIPOS: { value: TipoEvidencia; label: string }[] = [
  { value: 'DECLARACION', label: 'Declaración' },
  { value: 'FOTO', label: 'Foto' },
  { value: 'DOCUMENTO', label: 'Documento' },
];

interface ArchivoElegido {
  name: string;
  size: number;
  isImage: boolean;
  previewUrl: string | null;
}

const BUTTON_MIN_HEIGHT = { minHeight: 44 } as const;

/** Evidence tipo suggested by a file's MIME type; `null` when it maps to neither. */
function tipoFromFile(file: File): TipoEvidencia | null {
  if (file.type.startsWith('image/')) return 'FOTO';
  if (file.type === 'application/pdf') return 'DOCUMENTO';
  return null;
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
export function EvidenciaForm({ organizacionId, requisito, onSubmitted, onCancel }: EvidenciaFormProps) {
  const [tipoEvidencia, setTipoEvidencia] = useState<TipoEvidencia>('DECLARACION');
  const [declaracion, setDeclaracion] = useState('');
  const [validoHasta, setValidoHasta] = useState('');
  const [objectKey, setObjectKey] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [tipoAuto, setTipoAuto] = useState(false);
  const [tooBig, setTooBig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargarEvidencia = useCargarEvidencia();
  const uploadEvidencia = useUploadOrgEvidencia();

  const previewUrl = archivo?.previewUrl ?? null;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const requiresFile = tipoEvidencia === 'FOTO' || tipoEvidencia === 'DOCUMENTO';

  function handleTipoChange(value: TipoEvidencia) {
    setTipoEvidencia(value);
    setTipoAuto(false);
    // Switching between FOTO and DOCUMENTO keeps the uploaded file; DECLARACION has none.
    if (value === 'DECLARACION') {
      setObjectKey(null);
      setArchivo(null);
      setTooBig(false);
    }
  }

  async function handleFile(file: File) {
    setObjectKey(null);
    const isImage = file.type.startsWith('image/');
    const canPreview = isImage && typeof URL.createObjectURL === 'function';
    setArchivo({
      name: file.name,
      size: file.size,
      isImage,
      previewUrl: canPreview ? URL.createObjectURL(file) : null,
    });
    const suggested = tipoFromFile(file);
    if (suggested) {
      setTipoEvidencia(suggested);
      setTipoAuto(true);
    }
    if (file.size > MAX_EVIDENCIA_BYTES) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    try {
      const { key } = await uploadEvidencia.mutateAsync({ organizacionId, file });
      setObjectKey(key);
    } catch (err) {
      void err; // surfaced below via uploadEvidencia.error
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
      setTipoEvidencia('DECLARACION');
      setDeclaracion('');
      setValidoHasta('');
      setObjectKey(null);
      setArchivo(null);
      setTipoAuto(false);
      onSubmitted?.();
    } catch (err) {
      void err; // surfaced below via cargarEvidencia.error
    }
  }

  const autoHelper =
    tipoAuto && archivo
      ? archivo.isImage
        ? 'Se eligió Foto porque el archivo es una imagen. Podés cambiarlo.'
        : 'Se eligió Documento porque el archivo es un PDF. Podés cambiarlo.'
      : null;

  const inputStyle = {
    padding: '12px 14px',
    borderRadius: 'var(--r-input)',
    border: '1.5px solid var(--line)',
    fontSize: 14.5,
    width: '100%',
  } as const;

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {requisitoHint(requisito) && (
        <Text variant="body-sm" color="ink-2">{requisitoHint(requisito)}</Text>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ padding: 0, marginBottom: 6 }}>
          <Text as="span" variant="label" color="ink-2">Tipo de evidencia</Text>
        </legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS.map((t) => {
            const selected = tipoEvidencia === t.value;
            return (
              <label
                key={t.value}
                style={{
                  flex: '1 1 110px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minHeight: 44,
                  padding: '8px 12px',
                  borderRadius: 'var(--r-input)',
                  border: selected ? '2px solid var(--horn)' : '1.5px solid var(--line)',
                  background: selected ? 'var(--card-2)' : '#fff',
                  fontSize: 'var(--fs-body-sm)',
                  fontWeight: selected ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name={`tipo-evidencia-${requisito}`}
                  value={t.value}
                  checked={selected}
                  onChange={() => handleTipoChange(t.value)}
                  style={{ accentColor: 'var(--horn)', margin: 0 }}
                />
                {t.label}
              </label>
            );
          })}
        </div>
        {autoHelper && (
          <Text variant="micro" color="ink-3" style={{ marginTop: 6 }}>{autoHelper}</Text>
        )}
      </fieldset>

      {requiresFile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`archivo-${requisito}`}>
            <Text as="span" variant="label" color="ink-2">Archivo</Text>
          </label>
          <input
            ref={fileInputRef}
            id={`archivo-${requisito}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            style={archivo ? { display: 'none' } : { ...inputStyle, padding: '10px 12px' }}
          />
          {archivo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 10,
                borderRadius: 'var(--r-input)',
                border: '1px solid var(--line)',
                background: 'var(--card-2)',
              }}
            >
              {archivo.previewUrl ? (
                <img
                  src={archivo.previewUrl}
                  alt="Vista previa del archivo"
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />
              ) : (
                <DocumentText size={32} variant="Bold" color="var(--horn)" aria-hidden="true" />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text variant="body-sm" style={{ overflowWrap: 'anywhere' }}>{archivo.name}</Text>
                <Text variant="micro" color="ink-3">{formatBytes(archivo.size)}</Text>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                style={BUTTON_MIN_HEIGHT}
                onClick={() => fileInputRef.current?.click()}
              >
                Cambiar
              </Button>
            </div>
          )}
          {tooBig && (
            <Text variant="micro" color="urgent">El archivo supera los 5 MB. Elegí uno más liviano.</Text>
          )}
          {uploadEvidencia.isPending && (
            <Text variant="micro" color="ink-3">Subiendo {archivo?.name}...</Text>
          )}
          {uploadEvidencia.isError && (
            <Text variant="micro" color="urgent">No se pudo subir el archivo. Intentá de nuevo.</Text>
          )}
          {objectKey && !uploadEvidencia.isPending && (
            <Text variant="micro" color="ink-3">Archivo listo: {archivo?.name}</Text>
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
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
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
          style={inputStyle}
        />
      </div>

      {cargarEvidencia.isError && (
        <Text variant="body-sm" color="urgent">No se pudo enviar la evidencia.</Text>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {onCancel && (
          <Button type="button" variant="secondary" size="sm" style={BUTTON_MIN_HEIGHT} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          style={BUTTON_MIN_HEIGHT}
          loading={cargarEvidencia.isPending}
          disabled={requiresFile && (!objectKey || uploadEvidencia.isPending || tooBig)}
        >
          Enviar a auditoría
        </Button>
      </div>
    </form>
  );
}
