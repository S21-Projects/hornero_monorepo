import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

function ChartCardSkeleton() {
  return (
    <Card style={{ padding: 22 }}>
      <Skeleton width={160} height={18} />
      <Skeleton width={220} height={13} style={{ marginTop: 8 }} />
      <Skeleton height={260} radius={12} style={{ marginTop: 16 }} />
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <Skeleton width={320} height={28} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
