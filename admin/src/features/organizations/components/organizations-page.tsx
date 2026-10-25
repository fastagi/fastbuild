import { Building2, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { PagePagination } from '@/components/ui/pagination';
import { useOrganizations } from '@/features/organizations/hooks/use-organizations';
import type { OperatorOrganization, OrganizationSearch } from '@/features/organizations/types';

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

  const columns: DataTableColumn<OperatorOrganization>[] = [
    {
      id: 'organization',
      header: t('organizations.columns.organization'),
      cell: (organization) => (
        <>
          <div className="font-medium">{organization.name}</div>
          <div className="text-xs text-muted-foreground">
            {organization.slug} · #{organization.id}
          </div>
        </>
      ),
    },
    {
      id: 'members',
      header: t('organizations.columns.members'),
      className: 'tabular-nums',
      cell: (organization) => organization.member_count,
    },
    {
      id: 'created',
      header: t('organizations.columns.created'),
      className: 'text-muted-foreground',
      cell: (organization) => dateFormat.format(new Date(organization.created_at)),
    },
    {
      id: 'actions',
      header: t('organizations.columns.actions'),
      align: 'end',
      cell: (organization) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={t('organizations.openNamed', { name: organization.name })}
          onClick={() => onOpen(organization.id)}
        >
          {t('organizations.open')}
        </Button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('organizations.eyebrow')}</p>
        <h1>{t('organizations.title')}</h1>
        <p>{t('organizations.description')}</p>
      </header>

      <section className="panel" aria-labelledby="organizations-title">
        <div className="panel-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="icon-surface" aria-hidden="true">
              <Building2 className="size-4" />
            </span>
            <div>
              <h2 id="organizations-title" className="panel-title">
                {t('organizations.listTitle')}
              </h2>
              <p className="panel-description">
                {meta ? t('organizations.total', { count: meta.total }) : t('common.loading')}
              </p>
            </div>
          </div>
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
        </div>

        <DataTable
          columns={columns}
          rows={organizations.data?.data}
          rowKey={(organization) => organization.id}
          status={organizations.status}
          errorMessage={t('organizations.errors.unavailable')}
          emptyMessage={t('organizations.empty')}
          minWidthClassName="min-w-[560px]"
        />

        <PagePagination
          meta={meta}
          label={t('organizations.pagination')}
          onPageChange={(page) => onSearchChange({ ...search, page })}
        />
      </section>
    </div>
  );
}
