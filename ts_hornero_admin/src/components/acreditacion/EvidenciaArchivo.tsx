import { DocumentText } from 'iconsax-reactjs';
import { Text } from '../ui/Typography';
import { resolveEvidenciaArchivoPath } from '../../lib/evidenciaArchivo';
import { useEvidenciaArchivo } from '../../lib/hooks/useEvidenciaArchivo';
import type { TipoEvidencia } from '../../types/domain';

interface EvidenciaArchivoProps {
  organizacionId: number;
  /** The evidencia row's `objectKey` — `null`/`undefined` when the row has none (DECLARACION). */
  objectKey: string | null | undefined;
  tipoEvidencia: TipoEvidencia;
  /** `thumbnail` renders a small square preview for list rows; default is the full preview. */
  size?: 'full' | 'thumbnail';
}

/**
 * AD-12 (tesis-core-features slice 2): renders a FOTO/DOCUMENTO evidence row's file through the
 * authenticated `evidencia-files` route — never a direct `img`/link built from the raw
 * `objectKey`. Shared by `AuditQueue`, `legajo.tsx` and the referente's own acreditación view.
 */
export function EvidenciaArchivo({ organizacionId, objectKey, tipoEvidencia, size = 'full' }: EvidenciaArchivoProps) {
  const path = resolveEvidenciaArchivoPath(objectKey, organizacionId);
  const archivo = useEvidenciaArchivo(path);

  if (archivo.estado !== 'ok' || !archivo.url) {
    return (
      <Text variant="micro" color="ink-3">
        Archivo no disponible
      </Text>
    );
  }

  const esPdf = archivo.contentType?.startsWith('application/pdf') ?? false;
  const esImagen = !esPdf && (archivo.contentType?.startsWith('image/') ?? tipoEvidencia === 'FOTO');
  const thumb = size === 'thumbnail';

  if (esImagen) {
    return (
      <img
        src={archivo.url}
        alt="Evidencia adjunta"
        style={
          thumb
            ? { width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }
            : { maxWidth: '100%', maxHeight: 240, borderRadius: 'var(--r-input)' }
        }
      />
    );
  }

  return (
    <a
      href={archivo.url}
      target="_blank"
      rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--horn)', fontWeight: 700 }}
    >
      <DocumentText size={thumb ? 20 : 18} variant="Bold" aria-hidden="true" />
      {esPdf ? 'Ver PDF' : 'Abrir documento'}
    </a>
  );
}
