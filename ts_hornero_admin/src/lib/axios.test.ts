import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './axios';

// The adapter wraps the already-configured singleton `api` instance so the
// real response interceptors (single-flight 401 refresh) are exercised.
const mock = new MockAdapter(api, { onNoMatch: 'throwException' });

beforeEach(() => {
  mock.reset();
  // Clear session_hint left by previous tests
  document.cookie = 'session_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

afterEach(() => {
  mock.reset();
  vi.restoreAllMocks();
});

describe('single-flight 401 refresh', () => {
  it('two concurrent 401s result in exactly one /auth/refresh call and both requests retried', async () => {
    let refreshCount = 0;

    // Both data routes: 401 on first call, 200 on retry
    mock.onGet('/data-a').replyOnce(401).onGet('/data-a').reply(200, 'ok-a');
    mock.onGet('/data-b').replyOnce(401).onGet('/data-b').reply(200, 'ok-b');
    mock.onPost('/auth/refresh').reply(() => {
      refreshCount++;
      return [204, null];
    });

    const [r1, r2] = await Promise.all([api.get('/data-a'), api.get('/data-b')]);

    expect(refreshCount).toBe(1);
    expect(r1.data).toBe('ok-a');
    expect(r2.data).toBe('ok-b');
  });

  it('refresh failure + session_hint cookie present → queued requests reject and redirects to /login', async () => {
    // Simulate an active session via the JS-readable session_hint cookie.
    // access_token is httpOnly and cannot be set from JS.
    document.cookie = 'session_hint=1; path=/';

    // Capture the redirect without actually navigating
    const originalLocation = globalThis.location;
    const mockLocation = { href: '' };
    Object.defineProperty(globalThis, 'location', {
      value: mockLocation,
      configurable: true,
      writable: true,
    });

    try {
      mock.onGet('/protected-a').replyOnce(401);
      mock.onGet('/protected-b').replyOnce(401);
      mock.onPost('/auth/refresh').reply(401);

      const results = await Promise.allSettled([
        api.get('/protected-a'),
        api.get('/protected-b'),
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect(mockLocation.href).toBe('/login');
    } finally {
      Object.defineProperty(globalThis, 'location', {
        value: originalLocation,
        configurable: true,
        writable: true,
      });
    }
  });
});
