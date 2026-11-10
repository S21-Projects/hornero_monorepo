import { resolveAllowedOrigins } from './allowed-origins';

describe('resolveAllowedOrigins', () => {
  it('uses CORS_ORIGINS as the explicit allowlist, trimmed, without empties', () => {
    expect(
      resolveAllowedOrigins({
        CORS_ORIGINS: ' https://a.org , ,https://b.org ',
      }),
    ).toEqual(['https://a.org', 'https://b.org']);
  });

  it('ignores FRONTEND_URL when CORS_ORIGINS is set', () => {
    expect(
      resolveAllowedOrigins({
        CORS_ORIGINS: 'https://a.org',
        FRONTEND_URL: 'https://x.org',
      }),
    ).toEqual(['https://a.org']);
  });

  it('merges the local dev origins with FRONTEND_URL otherwise', () => {
    expect(resolveAllowedOrigins({ FRONTEND_URL: ' https://x.org ' })).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4321',
      'https://x.org',
    ]);
  });

  it('does not duplicate a FRONTEND_URL that is already a dev origin', () => {
    expect(
      resolveAllowedOrigins({ FRONTEND_URL: 'http://localhost:5173' }),
    ).toHaveLength(3);
  });
});
