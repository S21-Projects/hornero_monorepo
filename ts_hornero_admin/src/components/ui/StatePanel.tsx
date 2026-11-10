import type { ReactNode } from 'react';
import { Button } from './Button';
import { Text } from './Typography';

interface StatePanelProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary';
}

/**
 * Shared layout for EmptyState / ErrorState: icon (omitted entirely if not
 * passed — no built-in fallback), title, optional subtitle, and an action
 * button that only renders when actionLabel is given.
 */
export function StatePanel({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}: StatePanelProps) {
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
      {icon && <div style={{ marginBottom: 16 }}>{icon}</div>}
      <Text variant="h2">{title}</Text>
      {subtitle && (
        <Text variant="body-sm" color="ink-2" style={{ maxWidth: 320, marginTop: 4 }}>
          {subtitle}
        </Text>
      )}
      {actionLabel && (
        <Button variant={actionVariant} style={{ marginTop: 18 }} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
