import { describe, it, expect } from 'vitest';
import { resolveReclamoArchivoPath } from './reclamoArchivo';

describe('resolveReclamoArchivoPath', () => {
  it('maps a well-formed key to the authenticated BFF route', () => {
    expect(resolveReclamoArchivoPath('reclamo-evidencia/4/7/1700.jpg', 4, 7)).toBe(
      '/reclamo-files/4/7/1700.jpg',
    );
  });

  it.each([
    ['empty', ''],
    ['null', null],
    ['accreditation prefix', 'org-evidencia/4/1700.jpg'],
    ['other organizacion', 'reclamo-evidencia/5/7/1700.jpg'],
    ['other claimant', 'reclamo-evidencia/4/8/1700.jpg'],
    ['traversal', 'reclamo-evidencia/4/7/../x.jpg'],
    ['extra segment', 'reclamo-evidencia/4/7/a/b.jpg'],
  ])('resolves %s to null', (_label, key) => {
    expect(resolveReclamoArchivoPath(key as string | null, 4, 7)).toBeNull();
  });
});
