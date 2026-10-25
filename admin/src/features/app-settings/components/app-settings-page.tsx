import { RotateCcw, Save, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import {
  useAppSettings,
  useChangeAppSetting,
} from '@/features/app-settings/hooks/use-app-settings';
import { isInactiveStarter, settingErrorKey } from '@/features/app-settings/setting-errors';
import type { AppSetting, AppSettingValue } from '@/features/app-settings/types';
import { cn } from '@/lib/cn';

function SettingEditor({ setting }: { setting: AppSetting }) {
  const { t } = useTranslation();
  const change = useChangeAppSetting();
  const [draft, setDraft] = useState<AppSettingValue>(setting.value);
  const dirty = draft !== setting.value;
  const display = (value: AppSettingValue) =>
    typeof value === 'boolean' ? (value ? t('settings.on') : t('settings.off')) : String(value);

  const save = (value: AppSettingValue) =>
    change.mutate(
      { kind: 'set', key: setting.key, value, version: setting.version },
      { onSuccess: () => toast.success(t('settings.saved', { key: setting.key })) },
    );

  let control;
  if (setting.kind === 'boolean') {
    control = (
      <div className="flex h-9 items-center gap-2">
        <Switch
          aria-label={setting.key}
          checked={draft === true}
          onCheckedChange={(checked) => setDraft(checked)}
        />
        <span className="text-sm text-muted-foreground">
          {draft === true ? t('settings.on') : t('settings.off')}
        </span>
      </div>
    );
  } else if (setting.kind === 'enum') {
    control = (
      <Select value={String(draft)} onValueChange={(value) => setDraft(value)}>
        <SelectTrigger aria-label={setting.key}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(setting.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else {
    control = (
      <Input
        aria-label={setting.key}
        type={setting.kind === 'integer' ? 'number' : 'text'}
        value={String(draft)}
        onChange={(event) =>
          setDraft(setting.kind === 'integer' ? Number(event.target.value) : event.target.value)
        }
      />
    );
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-2 border-b px-4 py-3 transition-colors last:border-0 md:flex-row md:items-center',
        dirty && 'bg-brand-subtle/60',
      )}
    >
      <div className="min-w-0 md:w-1/3">
        <code className="text-sm font-medium">{setting.key}</code>
        <div className="mt-1 flex flex-wrap gap-1">
          <StatusBadge tone={setting.source === 'override' ? 'brand' : 'neutral'}>
            {t(`settings.source.${setting.source}`)}
          </StatusBadge>
          <StatusBadge>{t('settings.version', { version: setting.version })}</StatusBadge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {control}
        {dirty ? (
          <p className="text-xs text-brand-strong" aria-live="polite">
            {t('settings.unsaved', { from: display(setting.value), to: display(draft) })}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={change.isPending}
            onClick={() => setDraft(setting.value)}
          >
            <Undo2 aria-hidden="true" />
            {t('settings.discard')}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={!dirty || change.isPending}
          onClick={() => save(draft)}
        >
          <Save aria-hidden="true" />
          {t('settings.save')}
        </Button>
        {setting.source === 'override' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={change.isPending}
            onClick={() =>
              change.mutate(
                { kind: 'reset', key: setting.key, version: setting.version },
                { onSuccess: () => toast.success(t('settings.resetDone', { key: setting.key })) },
              )
            }
          >
            <RotateCcw aria-hidden="true" />
            {t('settings.reset')}
          </Button>
        ) : null}
      </div>
      {change.isError ? (
        <p role="alert" className="text-sm text-destructive md:basis-full">
          {t(settingErrorKey(change.error))}
        </p>
      ) : null}
    </li>
  );
}

export function AppSettingsPage() {
  const { t } = useTranslation();
  const settings = useAppSettings();

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('settings.eyebrow')}</p>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </header>
      <SectionCard
        icon={SlidersHorizontal}
        titleId="settings-title"
        title={t('settings.listTitle')}
        description={t('settings.concurrencyNote')}
        contentClassName="p-0"
      >
        {settings.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : settings.isError ? (
          <p role="alert" className="p-4 text-sm text-muted-foreground">
            {isInactiveStarter(settings.error)
              ? t('settings.inactive')
              : t('settings.errors.unavailable')}
          </p>
        ) : settings.data.length === 0 ? (
          <EmptyState>{t('settings.empty')}</EmptyState>
        ) : (
          <ul>
            {settings.data.map((setting) => (
              <SettingEditor key={`${setting.key}:${setting.version}`} setting={setting} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
