import { describe, it, expect } from 'vitest';
import { decodeToken } from './jwt';

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa('{"alg":"HS256","typ":"JWT"}');
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

describe('decodeToken', () => {
  it('returns { tipo } from a valid JWT with a known role', () => {
    const token = makeToken({ tipo: 'ADMINISTRADOR', sub: '42' });
    expect(decodeToken(token)).toEqual({ tipo: 'ADMINISTRADOR' });
  });

  it('returns null for a malformed token (wrong number of segments)', () => {
    expect(decodeToken('not-a-jwt')).toBeNull();
    expect(decodeToken('only.two')).toBeNull();
    expect(decodeToken('too.many.segments.here')).toBeNull();
  });

  it('returns null for a payload that is valid base64 but not JSON', () => {
    const token = `header.${btoa('this is not json')}.sig`;
    expect(decodeToken(token)).toBeNull();
  });

  it('returns null when the payload has no tipo field', () => {
    const token = makeToken({ sub: '42', role: 'SOMETHING_ELSE' });
    expect(decodeToken(token)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeToken('')).toBeNull();
  });
});
