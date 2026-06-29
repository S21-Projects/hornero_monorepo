import type { ReactNode } from 'react';
import { Text } from './ui/Typography';

interface AsyncSectionProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

/**
 * Uniform loading / error / empty / content wrapper.
 * Eliminates per-page ad-hoc state branches for data-fetch routes.
 */
export function AsyncSection({
  isLoading,
  isError,
  isEmpty,
  emptyLabel = 'Sin resultados',
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
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Text variant="body" color="urgent">
          Ocurrió un error al cargar los datos. Intentá de nuevo más tarde.
        </Text>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Text variant="body" color="ink-3">{emptyLabel}</Text>
      </div>
    );
  }

  return <>{children}</>;
}
