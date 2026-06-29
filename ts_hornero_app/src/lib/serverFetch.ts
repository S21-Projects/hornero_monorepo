import { cookies } from 'next/headers';

interface ServerFetchOptions {
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

export async function serverFetch<T>(
  path: string,
  opts: ServerFetchOptions = {}
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const bffBase = process.env.BFF_BASE_URL ?? '';
  const url = `${bffBase}${path}`;

  const fetchOpts: RequestInit & { next?: ServerFetchOptions['next'] } = {
    headers: {
      Cookie: cookieHeader,
    },
  };

  if (opts.cache !== undefined) {
    fetchOpts.cache = opts.cache;
  }

  if (opts.next !== undefined) {
    fetchOpts.next = opts.next;
  }

  const res = await fetch(url, fetchOpts);

  if (!res.ok) {
    throw new Error(`serverFetch ${path} failed: ${res.status}`);
  }

  // Unwrap the ApiResponse envelope: { status, message, timestamp, data } → data
  const envelope = await res.json();
  return (envelope?.data ?? envelope) as T;
}
