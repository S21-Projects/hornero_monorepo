import { Text } from '../ui/Typography';

interface ChartEmptyStateProps {
  message: string;
}

export function ChartEmptyState({ message }: ChartEmptyStateProps) {
  return (
    <div
      style={{
        height: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--straw)',
          border: '1.5px dashed var(--horn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 3 3 5-6" />
        </svg>
      </div>
      <Text as="div" variant="label" color="ink-3">{message}</Text>
    </div>
  );
}
