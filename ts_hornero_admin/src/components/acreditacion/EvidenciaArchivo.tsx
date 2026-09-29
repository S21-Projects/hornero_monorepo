import { Text } from '../ui/Typography';
import { resolveEvidenciaArchivoPath } from '../../lib/evidenciaArchivo';
import { useEvidenciaArchivo } from '../../lib/hooks/useEvidenciaArchivo';
import type { TipoEvidencia } from '../../types/domain';

interface EvidenciaArchivoProps {
  organizacionId: number;
  /** The evidencia row's `objectKey` — `null`/`undefined` when the row has none (DECLARACION). */
  objectKey: string | null | undefined;
  tipoEvidencia: TipoEvidencia;
}

/**
 * AD-12 (tesis-core-features slice 2): renders a FOTO/DOCUMENTO evidence row's file through the
 * authenticated `evidencia-files` route — never a direct `img`/link built from the raw
 * `objectKey`. Shared by `AuditQueue`, `legajo.tsx` and the referente's own acreditación view.
 */
export function EvidenciaArchivo({ organizacionId, objectKey, tipoEvidencia }: EvidenciaArchivoProps) {
  const path = resolveEvidenciaArchivoPath(objectKey, organizacionId);
  const archivo = useEvidenciaArchivo(path);

  if (archivo.estado !== 'ok' || !archivo.url) {
    return (
      <Text variant="micro" color="ink-3">
        Archivo no disponible
      </Text>
    );
  }

  const esImagen = archivo.contentType?.startsWith('image/') ?? tipoEvidencia === 'FOTO';

  if (esImagen) {
    return (
      <img
        src={archivo.url}
        alt="Evidencia adjunta"
        style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 'var(--r-input)' }}
      />
    );
  }

  return (
    <a href={archivo.url} target="_blank" rel="noreferrer">
      Abrir documento
    </a>
  );
}
