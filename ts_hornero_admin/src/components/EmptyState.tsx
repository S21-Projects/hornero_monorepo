import type { ReactNode } from 'react';
import { Button } from './ui/Button';
import { Text } from './ui/Typography';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  message?: string;
  illustration?: ReactNode;
  action?: EmptyStateAction;
}

const DEFAULT_ILLUSTRATION = (
  <div
    style={{
      width: 72,
      height: 72,
      borderRadius: 20,
      background: '#F6ECDC',
      border: '2px dashed rgba(200,90,32,.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    aria-hidden="true"
  >
    <span style={{ fontSize: 28 }}>🪺</span>
  </div>
);

/**
 * Reusable empty-result visual — used by AsyncSection's empty branch and
 * any page rendering a genuinely empty (not errored) list.
 */
export function EmptyState({ title, message, illustration, action }: EmptyStateProps) {
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
      <div style={{ marginBottom: 16 }}>{illustration ?? DEFAULT_ILLUSTRATION}</div>
      <Text variant="h2">{title}</Text>
      {message && (
        <Text variant="body-sm" color="ink-2" style={{ maxWidth: 320, marginTop: 4 }}>
          {message}
        </Text>
      )}
      {action && (
        <Button variant="primary" style={{ marginTop: 18 }} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
