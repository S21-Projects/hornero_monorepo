import { useMemo } from 'react';
import { useOrganizaciones } from './useOrganizaciones';

/**
 * Derives an id→nombre lookup from the bulk organizaciones query.
 * A single GET /organizaciones is shared across all callers via React Query cache.
 *
 * Returns `getNombre(id)` which falls back to "Organización" for unmatched ids
 * and when the fetch itself fails — callers never crash.
 *
 * `/organizaciones` is now paginated at the MS (default page size 20); this
 * hook needs the full catalog to resolve arbitrary ids for the lookup, not
 * one page of it, so it requests `size: 100` explicitly — same pragmatic
 * widening used by `admin.tsx` (see `deriveAdminSummary` design decision).
 * TODO [tech-debt]: replace with a dedicated id→nombre lookup endpoint if the
 * org catalog ever exceeds 100.
 */
export function useOrgNombre() {
  const { data: orgsPage, isLoading } = useOrganizaciones({ size: 100 });

  const nombreMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const org of orgsPage?.content ?? []) {
      map.set(org.id, org.nombre);
    }
    return map;
  }, [orgsPage]);

  const getNombre = (id: number): string => nombreMap.get(id) ?? 'Organización';

  return { getNombre, isLoading };
}
