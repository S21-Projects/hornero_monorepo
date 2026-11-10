import { type ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Text } from '../ui/Typography';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <Card style={{ padding: 22 }}>
      <Text variant="title" as="h3">{title}</Text>
      {subtitle && (
        <Text variant="caption" color="ink-3" style={{ marginTop: 4, display: 'block' }}>
          {subtitle}
        </Text>
      )}
      <div style={{ marginTop: 16 }}>{children}</div>
    </Card>
  );
}
