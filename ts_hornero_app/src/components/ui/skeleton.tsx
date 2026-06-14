interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
}: SkeletonProps) {
  return (
    <div
        style={{
          width,
          height,
          borderRadius,
          background: "var(--line)",
          animation: "skeleton-pulse 1.6s ease-in-out infinite",
          flexShrink: 0,
        }}
    />
  );
}

/** Matches the shape of OrgCard (290px wide). */
export function OrgCardSkeleton() {
  return (
    <div
      style={{
        width: 290,
        padding: 16,
        borderRadius: "var(--r-card, 16px)",
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Avatar + two text lines */}
      <div style={{ display: "flex", gap: 12 }}>
        <Skeleton width={54} height={54} borderRadius="50%" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="50%" height={12} />
        </div>
      </div>

      {/* Pill row */}
      <div style={{ display: "flex", gap: 8 }}>
        <Skeleton width={72} height={26} borderRadius={999} />
      </div>

      {/* Stars + button row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Skeleton width={80} height={14} />
        <Skeleton width={100} height={32} borderRadius={8} />
      </div>
    </div>
  );
}
