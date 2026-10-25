import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  children: ReactNode;
  icon?: LucideIcon;
}

/** Centered placeholder for a list or panel that loaded successfully with no records. */
export function EmptyState({ children, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
