interface ProgressProps {
  value: number;
  max: number;
  height?: number;
}

export function Progress({ value, max, height = 9 }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div
      style={{
        height,
        borderRadius: 999,
        background: "var(--line-soft)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: "var(--horn)",
        }}
      />
    </div>
  );
}
