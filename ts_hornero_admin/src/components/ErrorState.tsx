import type { ReactNode } from 'react';
import { StatePanel } from './ui/StatePanel';

interface ErrorStateProps {
  title?: string;
  message?: string;
  illustration?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Reusable error visual — used by AsyncSection's error branch, the
 * ErrorBoundary fallback, and any page that needs to surface a failed fetch.
 */
export function ErrorState({
  title = 'Algo salió mal',
  message = 'Ocurrió un error inesperado. Intentá de nuevo en unos momentos.',
  illustration,
  retryLabel = 'Intentar de nuevo',
  onRetry,
}: ErrorStateProps) {
  return (
    <StatePanel
      icon={illustration}
      title={title}
      subtitle={message}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      actionVariant="secondary"
    />
  );
}
