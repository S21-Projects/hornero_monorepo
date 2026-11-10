/**
 * Envelope shape emitted by the BFF/MS (`ApiResponseAdvice`) for every
 * response except `/api/auth/**`, which is exempted and passes through raw.
 */
export interface ApiResponse<T> {
  status: number;
  message: string;
  timestamp: string;
  data: T;
  errors?: string[];
}

/**
 * Shape guard for the API envelope. Domain DTOs (org/donacion/necesidad) use
 * `estado`, never a numeric `status` + string `timestamp` + `data` triple, so
 * false positives are structurally impossible. `/auth/me`-shaped bodies
 * (`{userId,email,nombre,tipo}`) fail this guard and pass through untouched.
 */
export function isApiEnvelope(body: unknown): body is ApiResponse<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { status?: unknown }).status === 'number' &&
    typeof (body as { timestamp?: unknown }).timestamp === 'string' &&
    'data' in body
  );
}

/**
 * Fetch helper for public (unauthenticated) BFF endpoints.
 * Server-side only — uses BFF_BASE_URL (never exposed to the browser).
 * Does NOT forward cookies or any auth header.
 */
export async function publicFetch<T>(path: string): Promise<T> {
  const bffBase = process.env.BFF_BASE_URL;
  if (!bffBase) throw new Error(`publicFetch: BFF_BASE_URL is not set`);

  const url = `${bffBase}${path}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`publicFetch ${path} failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  return (isApiEnvelope(body) ? body.data : body) as T;
}

export type FetchResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Same contract as publicFetch, but never throws — callers get a
 * discriminated result instead. This makes "fetch failed" (ErrorState)
 * distinguishable at the type level from "fetch succeeded with an empty
 * list" (EmptyState), which a bare try/catch-to-`[]` cannot express.
 */
export async function publicFetchSafe<T>(path: string): Promise<FetchResult<T>> {
  try {
    const data = await publicFetch<T>(path);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
