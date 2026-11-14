import { Card } from './Card';
import { Text } from './Typography';

export interface StatCardProps {
  value: number;
  label: string;
  /** Highlights the card (`.stat-card--accent`) only while `value` is above zero. */
  accent?: boolean;
}

/** One big number with its label, laid out by the `.stat-grid` / `.stat-card` classes. */
export function StatCard({ value, label, accent }: StatCardProps) {
  return (
    <Card className={`stat-card${accent && value > 0 ? ' stat-card--accent' : ''}`}>
      <Text variant="stat" as="p">{value}</Text>
      <Text variant="label" color="ink-2" as="p">{label}</Text>
    </Card>
  );
}
