import { Link } from '@tanstack/react-router';
import {
  Activity,
  BellRing,
  ChevronRight,
  Database,
  type LucideIcon,
  PackageCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Card } from '@/components/ui/card';
import { env, isFeatureEnabled, isOperatorFeatureEnabled } from '@/config/env';
import { featureManifest } from '@/config/feature-manifest';
import { useFailedDeliveryCount } from '@/features/notification-deliveries/hooks/use-notification-deliveries';
import { ApiHealthPanel } from '@/features/system/components/api-health-panel';
import { AttentionPanel } from '@/features/system/components/attention-panel';
import { OperatorSystemPanel } from '@/features/system/components/operator-system-panel';
import { useApiReadiness } from '@/features/system/hooks/use-api-readiness';
import { useOperatorSystem } from '@/features/system/hooks/use-operator-system';
import { cn } from '@/lib/cn';

type MetricTone = 'neutral' | 'success' | 'danger';

const metricToneClasses: Record<MetricTone, string> = {
  neutral: 'text-foreground',
  success: 'text-success-strong',
  danger: 'text-danger-strong',
};

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: MetricTone;
}) {
  return (
    <Card className="flex items-center gap-3 rounded-lg px-4 py-3.5 shadow-xs">
      <span className="icon-surface" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-subtle">{label}</p>
        <p className={cn('mt-0.5 truncate text-base font-semibold', metricToneClasses[tone])}>
          {value}
        </p>
      </div>
    </Card>
  );
}

function ApiMetric() {
  const { t } = useTranslation();
  const readiness = useApiReadiness();
  const available = readiness.data?.status === 'up' || readiness.data?.status === 'degraded';

  return (
    <Metric
      icon={Activity}
      label={t('overview.api')}
      value={
        readiness.isPending
          ? t('overview.apiChecking')
          : available
            ? t('overview.apiAvailable')
            : t('overview.apiUnavailable')
      }
      tone={readiness.isPending ? 'neutral' : available ? 'success' : 'danger'}
    />
  );
}

function DatabaseMetric() {
  const { t } = useTranslation();
  const system = useOperatorSystem();

  if (!system.isSuccess) {
    return (
      <Metric
        icon={Database}
        label={t('overview.database')}
        value={system.isPending ? t('overview.metricChecking') : t('overview.metricUnknown')}
        tone="neutral"
      />
    );
  }
  const available = system.data.database === 'ok';
  return (
    <Metric
      icon={Database}
      label={t('overview.database')}
      value={available ? t('system.databaseOk') : t('system.databaseDown')}
      tone={available ? 'success' : 'danger'}
    />
  );
}

/** The one number here an operator acts on, so any failure outweighs the rest of the row. */
function FailedDeliveriesMetric() {
  const { t } = useTranslation();
  const failed = useFailedDeliveryCount();

  if (!failed.isSuccess || failed.data === 0) {
    return (
      <Metric
        icon={BellRing}
        label={t('overview.failedDeliveries')}
        value={
          failed.isPending
            ? t('overview.metricChecking')
            : failed.isError
              ? t('overview.metricUnknown')
              : t('overview.failedDeliveriesNone')
        }
        tone={failed.isSuccess ? 'success' : 'neutral'}
      />
    );
  }
  return (
    <Link
      to="/console/notifications"
      search={{ status: 'failed' }}
      className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger-subtle px-4 py-3.5 text-danger-strong shadow-xs transition-colors hover:border-danger focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-md bg-danger text-card"
      >
        <BellRing className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{t('overview.failedDeliveries')}</span>
        <span className="mt-0.5 block truncate text-base font-semibold">{failed.data}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  );
}

export function OverviewPage() {
  const { t } = useTranslation();

  const releaseRows = [
    {
      label: t('overview.delivery'),
      value: t('overview.deliveryValue'),
    },
    {
      label: t('overview.runtime'),
      value: t('overview.runtimeValue'),
    },
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

      <div className="content-grid">
        <div className="metric-grid xl:col-span-2">
          <ApiMetric />
          {isFeatureEnabled('operator') ? <DatabaseMetric /> : null}
          {isOperatorFeatureEnabled('notification') ? <FailedDeliveriesMetric /> : null}
        </div>
        {/* A phone reaches anything an operator must act on before the status summary. */}
        <AttentionPanel className="max-sm:order-first" />
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
