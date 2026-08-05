import type { PageData, PageMeta } from '../../types/api';

/**
 * Shared fixture for hook/component tests that consume `PageData<T>`. Keeps
 * every test's page shape consistent instead of ad-hoc literals per file.
 */
export function makePage<T>(content: T[], o: Partial<PageMeta> = {}): PageData<T> {
  const size = o.size ?? 20;
  const totalElements = o.totalElements ?? content.length;
  return {
    content,
    number: o.number ?? 0,
    size,
    totalElements,
    totalPages: o.totalPages ?? Math.max(1, Math.ceil(totalElements / size)),
  };
}
