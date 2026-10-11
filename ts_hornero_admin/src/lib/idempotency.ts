import { isAxiosError } from 'axios';
import { useState } from 'react';

/**
 * N11: every business POST (create / trigger) carries an `Idempotency-Key`
 * (draft-ietf-httpapi-idempotency-key-header-07). The MS is the authority: a repeated key replays
 * the original answer instead of running the operation twice, so a double click or a retry after a
 * timeout can never create a duplicate donación, necesidad, etc.
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCIA_EN_PROCESO = 'IDEMPOTENCIA_EN_PROCESO';

/** v4 UUID. `crypto.randomUUID` needs a secure context, so fall back to getRandomValues. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Whether the server gave a final answer to this key. A final 4xx (validation, business rule,
 * CONFLICTO_CONCURRENTE, payload mismatch) is stored and would be replayed, so the next attempt
 * needs a new key. Network errors, 5xx, auth errors and "still in flight" keep the key: the retry
 * must hit the same operation.
 */
export function debeRenovarClave(error: unknown): boolean {
  if (!isAxiosError(error) || !error.response) return false;
  const { status, data } = error.response;
  if (status === 401 || status === 403 || status === 429) return false;
  if (status === 409 && (data as { message?: string } | undefined)?.message === IDEMPOTENCIA_EN_PROCESO) {
    return false;
  }
  return status >= 400 && status < 500;
}

export interface IdempotencyKeyHandle {
  /** Key for one logical submission: the same for a retry of the same payload, new if it changed. */
  keyFor: (payload?: unknown) => string;
  /** Forget the current key (the next submission is a new operation). */
  renew: () => void;
  /** Runs `send` with the key, renewing it when the server gave a final answer. */
  run: <T>(payload: unknown, send: (key: string) => Promise<T>) => Promise<T>;
}

function createKeyHandle(): IdempotencyKeyHandle {
  let state: { key: string; signature: string | null } = { key: newIdempotencyKey(), signature: null };

  const renew = () => {
    state = { key: newIdempotencyKey(), signature: null };
  };
  const keyFor = (payload?: unknown) => {
    const signature = JSON.stringify(payload ?? null);
    if (state.signature !== null && state.signature !== signature) {
      state = { key: newIdempotencyKey(), signature };
    } else {
      state.signature = signature;
    }
    return state.key;
  };
  return {
    keyFor,
    renew,
    run: async (payload, send) => {
      const key = keyFor(payload);
      try {
        const result = await send(key);
        renew();
        return result;
      } catch (error) {
        if (debeRenovarClave(error)) renew();
        throw error;
      }
    },
  };
}

/**
 * One stable key per logical submission. Lives as long as the component using the mutation hook,
 * so retries and double submits reuse it; success or a final 4xx renew it.
 */
export function useIdempotencyKey(): IdempotencyKeyHandle {
  const [handle] = useState(createKeyHandle);
  return handle;
}

/** Axios `headers` option carrying the key. */
export const idempotencyHeaders = (key: string) => ({ [IDEMPOTENCY_KEY_HEADER]: key });
