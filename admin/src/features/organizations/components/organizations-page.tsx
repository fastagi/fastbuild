import { Building2, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PagePagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
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
      </SectionCard>
    </div>
  );
}
