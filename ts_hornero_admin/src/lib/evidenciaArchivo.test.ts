import { describe, expect, it } from 'vitest';
import { resolveEvidenciaArchivoPath } from './evidenciaArchivo';

/**
 * AD-12 (tesis-core-features slice 2): the strict `objectKey` parser feeding
 * `/evidencia-files/{orgId}/{filename}`. Never trust the raw key blindly — it must both match the
 * exact shape and agree with the evidencia row's own `organizacionId`.
 */
describe('resolveEvidenciaArchivoPath', () => {
  it('resolves a well-formed key to the evidencia-files path', () => {
    expect(resolveEvidenciaArchivoPath('org-evidencia/5/foto.jpg', 5)).toBe(
      '/evidencia-files/5/foto.jpg',
    );
  });

  it('returns null for a foreign-prefix key', () => {
    expect(resolveEvidenciaArchivoPath('other-prefix/5/foto.jpg', 5)).toBeNull();
  });

  it('returns null for a path-traversal attempt', () => {
    expect(resolveEvidenciaArchivoPath('org-evidencia/5/../secreto', 5)).toBeNull();
  });

  it('returns null for an extra path segment', () => {
    expect(resolveEvidenciaArchivoPath('org-evidencia/5/sub/foto.jpg', 5)).toBeNull();
  });

  it('returns null when the key orgId does not match organizacionId', () => {
    expect(resolveEvidenciaArchivoPath('org-evidencia/5/foto.jpg', 6)).toBeNull();
  });

  it('returns null for a null or undefined objectKey', () => {
    expect(resolveEvidenciaArchivoPath(null, 5)).toBeNull();
    expect(resolveEvidenciaArchivoPath(undefined, 5)).toBeNull();
  });
});
