import { ArrowLeft, Building2, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { AccountIdentity } from '@/components/ui/account-identity';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PagePagination } from '@/components/ui/pagination';
import { QueryError } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  useOrganization,
  useOrganizationMembers,
} from '@/features/organizations/hooks/use-organizations';
import type { OperatorMember } from '@/features/organizations/types';
import { ApiErrorCode } from '@/http/codes';
import { ApiError } from '@/http/client';

interface OrganizationDetailPageProps {
  organizationId: number;
  onBack: () => void;
  /** Sections owned by other optional features, shown once the organization is known to exist. */
  children?: ReactNode;
}

export function OrganizationDetailPage({
  organizationId,
  onBack,
  children,
}: OrganizationDetailPageProps) {
  const { t, i18n } = useTranslation();
  const organization = useOrganization(organizationId);
  const notFound =
    organization.error instanceof ApiError &&
    organization.error.errorCode === ApiErrorCode.ORGANIZATION_NOT_FOUND;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('organizations.eyebrow')}</p>
        <h1>{organization.data?.name ?? t('organizations.detailTitle')}</h1>
        <div className="mt-3">
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {t('organizations.back')}
          </Button>
        </div>
      </header>

      <SectionCard
        icon={Building2}
        titleId="organization-summary-title"
        title={t('organizations.summaryTitle')}
        description={t('organizations.summaryDescription')}
        contentClassName="p-0"
      >
        {organization.isPending ? (
          <Skeleton className="m-5 h-20" />
        ) : organization.isError ? (
          <QueryError
            className="p-5"
            message={
              notFound ? t('organizations.errors.notFound') : t('organizations.errors.unavailable')
            }
            error={organization.error}
            onRetry={notFound ? undefined : () => void organization.refetch()}
            retrying={organization.isFetching}
          />
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
            {[
              [t('organizations.fields.id'), organization.data.id],
              [t('organizations.fields.slug'), organization.data.slug],
              [t('organizations.fields.members'), organization.data.member_count],
              [
                t('organizations.fields.createdBy'),
                t('organizations.userRef', { id: organization.data.created_by }),
              ],
              [
                t('organizations.fields.created'),
                dateFormat.format(new Date(organization.data.created_at)),
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-0">
                <dt className="text-xs text-subtle">{label}</dt>
                <dd className="m-0 mt-1 font-medium [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SectionCard>

      {organization.isSuccess ? (
        <>
          <OrganizationMembers organizationId={organizationId} />
          {children}
        </>
      ) : null}
    </div>
  );
}

function OrganizationMembers({ organizationId }: { organizationId: number }) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const members = useOrganizationMembers(organizationId, page);
  const meta = members.data?.meta;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  const columns: DataTableColumn<OperatorMember>[] = [
    {
      id: 'account',
      header: t('organizations.memberColumns.account'),
      role: 'primary',
      cell: (member) => (
        <AccountIdentity
          name={member.nickname || member.username}
          email={member.email}
          identifier={member.username}
        />
      ),
    },
    {
      id: 'role',
      header: t('organizations.memberColumns.role'),
      role: 'status',
      cell: (member) => (
        <StatusBadge variant="metadata">{t(`organizations.roles.${member.role}`)}</StatusBadge>
      ),
    },
    {
      id: 'joined',
      header: t('organizations.memberColumns.joined'),
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (member) => dateFormat.format(new Date(member.joined_at)),
    },
  ];

  return (
    <SectionCard
      icon={Users}
      titleId="organization-members-title"
      title={t('organizations.membersTitle')}
      description={
        members.isSuccess
          ? t('organizations.memberTotal', { count: members.data.meta.total })
          : members.isPending
            ? t('common.loading')
            : undefined
      }
      contentClassName="p-0"
    >
      <DataTable
        columns={columns}
        rows={members.data?.data}
        rowKey={(member) => member.id}
        status={members.status}
        errorMessage={t('organizations.errors.unavailable')}
        error={members.error}
        onRetry={() => void members.refetch()}
        retrying={members.isFetching}
        emptyMessage={t('organizations.membersEmpty')}
        minWidthClassName="min-w-[520px]"
        skeletonRows={3}
      />
      <PagePagination
        meta={meta}
        label={t('organizations.memberPagination')}
        onPageChange={setPage}
      />
    </SectionCard>
  );
}
