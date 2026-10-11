import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AxiosError } from 'axios';
import {
  IDEMPOTENCY_KEY_HEADER,
  debeRenovarClave,
  newIdempotencyKey,
  useIdempotencyKey,
} from './idempotency';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function httpError(status: number, message?: string) {
  const error = new AxiosError('failed');
  error.response = { status, data: { message }, headers: {}, statusText: '', config: {} as never };
  return error;
}

describe('newIdempotencyKey', () => {
  it('returns a v4 UUID, different every time', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(UUID);
    expect(newIdempotencyKey()).not.toBe(a);
  });
});

describe('debeRenovarClave', () => {
  it('keeps the key for network errors, 5xx and a request still in flight', () => {
    expect(debeRenovarClave(new AxiosError('Network Error'))).toBe(false);
    expect(debeRenovarClave(httpError(502))).toBe(false);
    expect(debeRenovarClave(httpError(503))).toBe(false);
    expect(debeRenovarClave(httpError(409, 'IDEMPOTENCIA_EN_PROCESO'))).toBe(false);
    expect(debeRenovarClave(httpError(401))).toBe(false);
  });

  it('renews after a completed answer: business 4xx and payload mismatch', () => {
    expect(debeRenovarClave(httpError(400, 'bad'))).toBe(true);
    expect(debeRenovarClave(httpError(409, 'CONFLICTO_CONCURRENTE'))).toBe(true);
    expect(debeRenovarClave(httpError(422, 'IDEMPOTENCIA_PAYLOAD_DISTINTO'))).toBe(true);
    expect(debeRenovarClave(new Error('boom'))).toBe(false);
  });
});

describe('useIdempotencyKey', () => {
  it('gives the same key for the same payload (a retry) and a new one when the payload changes', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor({ a: 1 });
    expect(result.current.keyFor({ a: 1 })).toBe(first);
    expect(result.current.keyFor({ a: 2 })).not.toBe(first);
  });

  it('is stable across renders', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor('x');
    rerender();
    expect(result.current.keyFor('x')).toBe(first);
  });

  it('run: reuses the key after a retryable failure and renews after success', async () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const seen: string[] = [];

    await expect(
      result.current.run({ n: 1 }, async (key) => {
        seen.push(key);
        throw httpError(503);
      }),
    ).rejects.toBeTruthy();
    await result.current.run({ n: 1 }, async (key) => {
      seen.push(key);
      return 'ok';
    });
    await result.current.run({ n: 1 }, async (key) => {
      seen.push(key);
      return 'again';
    });

    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[1]);
  });

  it('run: renews after a completed 4xx so a corrected resubmission is a new operation', async () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const seen: string[] = [];

    await expect(
      result.current.run({ n: 1 }, async (key) => {
        seen.push(key);
        throw httpError(400, 'invalid');
      }),
    ).rejects.toBeTruthy();
    await result.current.run({ n: 1 }, async (key) => {
      seen.push(key);
    });

    expect(seen[1]).not.toBe(seen[0]);
  });

  it('exposes the header name', () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe('Idempotency-Key');
  });
});
