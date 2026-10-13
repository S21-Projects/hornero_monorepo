import type { ReactNode } from 'react';
import { Logo } from './ui/Logo';
import { Card } from './ui/Card';
import { Text } from './ui/Typography';

/** Centered logo + card shell shared by the unauthenticated account-recovery pages. */
export function AuthPageLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--adobe)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <Logo size={42} />
      </div>
      <Card style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <Text variant="h2" as="h1" color="earth" style={{ marginBottom: 24, textAlign: 'center' }}>
          {title}
        </Text>
        {children}
      </Card>
    </div>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        background: '#FEE2E2',
        border: '1px solid #FCA5A5',
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <Text variant="label" style={{ color: '#DC2626' }}>{children}</Text>
    </div>
  );
}
