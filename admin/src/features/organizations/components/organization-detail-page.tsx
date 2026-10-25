import { ArrowLeft, Building2, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PagePagination } from '@/components/ui/pagination';
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
        <div>
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
          <p role="alert" className="p-5 text-sm text-destructive">
            {notFound ? t('organizations.errors.notFound') : t('organizations.errors.unavailable')}
          </p>
        ) : (
          <dl className="divide-y divide-border text-sm">
            <div className="definition-row">
              <dt>{t('organizations.fields.id')}</dt>
              <dd>{organization.data.id}</dd>
            </div>
            <div className="definition-row">
              <dt>{t('organizations.fields.slug')}</dt>
              <dd>{organization.data.slug}</dd>
            </div>
            <div className="definition-row">
              <dt>{t('organizations.fields.members')}</dt>
              <dd>{organization.data.member_count}</dd>
            </div>
            <div className="definition-row">
              <dt>{t('organizations.fields.createdBy')}</dt>
              <dd>{t('organizations.userRef', { id: organization.data.created_by })}</dd>
            </div>
            <div className="definition-row">
              <dt>{t('organizations.fields.created')}</dt>
              <dd>{dateFormat.format(new Date(organization.data.created_at))}</dd>
            </div>
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
      cell: (member) => (
        <>
          <div className="font-medium">{member.nickname || member.username}</div>
          <div className="text-xs text-muted-foreground">
            {member.username} · {member.email}
          </div>
        </>
      ),
    },
    {
      id: 'role',
      header: t('organizations.memberColumns.role'),
      cell: (member) => (
        <StatusBadge tone={member.role === 'owner' ? 'brand' : 'neutral'}>
          {t(`organizations.roles.${member.role}`)}
        </StatusBadge>
      ),
    },
    {
      id: 'joined',
      header: t('organizations.memberColumns.joined'),
      className: 'text-muted-foreground',
      cell: (member) => dateFormat.format(new Date(member.joined_at)),
    },
  ];

  return (
    <SectionCard
      icon={Users}
      titleId="organization-members-title"
      title={t('organizations.membersTitle')}
      description={
        meta ? t('organizations.memberTotal', { count: meta.total }) : t('common.loading')
      }
      contentClassName="p-0"
    >
      <DataTable
        columns={columns}
        rows={members.data?.data}
        rowKey={(member) => member.id}
        status={members.status}
        errorMessage={t('organizations.errors.unavailable')}
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
