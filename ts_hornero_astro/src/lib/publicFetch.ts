/**
 * Fetch helper for public (unauthenticated) BFF endpoints.
 * Server-side only — uses BFF_BASE_URL (never exposed to the browser).
 * Does NOT forward cookies or any auth header.
 */
export async function publicFetch<T>(path: string): Promise<T> {
  const bffBase = import.meta.env.BFF_BASE_URL;
  if (!bffBase) throw new Error(`publicFetch: BFF_BASE_URL is not set`);

  const url = `${bffBase}${path}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`publicFetch ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
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
