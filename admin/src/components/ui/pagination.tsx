import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PageMeta } from '@/http/pagination';

interface PaginationProps {
  label: string;
  /** Position text such as "Page 2 of 5"; cursor lists have none. */
  summary?: ReactNode;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Previous/next navigation shared by page- and cursor-based lists. */
export function Pagination({
  label,
  summary,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: PaginationProps) {
  const { t } = useTranslation();
  return (
    <nav
      className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm"
      aria-label={label}
    >
      <span className="text-muted-foreground">{summary}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasPrevious}
          onClick={onPrevious}
        >
          {t('common.previous')}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!hasNext} onClick={onNext}>
          {t('common.next')}
        </Button>
      </div>
    </nav>
  );
}

interface PagePaginationProps {
  meta: PageMeta | undefined;
  label: string;
  onPageChange: (page: number) => void;
}

/** Pagination for an offset-paged list; renders nothing for a single page. */
export function PagePagination({ meta, label, onPageChange }: PagePaginationProps) {
  const { t } = useTranslation();
  if (!meta || meta.last_page <= 1) {
    return null;
  }
  return (
    <Pagination
      label={label}
      summary={t('common.page', { page: meta.current_page, pages: meta.last_page })}
      hasPrevious={meta.current_page > 1}
      hasNext={meta.current_page < meta.last_page}
      onPrevious={() => onPageChange(meta.current_page - 1)}
      onNext={() => onPageChange(meta.current_page + 1)}
    />
  );
}
