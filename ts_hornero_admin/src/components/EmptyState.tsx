import type { ReactNode } from 'react';
import { StatePanel } from './ui/StatePanel';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  message?: string;
  illustration?: ReactNode;
  action?: EmptyStateAction;
}

/**
 * Reusable empty-result visual — used by AsyncSection's empty branch and
 * any page rendering a genuinely empty (not errored) list.
 */
export function EmptyState({ title, message, illustration, action }: EmptyStateProps) {
  return (
    <StatePanel
      icon={illustration}
      title={title}
      subtitle={message}
      actionLabel={action?.label}
      onAction={action?.onClick}
    />
  );
}
