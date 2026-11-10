import { describe, it, expect } from 'vitest';
import { formatPayload, parsePayload } from './payload';

/**
 * AD-6 (tesis-core-features slice 3c-i): the QR payload wraps the plain 6-digit delivery code with
 * the target `donacionId` so the scanner can reject a code scanned from a different donación
 * before spending a verification attempt (spec `donacion-entrega-codigo`, "Code cannot verify
 * against the wrong party"). The typed fallback only ever carries the bare 6 digits.
 */
describe('formatPayload', () => {
  it('wraps the donacionId and code as HORNERO-ENTREGA:{donacionId}:{codigo}', () => {
    expect(formatPayload(42, '482913')).toBe('HORNERO-ENTREGA:42:482913');
  });
});

describe('parsePayload', () => {
  it('parses a well-formed wrapped payload for the expected donacionId', () => {
    expect(parsePayload('HORNERO-ENTREGA:42:482913', 42)).toBe('482913');
  });

  it('parses the bare 6-digit form regardless of donacionId', () => {
    expect(parsePayload('482913', 42)).toBe('482913');
  });

  it('rejects a wrapped payload for a different donacionId', () => {
    expect(parsePayload('HORNERO-ENTREGA:99:482913', 42)).toBeNull();
  });

  it('rejects a malformed wrapped payload', () => {
    expect(parsePayload('HORNERO-ENTREGA:42', 42)).toBeNull();
    expect(parsePayload('HORNERO-ENTREGA:abc:482913', 42)).toBeNull();
    expect(parsePayload('HORNERO-ENTREGA:42:12345', 42)).toBeNull();
    expect(parsePayload('HORNERO-ENTREGA:42:1234567', 42)).toBeNull();
  });

  it('rejects a bare value that is not exactly 6 digits', () => {
    expect(parsePayload('12345', 42)).toBeNull();
    expect(parsePayload('abcdef', 42)).toBeNull();
  });

  it('rejects an unrelated string', () => {
    expect(parsePayload('not a qr payload', 42)).toBeNull();
  });
});
