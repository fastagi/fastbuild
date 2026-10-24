import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface SectionCardProps {
  icon: LucideIcon;
  title: ReactNode;
  /** Id of the heading; the card is announced as a region labelled by it. */
  titleId: string;
  titleAs?: 'h1' | 'h2';
  description?: ReactNode;
  /** Controls aligned with the heading on wide screens, such as a search box or refresh button. */
  actions?: ReactNode;
  /** Controls placed below the heading, such as a filter form. */
  toolbar?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/** A titled console section composed from shadcn Card primitives. */
export function SectionCard({
  icon: Icon,
  title,
  titleId,
  titleAs: Heading = 'h2',
  description,
  actions,
  toolbar,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className={cn('gap-0 overflow-hidden rounded-lg py-0 shadow-xs', className)}
    >
      <CardHeader className="gap-3 space-y-0 border-b px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="icon-surface" aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm leading-5">
                <Heading id={titleId}>{title}</Heading>
              </CardTitle>
              {description ? (
                <CardDescription className="mt-0.5 text-xs leading-5">
                  {description}
                </CardDescription>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {toolbar}
      </CardHeader>
      <CardContent className={cn('p-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
