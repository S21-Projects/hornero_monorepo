import type { FallbackProps } from 'react-error-boundary';
import { ErrorState } from '../components/ErrorState';

/**
 * Full-page fallback for the top-level ErrorBoundary in main.tsx.
 * Catches catastrophic render errors that escape every route-level boundary.
 */
export function AppErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--adobe, #f5f0e8)',
      }}
    >
      <ErrorState
        title="Algo salió mal"
        message="La aplicación tuvo un error inesperado. Intentá de nuevo."
        onRetry={resetErrorBoundary}
      />
    </div>
  );
}
