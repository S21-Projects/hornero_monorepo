import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Typography';

/**
 * Styled catch-all 404 for the SPA router, matching the ErrorState visual
 * language (icon badge + title + message + primary action).
 */
export function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
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
          background: 'var(--sky-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="var(--sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </div>
      <Text variant="display" color="horn">404</Text>
      <Text variant="h2" as="h1" style={{ marginTop: 8 }}>
        Página no encontrada
      </Text>
      <Text variant="body-sm" color="ink-2" style={{ maxWidth: 320, marginTop: 4 }}>
        Puede que el enlace esté roto o la página ya no esté disponible.
      </Text>
      <Link to="/" style={{ marginTop: 18, textDecoration: 'none' }}>
        <Button variant="primary">Volver</Button>
      </Link>
    </div>
  );
}
