interface PublicFetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

/**
 * Fetch helper for public (unauthenticated) endpoints.
 * Does NOT call cookies() or any other Request-time API, so pages that use
 * this helper are eligible for ISR / static generation.
 *
 * For authenticated endpoints that need the session cookie, use serverFetch.
 */
export async function publicFetch<T>(
  path: string,
  opts: PublicFetchOptions = {}
): Promise<T> {
  const bffBase = process.env.BFF_BASE_URL;
  if (!bffBase) throw new Error(`publicFetch: BFF_BASE_URL is not set`);
  const url = `${bffBase}${path}`;

  const nextOpts: { revalidate?: number | false; tags?: string[] } = {};

  if (opts.revalidate !== undefined) {
    nextOpts.revalidate = opts.revalidate;
  }

  if (opts.tags !== undefined) {
    nextOpts.tags = opts.tags;
  }

  const fetchOpts: RequestInit & { next?: typeof nextOpts } = {
    signal: AbortSignal.timeout(8000),
  };

  if (Object.keys(nextOpts).length > 0) {
    fetchOpts.next = nextOpts;
  }

  const res = await fetch(url, fetchOpts);

  if (!res.ok) {
    throw new Error(`publicFetch ${path} failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
