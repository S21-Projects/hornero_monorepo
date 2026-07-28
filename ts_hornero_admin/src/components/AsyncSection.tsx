import type { ReactNode } from 'react';
import { Text } from './ui/Typography';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface AsyncSectionProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Uniform loading / error / empty / content wrapper.
 * Eliminates per-page ad-hoc state branches for data-fetch routes.
 * Error and empty branches reuse the shared ErrorState/EmptyState primitives.
 */
export function AsyncSection({
  isLoading,
  isError,
  isEmpty,
  emptyLabel = 'Sin resultados',
  onRetry,
  children,
}: AsyncSectionProps) {
  if (isLoading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Text variant="body" color="ink-3">Cargando…</Text>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Ocurrió un error al cargar los datos. Intentá de nuevo más tarde."
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyLabel} />;
  }

  return <>{children}</>;
}
