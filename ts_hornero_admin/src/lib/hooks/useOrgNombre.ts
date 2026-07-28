import { useMemo } from 'react';
import { useOrganizaciones } from './useOrganizaciones';

/**
 * Derives an id→nombre lookup from the bulk organizaciones query.
 * A single GET /organizaciones is shared across all callers via React Query cache.
 *
 * Returns `getNombre(id)` which falls back to "Organización" for unmatched ids
 * and when the fetch itself fails — callers never crash.
 */
export function useOrgNombre() {
  const { data: orgs, isLoading } = useOrganizaciones();

  const nombreMap = useMemo(() => {
    const map = new Map<number, string>();
    if (orgs) {
      for (const org of orgs) {
        map.set(org.id, org.nombre);
      }
    }
    return map;
  }, [orgs]);

  const getNombre = (id: number): string => nombreMap.get(id) ?? 'Organización';

  return { getNombre, isLoading };
}
