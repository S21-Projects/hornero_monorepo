import { Fragment, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { ArrowRight2 } from 'iconsax-reactjs';
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
  /** Extra inline style per row's `<tr>` (e.g. highlighting the currently selected row). */
  rowStyle?: (row: T) => CSSProperties | undefined;
  /**
   * Makes the whole row clickable (and focusable; Enter/Space activate it) and adds a trailing
   * chevron. Clicks on buttons/links/inputs inside a row never trigger it.
   */
  onRowClick?: (row: T) => void;
  /** Row (by `rowKey`) whose detail is open elsewhere (e.g. a drawer); rendered highlighted. */
  selectedKey?: string | number;
  /** Forwarded to `Pager`: shows the page size selector when `onPageSizeChange` is given. */
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

/** Interactive descendants handle their own clicks; the row handler must ignore them. */
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="option"]';

function fromInteractive(target: EventTarget, row: Element): boolean {
  const hit = (target as Element).closest?.(INTERACTIVE);
  return Boolean(hit && row.contains(hit) && hit !== row);
}

const CELL_PADDING = '14px 20px';
const HEAD_STYLE: CSSProperties = {
  padding: '12px 20px',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: '#fff',
  boxShadow: 'inset 0 -1px 0 var(--line)',
};

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
  rowStyle,
  onRowClick,
  selectedKey,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: PaginatedTableProps<T>) {
  const hasToolbar = Boolean(search) || Boolean(toolbar);
  const [hoveredKey, setHoveredKey] = useState<string | number | null>(null);
  const trailingCols = (rowActions ? 1 : 0) + (onRowClick ? 1 : 0);

  return (
    <div>
      <Card style={{ padding: 0, overflow: 'hidden', opacity: isFetching ? 0.6 : 1, transition: 'opacity .15s' }}>
        {hasToolbar && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 20px',
              borderBottom: '1px solid var(--line)',
              flexWrap: 'wrap',
            }}
          >
            {search && (
              <div style={{ flex: '1 1 240px', minWidth: 200, maxWidth: 360 }}>
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
            <Text variant="body-sm" color="ink-3" style={{ marginLeft: 'auto' }}>
              {page.totalElements} {page.totalElements === 1 ? 'resultado' : 'resultados'}
            </Text>
          </div>
        )}
        <div style={{ maxHeight: 'min(60vh, 560px)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ ...HEAD_STYLE, textAlign: col.align ?? 'left', width: col.width }}
                >
                  <Text variant="caption">{col.header}</Text>
                </th>
              ))}
              {rowActions && (
                <th style={{ ...HEAD_STYLE, textAlign: 'right' }}>
                  <Text variant="caption">Acción</Text>
                </th>
              )}
              {onRowClick && <th aria-hidden="true" style={{ ...HEAD_STYLE, width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + trailingCols}
                  style={{ padding: '32px 20px', textAlign: 'center' }}
                >
                  <Text variant="body-sm" color="ink-3">{emptyLabel}</Text>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedKey !== undefined && selectedKey === key;
                const isExpanded = Boolean(renderRowDetail) && Boolean(expandedKeys?.has(key));
                return (
                  <Fragment key={key}>
                    <tr
                      {...(onRowClick
                        ? {
                            tabIndex: 0,
                            'aria-current': isSelected ? ('true' as const) : undefined,
                            'data-selected': isSelected ? 'true' : undefined,
                            onClick: (e: MouseEvent<HTMLTableRowElement>) => {
                              if (fromInteractive(e.target, e.currentTarget)) return;
                              onRowClick(row);
                            },
                            onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
                              if (e.target !== e.currentTarget) return;
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            },
                            onMouseEnter: () => setHoveredKey(key),
                            onMouseLeave: () => setHoveredKey((cur) => (cur === key ? null : cur)),
                          }
                        : {})}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        ...(onRowClick ? { cursor: 'pointer' } : {}),
                        ...(onRowClick && hoveredKey === key ? { background: 'var(--card-2, #f7f3ec)' } : {}),
                        ...(isSelected ? { background: 'var(--straw)' } : {}),
                        ...rowStyle?.(row),
                      }}
                    >
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
                      {onRowClick && (
                        <td aria-hidden="true" style={{ padding: CELL_PADDING, textAlign: 'right', width: 40 }}>
                          <ArrowRight2 size={16} color="var(--ink-3)" />
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <td
                          colSpan={columns.length + trailingCols}
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
        </div>
      </Card>

      <Pager
        page={page}
        onPageChange={onPageChange}
        disabled={isFetching}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
