import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
  className?: string;
}

/**
 * Loading placeholder bar — pulses via the `skeleton-pulse` keyframe in
 * global.css. Compose with layout wrappers (flex/grid) to build page-shaped
 * skeletons (see DashboardSkeleton, DropdownSkeleton).
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style, className }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--line)',
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
