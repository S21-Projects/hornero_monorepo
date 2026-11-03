import type { ReactNode } from 'react';
import { Text } from './Typography';

interface PageHeaderProps {
  title: string;
  description: string;
  /** Optional controls rendered on the right of the title row (wraps on narrow widths). */
  actions?: ReactNode;
}

/** Standard page header: left-aligned h1 title with a muted description below it. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Text variant="h1">{title}</Text>
        {actions}
      </div>
      <Text variant="body-sm" color="ink-3" style={{ marginTop: 4, marginBottom: 20 }}>
        {description}
      </Text>
    </>
  );
}
