// Transport-level types shared by the axios envelope unwrap and every paged
// hook. Mirrors the MS `ApiResponseAdvice` envelope and `PageData.java`
// (record PageData<T>(content, number, size, totalElements, totalPages)) —
// keep in sync if either changes.

export interface ApiResponse<T> {
  status: number;
  message?: string;
  timestamp: string;
  data: T;
  errors?: string[];
}

export interface PageData<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Page metadata without the row payload — what `Pager`/`PaginatedTable` need. */
export type PageMeta = Omit<PageData<unknown>, 'content'>;

export interface PageParams {
  page?: number;
  size?: number;
}

/**
 * Shape guard for the MS envelope. No domain DTO carries a numeric `status`
 * + string `timestamp` + `data` field together (org/donacion/necesidad use
 * `estado`), so false positives are structurally impossible. `GET /auth/me`
 * (`{userId,email,nombre,tipo}`) fails this guard and passes through raw —
 * `ApiResponseAdvice` exempts `/api/auth/**` from the envelope on the MS side.
 */
export function isApiEnvelope(b: unknown): b is ApiResponse<unknown> {
  return (
    typeof b === 'object' &&
    b !== null &&
    typeof (b as { status?: unknown }).status === 'number' &&
    typeof (b as { timestamp?: unknown }).timestamp === 'string' &&
    'data' in b
  );
}
