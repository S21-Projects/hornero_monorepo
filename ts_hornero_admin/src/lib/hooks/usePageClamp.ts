import { useEffect } from 'react';

/**
 * Clamps a controlled `page` index back into range when the backing dataset
 * shrinks (e.g. a mutation removes the last items on the current page and a
 * refetch returns fewer `totalPages` than before). Without this, a page
 * number equal to or past `totalPages` yields an empty `content` on refetch,
 * which trips `AsyncSection`'s empty state and discards the `Pager` along
 * with it — a dead end with no way back to the data.
 *
 * Only clamps when `totalPages > 0`, so it never fights the initial
 * loading state (where `totalPages` is typically `0` before data arrives).
 */
export function usePageClamp(
  page: number,
  setPage: (page: number) => void,
  totalPages: number | undefined,
) {
  useEffect(() => {
    if (totalPages != null && totalPages > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages, setPage]);
}
