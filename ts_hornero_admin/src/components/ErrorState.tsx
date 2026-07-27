import { Button } from './ui/Button';
import { Text } from './ui/Typography';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Reusable error visual — used by AsyncSection's error branch, the
 * ErrorBoundary fallback, and any page that needs to surface a failed fetch.
 */
export function ErrorState({
  title = 'Algo salió mal',
  message = 'Ocurrió un error inesperado. Intentá de nuevo en unos momentos.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 24px',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'var(--urgent-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="var(--urgent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
        </svg>
      </div>
      <Text variant="h2">{title}</Text>
      <Text variant="body-sm" color="ink-2" style={{ maxWidth: 320, marginTop: 4 }}>
        {message}
      </Text>
      {onRetry && (
        <Button variant="secondary" style={{ marginTop: 18 }} onClick={onRetry}>
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}
