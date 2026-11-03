import { ChevronLeft, ChevronRight } from 'lucide-react';
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

/** Icon-only previous/next for a card header, so a long list can be paged without scrolling to it. */
export function CompactPagination({
  label,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: Omit<PaginationProps, 'summary'>) {
  const { t } = useTranslation();
  return (
    <nav className="flex gap-1" aria-label={label}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        aria-label={t('common.previous')}
        title={t('common.previous')}
        disabled={!hasPrevious}
        onClick={onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        aria-label={t('common.next')}
        title={t('common.next')}
        disabled={!hasNext}
        onClick={onNext}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
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
