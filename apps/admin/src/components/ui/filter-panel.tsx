import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useBelowSm } from '@/hooks/use-below-sm';
import { cn } from '@/lib/cn';

export interface FilterChip {
  id: string;
  label: string;
  value: string;
}

interface FilterPanelProps {
  /** The applied filters, shown as removable chips whether or not the form is open. */
  chips: readonly FilterChip[];
  onRemove: (id: string) => void;
  onClear: () => void;
  /** The filter form. Submitting it closes the panel on a phone, revealing the results. */
  children: ReactNode;
}

/** A filter form that collapses behind "Filters (n)" below `sm`, so the list stays in view. */
export function FilterPanel({ chips, onRemove, onClear, children }: FilterPanelProps) {
  const { t } = useTranslation();
  const collapsible = useBelowSm();
  const [open, setOpen] = useState(false);
  const formId = useId();

  return (
    <div className="flex flex-col gap-3">
      {collapsible ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal aria-hidden="true" />
          {chips.length > 0
            ? t('dataTable.filtersCount', { applied: chips.length })
            : t('dataTable.filters')}
          <ChevronDown
            aria-hidden="true"
            className={cn('transition-transform', open && 'rotate-180')}
          />
        </Button>
      ) : null}
      <div id={formId} hidden={collapsible && !open} onSubmit={() => setOpen(false)}>
        {children}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ul className="flex min-w-0 flex-wrap gap-2" aria-label={t('dataTable.activeFilters')}>
            {chips.map((chip) => (
              <li
                key={chip.id}
                className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-brand-subtle pr-1 pl-3 text-xs font-medium text-brand-strong"
              >
                <span className="truncate">
                  {chip.label}: {chip.value}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-5 shrink-0 rounded-full text-brand-strong hover:bg-brand/10"
                  aria-label={t('dataTable.removeFilter', { filter: chip.label })}
                  onClick={() => onRemove(chip.id)}
                >
                  <X aria-hidden="true" className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
          {chips.length > 1 ? (
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onClear}>
              {t('dataTable.clearFilters')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
