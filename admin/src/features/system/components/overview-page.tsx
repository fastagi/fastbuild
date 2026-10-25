import { Activity, Cloud, Gauge, PackageCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Card } from '@/components/ui/card';
import { env, isFeatureEnabled } from '@/config/env';
import { featureManifest } from '@/config/feature-manifest';
import { ApiHealthPanel } from '@/features/system/components/api-health-panel';
import { OperatorSystemPanel } from '@/features/system/components/operator-system-panel';
import { useApiReadiness } from '@/features/system/hooks/use-api-readiness';
import { cn } from '@/lib/cn';

export function OverviewPage() {
  const { t } = useTranslation();
  const readiness = useApiReadiness();
  const apiAvailable = readiness.data?.status === 'up' || readiness.data?.status === 'degraded';

  const metrics = [
    {
      icon: Activity,
      label: t('overview.api'),
      value: readiness.isPending
        ? t('overview.apiChecking')
        : apiAvailable
          ? t('overview.apiAvailable')
          : t('overview.apiUnavailable'),
      tone: readiness.isPending
        ? 'text-foreground'
        : apiAvailable
          ? 'text-success-strong'
          : 'text-danger-strong',
    },
    {
      icon: Cloud,
      label: t('overview.delivery'),
      value: t('overview.deliveryValue'),
      tone: 'text-foreground',
    },
    {
      icon: Gauge,
      label: t('overview.runtime'),
      value: t('overview.runtimeValue'),
      tone: 'text-foreground',
    },
  ];

  const releaseRows = [
    {
      label: t('overview.buildMode'),
      value: import.meta.env.PROD ? t('common.production') : t('common.development'),
    },
    {
      label: t('overview.basePath'),
      value: import.meta.env.BASE_URL,
    },
    {
      label: t('overview.apiBase'),
      value: env.API_BASE_URL,
    },
    {
      label: t('overview.featureCount'),
      value: String(
        Object.values(featureManifest).filter((feature) => feature.kind === 'core').length,
      ),
    },
  ];

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('overview.eyebrow')}</p>
        <h1>{t('overview.title')}</h1>
        <p>{t('overview.description')}</p>
      </header>

      <div className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.label}
              className="flex items-center gap-3 rounded-lg px-4 py-3.5 shadow-xs"
            >
              <span className="icon-surface" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-subtle">{metric.label}</p>
                <p className={cn('mt-0.5 truncate text-base font-semibold', metric.tone)}>
                  {metric.value}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="content-grid">
        <ApiHealthPanel />
        <SectionCard
          icon={PackageCheck}
          titleId="release-profile-title"
          title={t('overview.releaseTitle')}
          description={t('overview.releaseDescription')}
          contentClassName="p-0"
        >
          <dl className="divide-y divide-border">
            {releaseRows.map((row) => (
              <div className="definition-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
        {isFeatureEnabled('operator') ? <OperatorSystemPanel /> : null}
      </div>
    </div>
  );
}
