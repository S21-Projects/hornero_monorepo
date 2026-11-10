import type { CSSProperties, ReactNode } from 'react';
import { Box1, Clock, Warning2 } from 'iconsax-reactjs';

const badgeStyle = (background: string): CSSProperties => ({
  width: 56,
  height: 56,
  borderRadius: '50%',
  background,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const badge = (background: string, children: ReactNode) => (
  <div style={badgeStyle(background)} aria-hidden="true">
    {children}
  </div>
);

export const EmptyIcon = badge('#F6ECDC', <Box1 size={26} color="var(--horn)" variant="Bulk" />);

export const ErrorIcon = badge('var(--urgent-bg)', <Warning2 size={26} color="var(--urgent)" variant="Bulk" />);

export const ComingSoonIcon = badge('#F6ECDC', <Clock size={26} color="var(--horn)" variant="Bulk" />);
