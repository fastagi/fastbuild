import { Building2, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pager } from '@/components/layout/pager';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrganizations } from '@/features/organizations/hooks/use-organizations';
import type { OrganizationSearch } from '@/features/organizations/types';

interface OrganizationsPageProps {
  search: OrganizationSearch;
  onSearchChange: (search: OrganizationSearch) => void;
  onOpen: (organizationId: number) => void;
}

export function OrganizationsPage({ search, onSearchChange, onOpen }: OrganizationsPageProps) {
  const { t, i18n } = useTranslation();
  const organizations = useOrganizations(search);
  const [query, setQuery] = useState(search.q ?? '');
  const meta = organizations.data?.meta;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchChange({ q: query.trim() || undefined, page: undefined });
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('organizations.eyebrow')}</p>
        <h1>{t('organizations.title')}</h1>
        <p>{t('organizations.description')}</p>
      </header>

      <SectionCard
        icon={Building2}
        titleId="organizations-title"
        title={t('organizations.listTitle')}
        description={meta ? t('organizations.total', { count: meta.total }) : t('common.loading')}
        contentClassName="p-0"
        actions={
          <>
            <form role="search" onSubmit={submitSearch} className="flex gap-2">
              <Input
                aria-label={t('organizations.search')}
                placeholder={t('organizations.searchPlaceholder')}
                maxLength={100}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full sm:w-56"
              />
              <Button
                type="submit"
                size="icon"
                variant="outline"
                aria-label={t('organizations.search')}
              >
                <Search aria-hidden="true" />
              </Button>
            </form>
          </>
        }
      >
        {organizations.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : organizations.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {t('organizations.errors.unavailable')}
          </p>
        ) : organizations.data.data.length === 0 ? (
          <EmptyState>{t('organizations.empty')}</EmptyState>
        ) : (
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('organizations.columns.organization')}</TableHead>
                <TableHead scope="col">{t('organizations.columns.members')}</TableHead>
                <TableHead scope="col">{t('organizations.columns.created')}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t('organizations.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.data.data.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>
                    <div className="font-medium">{organization.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {organization.slug} · #{organization.id}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{organization.member_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormat.format(new Date(organization.created_at))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={t('organizations.openNamed', { name: organization.name })}
                      onClick={() => onOpen(organization.id)}
                    >
                      {t('organizations.open')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pager
          meta={meta}
          label={t('organizations.pagination')}
          onPageChange={(page) => onSearchChange({ ...search, page })}
        />
      </SectionCard>
    </div>
  );
}
