import type { CSSProperties } from 'react';
import type { BadgeTone } from '../lib/domain-ui';

interface BadgeProps {
  tone: BadgeTone;
  label: string;
  style?: CSSProperties;
}

const TONE_STYLES: Record<BadgeTone, CSSProperties> = {
  danger:  { background: 'var(--urgent)',  color: '#fff' },
  ok:      { background: 'var(--ok)',      color: '#fff' },
  sky:     { background: 'var(--sky)',     color: '#fff' },
  neutral: { background: 'var(--line)',    color: 'var(--ink-2)' },
};

/**
 * Pill badge for domain estado/prioridad values.
 * Built on the existing design-token palette. Unknown tones silently use neutral.
 */
export function Badge({ tone, label, style }: BadgeProps) {
  const toneStyle = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 99,
        fontSize: 'var(--fs-micro)',
        fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...toneStyle,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
