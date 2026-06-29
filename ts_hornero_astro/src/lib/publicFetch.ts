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
