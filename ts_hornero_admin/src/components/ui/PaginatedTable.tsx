import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Card } from './Card';
import { Input } from './Input';
import { Text } from './Typography';
import { Pager } from './Pager';
import type { PageMeta } from '../../types/api';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  width?: string;
  render: (row: T) => ReactNode;
}

export interface PaginatedTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  page: PageMeta;
  onPageChange: (page: number) => void;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Extra filters/controls rendered above the table, next to the search input. */
  toolbar?: ReactNode;
  /** Trailing action cell per row, rendered as its own right-aligned column. */
  rowActions?: (row: T) => ReactNode;
  /** Dims the table during `keepPreviousData` refetch transitions. */
  isFetching?: boolean;
  emptyLabel?: string;
  /** Renders an expandable detail row below a given row's `<tr>` (e.g. audit trail + a form). */
  renderRowDetail?: (row: T) => ReactNode;
  /** Which rows (by `rowKey`) currently have their detail row expanded. */
  expandedKeys?: ReadonlySet<string | number>;
}

const CELL_PADDING = '14px 20px';
const HEAD_PADDING = '12px 20px';

/**
 * Generic, controlled, presentational paginated table. Composes `Pager` for
 * navigation. Never fetches — callers own the query and page state, and
 * filter rows themselves when `search` is supplied (so a caller can later
 * swap a local filter for a server-side `search` param with no component
 * change). Loading/error states stay with the route's `AsyncSection`; this
 * component only owns the `isFetching` dim overlay and the empty-rows case.
 */
export function PaginatedTable<T>({
  columns,
  rows,
  rowKey,
  page,
  onPageChange,
  search,
  toolbar,
  rowActions,
  isFetching,
  emptyLabel = 'No hay resultados',
  renderRowDetail,
  expandedKeys,
}: PaginatedTableProps<T>) {
  const hasToolbar = Boolean(search) || Boolean(toolbar);

  return (
    <div>
      {hasToolbar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {search && (
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Input
                type="search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Buscar…'}
                aria-label={search.placeholder ?? 'Buscar'}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      <Card style={{ padding: 0, overflow: 'hidden', opacity: isFetching ? 0.6 : 1, transition: 'opacity .15s' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ textAlign: col.align ?? 'left', padding: HEAD_PADDING, width: col.width }}
                >
                  <Text variant="caption">{col.header}</Text>
                </th>
              ))}
              {rowActions && (
                <th style={{ textAlign: 'right', padding: HEAD_PADDING }}>
                  <Text variant="caption">Acción</Text>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  style={{ padding: '32px 20px', textAlign: 'center' }}
                >
                  <Text variant="body-sm" color="ink-3">{emptyLabel}</Text>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const isExpanded = Boolean(renderRowDetail) && Boolean(expandedKeys?.has(key));
                return (
                  <Fragment key={key}>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {columns.map((col) => (
                        <td key={col.key} style={{ padding: CELL_PADDING, textAlign: col.align ?? 'left' }}>
                          {col.render(row)}
                        </td>
                      ))}
                      {rowActions && (
                        <td style={{ padding: CELL_PADDING, textAlign: 'right' }}>
                          {rowActions(row)}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <td
                          colSpan={columns.length + (rowActions ? 1 : 0)}
                          style={{ padding: CELL_PADDING, background: 'var(--card-2, #f7f3ec)' }}
                        >
                          {renderRowDetail?.(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <Pager page={page} onPageChange={onPageChange} disabled={isFetching} />
    </div>
  );
}
