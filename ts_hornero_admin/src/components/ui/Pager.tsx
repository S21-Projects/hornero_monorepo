import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import { Text } from './Typography';
import type { PageMeta } from '../../types/api';

export interface PagerProps {
  /** Page metadata straight from a `PageData<T>` response (content omitted). */
  page: PageMeta;
  /** 0-indexed, matches the MS `number` field. */
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** Current page size; shown as the selected option of the size selector. */
  pageSize?: number;
  /** Selectable page sizes. Defaults to 10/25/50. */
  pageSizeOptions?: number[];
  /** When given, a "Mostrar N por página" selector is rendered. */
  onPageSizeChange?: (size: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Controlled prev/next pager. Presentational only — never fetches, never
 * owns page state. Callers pass `PageMeta` and react to `onPageChange`.
 */
export function Pager({
  page,
  onPageChange,
  disabled,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
}: PagerProps) {
  const { number, totalPages, totalElements } = page;
  const isFirst = number <= 0;
  const isLast = number >= totalPages - 1;

  const hasSizeSelector = onPageSizeChange != null;
  // With a size selector keep the pager visible while results exceed the smallest size,
  // so the user can always pick a smaller size again.
  const showSelector = hasSizeSelector && totalElements > Math.min(...pageSizeOptions);

  if (totalPages <= 1 && !showSelector) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 16,
      }}
    >
      <Text variant="body-sm" color="ink-3">
        Página {totalPages === 0 ? 0 : number + 1} de {totalPages} · {totalElements} resultados
      </Text>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {showSelector && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
            <Text variant="body-sm" color="ink-3">
              Mostrar
            </Text>
            <Dropdown
              value={String(pageSize ?? pageSizeOptions[0])}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => onPageSizeChange?.(Number(v))}
              disabled={disabled}
              style={{ minWidth: 72, width: 72 }}
            />
            <Text variant="body-sm" color="ink-3">
              por página
            </Text>
          </div>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || isFirst}
          onClick={() => onPageChange(number - 1)}
          aria-label="Página anterior"
          style={{ gap: 4 }}
        >
          <ArrowLeft2 size={14} />
          Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || isLast}
          onClick={() => onPageChange(number + 1)}
          aria-label="Página siguiente"
          style={{ gap: 4 }}
        >
          Siguiente
          <ArrowRight2 size={14} />
        </Button>
      </div>
    </div>
  );
}
