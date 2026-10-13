import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safeRedirect';

describe('safeRedirectPath', () => {
  it('accepts same-origin relative paths, keeping search and hash', () => {
    expect(safeRedirectPath('/control-donaciones')).toBe('/control-donaciones');
    expect(safeRedirectPath('/mis-donaciones/12?tab=a#x')).toBe('/mis-donaciones/12?tab=a#x');
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute URL', 'https://evil.com/x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['backslash trick', '/\\evil.com'],
    ['no leading slash', 'admin'],
    ['control chars', '/ok\n//evil.com'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(42)).toBeNull();
  });

  it('rejects the public auth screens (would loop or be pointless)', () => {
    expect(safeRedirectPath('/login')).toBeNull();
    expect(safeRedirectPath('/register')).toBeNull();
    expect(safeRedirectPath('/login?motivo=x')).toBeNull();
  });
});
