/**
 * Builds a URL query string from a map of params using URLSearchParams.
 * Skips any entry whose value is undefined, null, or empty string.
 * Values are percent-encoded so reserved characters (&, =, %) inside a value
 * cannot split into additional query parameters or alter request structure.
 * Note: commas in sort values (e.g. `id,asc`) are encoded as `id%2Casc`;
 * Spring's PageableHandlerMethodArgumentResolver URL-decodes before parsing.
 *
 * @returns `?key=val&...` or `""` when all entries are skipped.
 */
export function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v != null && v !== '') qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}
