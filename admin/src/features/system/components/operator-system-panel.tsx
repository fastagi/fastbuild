import { Server } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useOperatorSystem } from '@/features/system/hooks/use-operator-system';

export function OperatorSystemPanel() {
  const { t } = useTranslation();
  const system = useOperatorSystem();

  return (
    <SectionCard
      icon={Server}
      titleId="operator-system-title"
      title={t('system.title')}
      description={t('system.description')}
      contentClassName="p-0"
    >
      {system.isPending ? (
        <Skeleton className="m-5 h-20" />
      ) : system.isError ? (
        <p role="alert" className="p-5 text-sm text-destructive">
          {t('system.unavailable')}
        </p>
      ) : (
        <dl className="divide-y divide-border text-sm">
          <div className="definition-row">
            <dt>{t('system.database')}</dt>
            <dd>
              <StatusBadge tone={system.data.database === 'ok' ? 'success' : 'danger'}>
                {system.data.database === 'ok' ? t('system.databaseOk') : t('system.databaseDown')}
              </StatusBadge>
            </dd>
          </div>
          <div className="definition-row">
            <dt>{t('system.build')}</dt>
            <dd className="whitespace-normal">
              {[system.data.version, system.data.revision, system.data.go_version]
                .filter(Boolean)
                .map((part, index) => (
                  <Fragment key={part}>
                    {index > 0 ? ' · ' : null}
                    <code className="whitespace-nowrap">{part}</code>
                  </Fragment>
                ))}
            </dd>
          </div>
          <div className="definition-row">
            <dt>{t('system.starters')}</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {system.data.starters.map((name) => (
                <StatusBadge key={name}>{name}</StatusBadge>
              ))}
            </dd>
          </div>
        </dl>
      )}
    </SectionCard>
  );
}
