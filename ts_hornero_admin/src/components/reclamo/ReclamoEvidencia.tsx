import { Text } from '../ui/Typography';
import { resolveReclamoArchivoPath } from '../../lib/reclamoArchivo';
import { useEvidenciaArchivo } from '../../lib/hooks/useEvidenciaArchivo';

interface ReclamoEvidenciaProps {
  organizacionId: number;
  solicitanteId: number;
  objectKey: string;
}

/**
 * Renders one claim evidence file through the authenticated `reclamo-files` route (never a direct
 * link built from the raw key). Shown to the admin reviewing the claim and to the claimant.
 */
export function ReclamoEvidencia({ organizacionId, solicitanteId, objectKey }: ReclamoEvidenciaProps) {
  const path = resolveReclamoArchivoPath(objectKey, organizacionId, solicitanteId);
  const archivo = useEvidenciaArchivo(path);

  if (archivo.estado !== 'ok' || !archivo.url) {
    return (
      <Text variant="micro" color="ink-3">
        Archivo no disponible
      </Text>
    );
  }

  return (
    <a href={archivo.url} target="_blank" rel="noreferrer">
      <img
        src={archivo.url}
        alt="Evidencia del reclamo"
        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--r-input)' }}
      />
    </a>
  );
}
