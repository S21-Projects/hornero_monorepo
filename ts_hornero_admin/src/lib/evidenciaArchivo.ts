const OBJECT_KEY_PATTERN = /^org-evidencia\/(\d+)\/([^/]+)$/;

/**
 * AD-12 (tesis-core-features slice 2): strict client-side mirror of the MS's own
 * `AcreditacionService.existeArchivoEvidencia` validation. Resolves a well-formed
 * `org-evidencia/{orgId}/{filename}` key — one that also agrees with the evidencia row's own
 * `organizacionId` — to the authenticated BFF route. Any foreign prefix, path traversal, extra
 * path segment, or orgId mismatch resolves to `null` ("Archivo no disponible").
 */
export function resolveEvidenciaArchivoPath(
  objectKey: string | null | undefined,
  organizacionId: number,
): string | null {
  if (!objectKey) return null;

  const match = OBJECT_KEY_PATTERN.exec(objectKey);
  if (!match) return null;

  const [, keyOrgId, filename] = match;
  if (Number(keyOrgId) !== organizacionId) return null;

  return `/evidencia-files/${organizacionId}/${filename}`;
}
