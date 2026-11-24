/**
 * @component PageContainer, PageHeader
 * @category Common
 * @status Stable
 * @description The width, gutters, and title block shared by console pages.
 * @usage Wrap a page in PageContainer and start it with one PageHeader, which owns the page's h1.
 * @example
 * <PageContainer>
 *   <PageHeader title="Assets" description="Files in this workspace." actions={<Button>Upload</Button>} />
 * </PageContainer>
 */
import type { ReactNode } from 'react';

import { cn } from '@/utils';

const pageContainerSizes = {
  narrow: 'max-w-4xl',
  default: 'max-w-6xl',
} as const;

interface PageContainerProps extends React.ComponentProps<'div'> {
  size?: keyof typeof pageContainerSizes;
}

export function PageContainer({ size = 'default', className, ...props }: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 md:py-8 lg:px-8',
        pageContainerSizes[size],
        className
      )}
      {...props}
    />
  );
}

interface PageHeaderProps extends Omit<React.ComponentProps<'header'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Page-level controls. They sit under the title on phones and beside it from `sm` up. */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:mb-8',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-text-main md:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
