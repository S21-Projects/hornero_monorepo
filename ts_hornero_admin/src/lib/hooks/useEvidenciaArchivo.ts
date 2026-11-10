import { useEffect, useState } from 'react';
import { api } from '../axios';

export type EvidenciaArchivoEstado = 'loading' | 'ok' | 'unavailable';

export interface UseEvidenciaArchivoResult {
  estado: EvidenciaArchivoEstado;
  /** Object URL for the fetched blob, only set while `estado === 'ok'`. */
  url: string | null;
  contentType: string | null;
}

/**
 * AD-12 (tesis-core-features slice 2): fetches an evidence file as a blob through the
 * authenticated, ownership- and row-checked `evidencia-files` BFF route (via the shared `api`
 * instance, so the 401/refresh/retry interceptor applies) and exposes an object URL. Both `403`
 * (non-owning) and `404` (no matching row) collapse to the same `'unavailable'` result — the
 * caller never needs to distinguish "you can't" from "it doesn't exist". `path === null` (an
 * unresolved/invalid `objectKey`, per `resolveEvidenciaArchivoPath`) skips the fetch entirely.
 */
export function useEvidenciaArchivo(path: string | null): UseEvidenciaArchivoResult {
  const [estado, setEstado] = useState<EvidenciaArchivoEstado>(path ? 'loading' : 'unavailable');
  const [url, setUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);

  useEffect(() => {
    // A null path (an unresolved/invalid objectKey) needs no fetch and no effect-driven state
    // change — the `!path` branch below derives 'unavailable' straight from the render input.
    if (!path) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    // No synchronous setState here (react-hooks/set-state-in-effect): the initial `useState`
    // above already resolves to 'loading' for the first path a caller passes in. A later path
    // change resolves once the fetch below settles, in the .then()/.catch() callbacks.
    api
      .get<Blob>(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
        setContentType(
          (res.headers as Record<string, string> | undefined)?.['content-type'] ??
            res.data.type ??
            null,
        );
        setEstado('ok');
      })
      .catch(() => {
        if (cancelled) return;
        setEstado('unavailable');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path) {
    return { estado: 'unavailable', url: null, contentType: null };
  }
  return { estado, url, contentType };
}
