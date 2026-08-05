import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { Button } from './Button';
import { Text } from './Typography';
import type { PageMeta } from '../../types/api';

export interface PagerProps {
  /** Page metadata straight from a `PageData<T>` response (content omitted). */
  page: PageMeta;
  /** 0-indexed, matches the MS `number` field. */
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Controlled prev/next pager. Presentational only — never fetches, never
 * owns page state. Callers pass `PageMeta` and react to `onPageChange`.
 */
export function Pager({ page, onPageChange, disabled }: PagerProps) {
  const { number, totalPages, totalElements } = page;
  const isFirst = number <= 0;
  const isLast = number >= totalPages - 1;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
      <Text variant="body-sm" color="ink-3">
        Página {totalPages === 0 ? 0 : number + 1} de {totalPages} · {totalElements} resultados
      </Text>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
