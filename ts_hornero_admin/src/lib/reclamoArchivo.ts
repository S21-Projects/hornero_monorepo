const OBJECT_KEY_PATTERN = /^reclamo-evidencia\/(\d+)\/(\d+)\/([^/]+)$/;

/**
 * Strict client-side mirror of the MS's claim-evidence key check: resolves a well-formed
 * `reclamo-evidencia/{orgId}/{solicitanteId}/{filename}` key that agrees with the claim's own
 * organizacion and claimant to the authenticated BFF route. Anything else resolves to `null`
 * ("Archivo no disponible").
 */
export function resolveReclamoArchivoPath(
  objectKey: string | null | undefined,
  organizacionId: number,
  solicitanteId: number,
): string | null {
  if (!objectKey) return null;
  const match = OBJECT_KEY_PATTERN.exec(objectKey);
  if (!match) return null;
  const [, keyOrgId, keyUserId, filename] = match;
  if (Number(keyOrgId) !== organizacionId || Number(keyUserId) !== solicitanteId) return null;
  return `/reclamo-files/${organizacionId}/${solicitanteId}/${filename}`;
}
