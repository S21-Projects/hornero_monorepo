import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

interface PagerProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
}

export function Pager({ page, totalPages, totalElements, onPageChange }: PagerProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 0',
        flexWrap: 'wrap',
      }}
    >
      <Text as="span" variant="caption" color="ink-3">
        {totalElements} {totalElements === 1 ? 'resultado' : 'resultados'}
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Text as="span" variant="label" color="ink-2">
          {page + 1} / {totalPages}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
