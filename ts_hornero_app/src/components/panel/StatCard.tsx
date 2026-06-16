import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card style={{ padding: 22 }}>
      <Text variant="label" color="ink-2">{label}</Text>
      <Text variant="stat" style={{ marginTop: 8 }}>{value}</Text>
      {hint && (
        <Text variant="caption" color="ink-3" style={{ marginTop: 6, display: 'block' }}>
          {hint}
        </Text>
      )}
    </Card>
  );
}
