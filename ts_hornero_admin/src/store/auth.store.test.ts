import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  document.cookie = 'session_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  vi.resetModules();
});

describe('useAuthStore initial status', () => {
  it("starts as 'loading' on a cold boot that already carries session_hint", async () => {
    document.cookie = 'session_hint=1; path=/';
    vi.resetModules();
    const { useAuthStore } = await import('./auth.store');
    // Before AuthInitializer's effect runs, route guards render once. They must not
    // see 'unauthenticated' for a returning user or a deep link bounces to /login.
    expect(useAuthStore.getState().status).toBe('loading');
  });

  it("starts as 'unauthenticated' without session_hint", async () => {
    vi.resetModules();
    const { useAuthStore } = await import('./auth.store');
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
